const db           = require('../config/db');
const bcrypt       = require('bcrypt');
const jwt          = require('jsonwebtoken');
const emailService = require('../services/emailService');

const JWT_SECRET       = process.env.JWT_SECRET || 'emeltec-jwt-secret-dev';
const DEFAULT_OTP_MINS = 30;
const MAX_OTP_MINS     = 1440; // 24 horas máximo

/**
 * POST /api/auth/request-code
 * Genera OTP, lo guarda en otp_hash (sin tocar password_hash) y lo envía por correo.
 */
exports.requestCode = async (req, res, next) => {
  try {
    const { email, expires_minutes } = req.body;

    if (!email) {
      return res.status(400).json({ ok: false, error: 'El correo es requerido' });
    }

    let minutes = parseInt(expires_minutes) || DEFAULT_OTP_MINS;
    if (minutes < 1)            minutes = DEFAULT_OTP_MINS;
    if (minutes > MAX_OTP_MINS) minutes = MAX_OTP_MINS;

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
    const otpCode   = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash   = await bcrypt.hash(otpCode, 10);
    const expiresAt = new Date(Date.now() + minutes * 60 * 1000);

    // Guardar OTP en columna separada — password_hash NO se toca
    await db.query(
      'UPDATE usuario SET otp_hash = $1, otp_expires_at = $2 WHERE email = $3',
      [otpHash, expiresAt, email]
    );

    const emailResult = await emailService.sendOTPEmail(
      email, user.nombre, otpCode, minutes
    );

    res.json({
      ok: true,
      message: `Código enviado exitosamente. Válido por ${minutes} minutos.`,
      expires_at: expiresAt.toISOString(),
      previewUrl: emailResult.previewUrl || null,
    });

  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/login
 * Acepta:
 *   1. Código OTP enviado al correo  → verifica otp_hash + expiración
 *   2. Contraseña fija (ej: tester)  → verifica password_hash directamente
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ ok: false, error: 'Email y código son requeridos' });
    }

    const { rows } = await db.query(
      `SELECT id, nombre, email, tipo, empresa_id, sub_empresa_id,
              password_hash, otp_hash, otp_expires_at
       FROM usuario WHERE email = $1`,
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ ok: false, error: 'Credenciales inválidas' });
    }

    const user = rows[0];
    let authenticated = false;

    // 1️⃣ Intentar con OTP (si tiene uno pendiente)
    if (user.otp_hash) {
      const otpExpired = user.otp_expires_at && new Date() > new Date(user.otp_expires_at);

      if (!otpExpired) {
        const otpMatch = await bcrypt.compare(password, user.otp_hash);
        if (otpMatch) {
          // Invalidar OTP después de usarlo
          await db.query(
            'UPDATE usuario SET otp_hash = NULL, otp_expires_at = NULL WHERE email = $1',
            [email]
          );
          authenticated = true;
        }
      }
    }

    // 2️⃣ Si no autenticó con OTP, intentar con contraseña fija
    if (!authenticated && user.password_hash) {
      const passMatch = await bcrypt.compare(password, user.password_hash);
      if (passMatch) authenticated = true;
    }

    if (!authenticated) {
      return res.status(401).json({ ok: false, error: 'Código incorrecto' });
    }

    const token = jwt.sign(
      {
        id:             user.id,
        email:          user.email,
        tipo:           user.tipo,
        empresa_id:     user.empresa_id,
        sub_empresa_id: user.sub_empresa_id,
      },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      ok: true,
      token,
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
