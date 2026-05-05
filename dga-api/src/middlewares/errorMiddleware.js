/**
 * @comentario-codex
 * Middleware final de errores para normalizar respuestas fallidas de dga-api.
 */
module.exports = (err, req, res, next) => {
  const status  = err.status || 500;
  const message = err.message || 'Error interno del servidor';
  if (status >= 500) console.error(`[dga-api][Error] ${status} - ${message}`);
  res.status(status).json({ ok: false, message });
};
