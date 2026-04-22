const db     = require('../config/db');
const crypto = require('crypto');

/**
 * POST /api/sub-empresas
 * Crea una nueva sub-empresa asociada a una empresa padre.
 *
 * Body esperado:
 * {
 *   id:         string (opcional — se genera automáticamente)
 *   nombre:     string (requerido)
 *   rut:        string (requerido)
 *   empresa_id: string (requerido — ID de la empresa padre)
 *   sitios:     number (opcional, default 0)
 * }
 */
exports.crearSubEmpresa = async (req, res, next) => {
  try {
    const { id, nombre, rut, empresa_id, sitios } = req.body;

    if (!nombre || !rut || !empresa_id) {
      return res.status(400).json({
        ok: false,
        error: 'Campos requeridos: nombre, rut, empresa_id'
      });
    }

    // Verificar que la empresa padre existe
    const { rows: empresas } = await db.query(
      'SELECT id FROM empresa WHERE id = $1', [empresa_id]
    );
    if (empresas.length === 0) {
      return res.status(404).json({
        ok: false,
        error: `Empresa padre '${empresa_id}' no encontrada`
      });
    }

    const newId = id || 'SE' + crypto.randomBytes(2).toString('hex').toUpperCase();

    await db.query(
      `INSERT INTO sub_empresa (id, nombre, rut, empresa_id, sitios)
       VALUES ($1, $2, $3, $4, $5)`,
      [newId, nombre, rut, empresa_id, sitios || 0]
    );

    res.status(201).json({
      ok: true,
      message: 'Sub-empresa creada exitosamente',
      data: { id: newId, nombre, rut, empresa_id }
    });

  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ ok: false, error: 'El RUT o ID ya existe' });
    }
    next(err);
  }
};

/**
 * GET /api/sub-empresas
 * Lista todas las sub-empresas.
 */
exports.listarSubEmpresas = async (_req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT se.id, se.nombre, se.rut, se.sitios, se.empresa_id, e.nombre AS empresa_nombre, se.created_at
       FROM sub_empresa se
       LEFT JOIN empresa e ON se.empresa_id = e.id
       ORDER BY se.created_at DESC`
    );
    res.json({ ok: true, total: rows.length, data: rows });
  } catch (err) {
    next(err);
  }
};
