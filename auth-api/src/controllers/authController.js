/**
 * authController.js — Controlador de autenticación de Emeltec.
 *
 * Flujo de login:
 *   1. El usuario solicita un OTP con su email  → POST /auth/request-code
 *   2. El sistema genera un código de 6 dígitos, lo hashea y lo envía al correo
 *   3. El usuario ingresa el código             → POST /auth/login
 *   4. Si el código es válido, se emite un JWT con duración SESSION_DURATION_MINUTES
 *   5. Mientras el usuario esté activo, el frontend renueva el token → POST /auth/refresh
 *   6. Si hay 30 min sin actividad, el token expira y la sesión se cierra
 */

const db           = require('../config/db');
const bcrypt       = require('bcrypt');
const jwt          = require('jsonwebtoken');
const emailService = require('../services/emailService');

const JWT_SECRET = process.env.JWT_SECRET || 'emeltec-jwt-secret-dev';

// Duración de la sesión en minutos — configurable en .env (default: 30 min)
const SESSION_DURATION_MINUTES = parseInt(process.env.SESSION_DURATION_MINUTES) || 30;

const DEFAULT_OTP_MINS = 30;
const MAX_OTP_MINS     = 1440; // 24 horas máximo

/**
 * Genera un JWT con los datos del usuario y la duración de sesión configurada.
 * @param {object} user - Fila del usuario de la BD
 * @returns {string} Token JWT firmado
 */
function generarToken(user) {
  return jwt.sign(
    {
      id:             user.id,
      email:          user.email,
      tipo:           user.tipo,
      empresa_id:     user.empresa_id,
      sub_empresa_id: user.sub_empresa_id,
    },
    JWT_SECRET,
    { expiresIn: `${SESSION_DURATION_MINUTES}m` }
  );
}

/**
 * POST /api/auth/request-code
 * Genera un OTP de 6 dígitos, lo guarda hasheado en la BD y lo envía al correo del usuario.
 * El campo password_hash NO se modifica — el OTP va en su propia columna (otp_hash).
 */
exports.requestCode = async (req, res, next) => {
  try {
    const { email, expires_minutes } = req.body;

    if (!email) {
      return res.status(400).json({ ok: false, error: 'El correo es requerido' });
    }

    // Respetar duración personalizada del OTP, con límites mínimo y máximo
    let minutes = parseInt(expires_minutes) || DEFAULT_OTP_MINS;
    if (minutes < 1)            minutes = DEFAULT_OTP_MINS;
    if (minutes > MAX_OTP_MINS) minutes = MAX_OTP_MINS;

    // Solo pueden iniciar sesión usuarios que ya están registrados en el sistema
    const { rows } = await db.query(
      'SELECT id, nombre, email FROM usuario WHERE email = $1',
      [email]
    );

    if (rows.length === 0) {
      return res.status(403).json({
        ok: false,
        error: 'Este correo no ha sido autorizado en el sistema. Contacte a su administrador.',
      });
    }

    const user      = rows[0];
    const otpCode   = Math.floor(100000 + Math.random() * 900000).toString(); // 6 dígitos
    const otpHash   = await bcrypt.hash(otpCode, 10);
    const expiresAt = new Date(Date.now() + minutes * 60 * 1000);

    // Guardar el OTP hasheado y su expiración en la BD
    await db.query(
      'UPDATE usuario SET otp_hash = $1, otp_expires_at = $2 WHERE email = $3',
      [otpHash, expiresAt, email]
    );

    // Enviar el código al correo del usuario usando Resend
    const emailResult = await emailService.sendOTPEmail(
      email, user.nombre, otpCode, minutes
    );

    res.json({
      ok: true,
      message: `Codigo enviado exitosamente. Valido por ${minutes} minutos.`,
      expires_at: expiresAt.toISOString(),
      previewUrl: emailResult.previewUrl || null,
    });

  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/login
 * Verifica las credenciales del usuario y emite un JWT de sesión.
 *
 * Acepta dos métodos de autenticación:
 *   1. OTP enviado al correo  → verifica otp_hash + que no haya expirado
 *   2. Contraseña fija        → verifica password_hash (para testing/seed)
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ ok: false, error: 'Email y codigo son requeridos' });
    }

    const { rows } = await db.query(
      `SELECT id, nombre, email, tipo, empresa_id, sub_empresa_id,
              password_hash, otp_hash, otp_expires_at
       FROM usuario WHERE email = $1`,
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ ok: false, error: 'Credenciales invalidas' });
    }

    const user = rows[0];
    let authenticated = false;

    // Intentar autenticación con OTP (si el usuario tiene uno pendiente y no expiró)
    if (user.otp_hash) {
      const otpExpired = user.otp_expires_at && new Date() > new Date(user.otp_expires_at);
      if (!otpExpired) {
        const otpMatch = await bcrypt.compare(password, user.otp_hash);
        if (otpMatch) {
          // El OTP es de un solo uso — invalidarlo inmediatamente después de usarlo
          await db.query(
            'UPDATE usuario SET otp_hash = NULL, otp_expires_at = NULL WHERE email = $1',
            [email]
          );
          authenticated = true;
        }
      }
    }

    // Si no autenticó con OTP, intentar con contraseña fija (seed/testing)
    if (!authenticated && user.password_hash) {
      const passMatch = await bcrypt.compare(password, user.password_hash);
      if (passMatch) authenticated = true;
    }

    if (!authenticated) {
      return res.status(401).json({ ok: false, error: 'Codigo incorrecto' });
    }

    // Emitir JWT con duración SESSION_DURATION_MINUTES
    const token = generarToken(user);

    res.json({
      ok: true,
      token,
      session_minutes: SESSION_DURATION_MINUTES,
      user: {
        nombre:         user.nombre,
        email:          user.email,
        tipo:           user.tipo,
        empresa_id:     user.empresa_id,
        sub_empresa_id: user.sub_empresa_id,
      },
    });

  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/refresh
 * Renueva el JWT si el token actual sigue siendo válido.
 *
 * El frontend llama a este endpoint cada vez que el usuario hace algo en la web.
 * Si el usuario está inactivo por SESSION_DURATION_MINUTES, el token expira
 * y este endpoint dejará de funcionar, cerrando la sesión.
 *
 * Requiere: Authorization: Bearer <token>
 */
exports.refresh = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token      = authHeader && authHeader.split(' ')[1]; // Bearer <token>

    if (!token) {
      return res.status(401).json({ ok: false, error: 'Token requerido' });
    }

    // Verificar que el token sea válido y no haya expirado
    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      // Token expirado o inválido → la sesión se cerró por inactividad
      return res.status(401).json({ ok: false, error: 'Sesion expirada. Inicia sesion nuevamente.' });
    }

    // Confirmar que el usuario sigue existiendo en la BD (puede haber sido eliminado)
    const { rows } = await db.query(
      `SELECT id, nombre, email, tipo, empresa_id, sub_empresa_id
       FROM usuario WHERE id = $1`,
      [payload.id]
    );

    if (rows.length === 0) {
      return res.status(401).json({ ok: false, error: 'Usuario no encontrado' });
    }

    // Emitir un nuevo token con SESSION_DURATION_MINUTES frescos
    const nuevoToken = generarToken(rows[0]);

    res.json({
      ok: true,
      token: nuevoToken,
      session_minutes: SESSION_DURATION_MINUTES,
    });

  } catch (err) {
    next(err);
  }
};
