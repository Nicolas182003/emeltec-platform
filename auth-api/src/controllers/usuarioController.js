const db     = require('../config/db');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

/**
 * POST /api/usuarios
 * Crea un nuevo usuario con contraseña hasheada.
 *
 * Body esperado:
 * {
 *   nombre:        string (requerido)
 *   apellido:      string (requerido)
 *   email:         string (requerido)
 *   password:      string (requerido)
 *   tipo:          "SuperAdmin" | "Admin" | "Gerente" | "Cliente"  (requerido)
 *   telefono:      string (opcional)
 *   cargo:         string (opcional)
 *   empresa_id:    string (opcional — requerido si tipo != SuperAdmin)
 *   sub_empresa_id: string (opcional — requerido si tipo == Gerente)
 * }
 */
exports.crearUsuario = async (req, res, next) => {
  try {
    const {
      nombre, apellido, email, password,
      tipo, telefono, cargo, empresa_id, sub_empresa_id
    } = req.body;

    // Validaciones básicas
    if (!nombre || !apellido || !email || !tipo) {
      return res.status(400).json({
        ok: false,
        error: 'Campos requeridos: nombre, apellido, email, tipo'
      });
    }

    const tiposValidos = ['SuperAdmin', 'Admin', 'Gerente', 'Cliente'];
    if (!tiposValidos.includes(tipo)) {
      return res.status(400).json({
        ok: false,
        error: `Tipo inválido. Valores permitidos: ${tiposValidos.join(', ')}`
      });
    }

    if (tipo !== 'SuperAdmin' && !empresa_id) {
      return res.status(400).json({
        ok: false,
        error: 'empresa_id es requerido para roles Admin, Gerente y Cliente'
      });
    }

    if (tipo === 'Gerente' && !sub_empresa_id) {
      return res.status(400).json({
        ok: false,
        error: 'sub_empresa_id es requerido para el rol Gerente'
      });
    }

    // Verificar que empresa existe (si aplica)
    if (empresa_id) {
      const { rows } = await db.query('SELECT id FROM empresa WHERE id = $1', [empresa_id]);
      if (rows.length === 0) {
        return res.status(404).json({ ok: false, error: `Empresa '${empresa_id}' no encontrada` });
      }
    }

    // Hashear contraseña solo si se envía — si no, el usuario entra por OTP
    const password_hash = password ? await bcrypt.hash(password, 10) : null;
    const newId = 'U' + crypto.randomBytes(3).toString('hex');

    await db.query(
      `INSERT INTO usuario
         (id, nombre, apellido, email, telefono, cargo, tipo, empresa_id, sub_empresa_id, password_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [newId, nombre, apellido, email,
       telefono || null, cargo || null,
       tipo, empresa_id || null, sub_empresa_id || null,
       password_hash]
    );

    res.status(201).json({
      ok: true,
      message: 'Usuario creado exitosamente',
      data: { id: newId, email, tipo }
    });

  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ ok: false, error: 'El correo ya está registrado' });
    }
    next(err);
  }
};

/**
 * GET /api/usuarios
 * Lista todos los usuarios (sin exponer password_hash).
 */
exports.listarUsuarios = async (_req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT id, nombre, apellido, email, telefono, cargo, tipo,
              empresa_id, sub_empresa_id, created_at
       FROM usuario
       ORDER BY created_at DESC`
    );
    res.json({ ok: true, total: rows.length, data: rows });
  } catch (err) {
    next(err);
  }
};
