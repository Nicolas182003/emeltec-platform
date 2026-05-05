/**
 * @comentario-codex
 * Define el healthcheck de dga-api para confirmar servicio activo y conexion a base de datos.
 */
const router = require('express').Router();
const pool   = require('../config/db');

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT NOW() AS server_time');
    res.json({ ok: true, service: 'dga-api', db: 'connected', server_time: rows[0].server_time });
  } catch (err) {
    res.status(503).json({ ok: false, service: 'dga-api', db: 'disconnected', error: err.message });
  }
});

module.exports = router;
