const db     = require('../config/db');
const crypto = require('crypto');

/**
 * POST /api/empresas
 * Crea una nueva empresa.
 *
 * Body esperado:
 * {
 *   id:          string (opcional — se genera automáticamente si no se envía)
 *   nombre:      string (requerido)
 *   rut:         string (requerido)
 *   tipo_empresa: string (requerido) ej: "Industrial", "Minera", "Retail"
 *   sitios:      number (opcional, default 0)
 * }
 */
exports.crearEmpresa = async (req, res, next) => {
  try {
    const { id, nombre, rut, tipo_empresa, sitios } = req.body;

    if (!nombre || !rut || !tipo_empresa) {
      return res.status(400).json({
        ok: false,
        error: 'Campos requeridos: nombre, rut, tipo_empresa'
      });
    }

    const newId = id || 'E' + crypto.randomBytes(2).toString('hex').toUpperCase();

    await db.query(
      `INSERT INTO empresa (id, nombre, rut, tipo_empresa, sitios)
       VALUES ($1, $2, $3, $4, $5)`,
      [newId, nombre, rut, tipo_empresa, sitios || 0]
    );

    res.status(201).json({
      ok: true,
      message: 'Empresa creada exitosamente',
      data: { id: newId, nombre, rut, tipo_empresa }
    });

  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ ok: false, error: 'El RUT o ID ya existe' });
    }
    next(err);
  }
};

/**
 * GET /api/empresas
 * Lista todas las empresas.
 */
exports.listarEmpresas = async (_req, res, next) => {
  try {
    const empresas    = await db.query(`SELECT id, nombre, rut, tipo_empresa, sitios FROM empresa ORDER BY nombre ASC`);
    const subEmpresas = await db.query(`SELECT id, empresa_id, nombre FROM sub_empresa ORDER BY nombre ASC`);

    // Anidar sub-empresas dentro de su empresa padre
    const data = empresas.rows.map(e => ({
      ...e,
      sub_empresas: subEmpresas.rows.filter(se => se.empresa_id === e.id)
    }));

    res.json({ ok: true, total: data.length, data });
  } catch (err) {
    next(err);
  }
};
