const db          = require('../config/db');
const crypto      = require('crypto');
const alertClient = require('../services/alertClient');

exports.crearEmpresa = async (req, res, next) => {
  try {
    const { id, nombre, rut, tipo_empresa, sitios } = req.body;

    if (!nombre || !rut || !tipo_empresa) {
      return res.status(400).json({ ok: false, error: 'Campos requeridos: nombre, rut, tipo_empresa' });
    }

    const newId = id || 'E' + crypto.randomBytes(2).toString('hex').toUpperCase();

    await db.query(
      `INSERT INTO empresa (id, nombre, rut, tipo_empresa, sitios) VALUES ($1, $2, $3, $4, $5)`,
      [newId, nombre, rut, tipo_empresa, sitios || 0]
    );

    alertClient.enviarAlerta('empresa_creada', {
      empresa: { id: newId, nombre, rut, tipo_empresa },
      creadoPor: req.user?.email || 'Sistema',
    });

    res.status(201).json({ ok: true, message: 'Empresa creada exitosamente', data: { id: newId, nombre, rut, tipo_empresa } });

  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ ok: false, error: 'El RUT o ID ya existe' });
    }
    next(err);
  }
};

exports.listarEmpresas = async (_req, res, next) => {
  try {
    const empresas    = await db.query(`SELECT id, nombre, rut, tipo_empresa, sitios FROM empresa ORDER BY nombre ASC`);
    const subEmpresas = await db.query(`SELECT id, empresa_id, nombre FROM sub_empresa ORDER BY nombre ASC`);

    const data = empresas.rows.map(e => ({
      ...e,
      sub_empresas: subEmpresas.rows.filter(se => se.empresa_id === e.id)
    }));

    res.json({ ok: true, total: data.length, data });
  } catch (err) {
    next(err);
  }
};
