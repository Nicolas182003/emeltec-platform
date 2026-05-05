/**
 * @comentario-codex
 * Controlador DGA: administra configuraciones por sitio, historial de reportes y envio manual a la DGA.
 */
const pool = require('../config/db');
const { ejecutarEnvio } = require('../jobs/cron2-send');

// Lista todas las configuraciones DGA registradas y agrega datos basicos del sitio.
exports.listConfigs = async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT du.*, s.descripcion AS sitio_descripcion, s.id_serial
      FROM dga_user du
      JOIN sitio s ON s.id = du.sitio_id
      ORDER BY du.created_at DESC
    `);
    res.json({ ok: true, data: rows });
  } catch (err) { next(err); }
};

// Busca la configuracion DGA de un sitio especifico.
exports.getConfig = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT du.*, s.descripcion AS sitio_descripcion, s.id_serial
       FROM dga_user du
       JOIN sitio s ON s.id = du.sitio_id
       WHERE du.sitio_id = $1`,
      [req.params.sitio_id]
    );
    if (!rows.length) return res.status(404).json({ ok: false, message: 'Config no encontrada' });
    res.json({ ok: true, data: rows[0] });
  } catch (err) { next(err); }
};

// Crea la configuracion que conecta un sitio local con sus credenciales/registros DGA.
exports.createConfig = async (req, res, next) => {
  try {
    const { sitio_id, rut, clave, periodicidad, reg_caudal, reg_nivel_freatico, reg_totalizador } = req.body;
    if (!sitio_id || !rut || !clave || !periodicidad) {
      return res.status(400).json({ ok: false, message: 'sitio_id, rut, clave y periodicidad son obligatorios' });
    }
    const { rows } = await pool.query(
      `INSERT INTO dga_user (sitio_id, rut, clave, periodicidad, reg_caudal, reg_nivel_freatico, reg_totalizador)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [sitio_id, rut, clave, periodicidad, reg_caudal ?? null, reg_nivel_freatico ?? null, reg_totalizador ?? null]
    );
    res.status(201).json({ ok: true, data: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ ok: false, message: 'Ya existe config para este sitio' });
    next(err);
  }
};

// Actualiza solo los campos enviados; COALESCE mantiene el valor anterior cuando viene null/undefined.
exports.updateConfig = async (req, res, next) => {
  try {
    const { rut, clave, periodicidad, reg_caudal, reg_nivel_freatico, reg_totalizador, activo } = req.body;
    const { rows } = await pool.query(
      `UPDATE dga_user SET
         rut                = COALESCE($1, rut),
         clave              = COALESCE($2, clave),
         periodicidad       = COALESCE($3, periodicidad),
         reg_caudal         = COALESCE($4, reg_caudal),
         reg_nivel_freatico = COALESCE($5, reg_nivel_freatico),
         reg_totalizador    = COALESCE($6, reg_totalizador),
         activo             = COALESCE($7, activo),
         updated_at         = NOW()
       WHERE id = $8
       RETURNING *`,
      [rut, clave, periodicidad, reg_caudal, reg_nivel_freatico, reg_totalizador, activo, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ ok: false, message: 'Config no encontrada' });
    res.json({ ok: true, data: rows[0] });
  } catch (err) { next(err); }
};

// Elimina una configuracion DGA por id.
exports.deleteConfig = async (req, res, next) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM dga_user WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ ok: false, message: 'Config no encontrada' });
    res.json({ ok: true, message: 'Config eliminada' });
  } catch (err) { next(err); }
};

// Entrega el historial de reportes enviados o pendientes, con paginacion y filtro opcional por sitio.
exports.listReportes = async (req, res, next) => {
  try {
    const limit    = Math.min(Number(req.query.limit  ?? 50), 200);
    const offset   = Number(req.query.offset ?? 0);
    const sitio_id = req.query.sitio_id ?? null;

    const params = [limit, offset];
    const where  = sitio_id ? (params.push(sitio_id), `WHERE r.sitio_id = $${params.length}`) : '';

    const { rows } = await pool.query(
      `SELECT r.*, s.descripcion AS sitio_descripcion
       FROM dga_reporte r
       JOIN sitio s ON s.id = r.sitio_id
       ${where}
       ORDER BY r.created_at DESC
       LIMIT $1 OFFSET $2`,
      params
    );
    res.json({ ok: true, data: rows });
  } catch (err) { next(err); }
};

// Devuelve los ultimos reportes de un sitio para mostrar trazabilidad por instalacion.
exports.getReportesBySitio = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.*, s.descripcion AS sitio_descripcion
       FROM dga_reporte r
       JOIN sitio s ON s.id = r.sitio_id
       WHERE r.sitio_id = $1
       ORDER BY r.created_at DESC
       LIMIT 100`,
      [req.params.sitio_id]
    );
    res.json({ ok: true, data: rows });
  } catch (err) { next(err); }
};

// Fuerza un envio inmediato para un sitio, reutilizando la misma logica del job automatico.
exports.enviarManual = async (req, res, next) => {
  try {
    const reporte = await ejecutarEnvio(req.params.sitio_id);
    // Este endpoint responde con el mismo JSON que se envia/registra para DGA.
    res.json(reporte.dga_json);
  } catch (err) { next(err); }
};
