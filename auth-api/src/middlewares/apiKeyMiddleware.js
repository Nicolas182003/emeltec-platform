/**
 * Middleware de autenticación por API Key.
 * Cada request debe incluir el header:  x-api-key: <clave>
 */
module.exports = (req, res, next) => {
  const key = req.headers['x-api-key'];

  if (!key) {
    return res.status(401).json({ ok: false, error: 'Falta el header x-api-key' });
  }

  if (key !== process.env.ADMIN_API_KEY) {
    return res.status(403).json({ ok: false, error: 'API Key inválida' });
  }

  next();
};
