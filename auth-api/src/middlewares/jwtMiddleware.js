const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'emeltec-jwt-secret-dev';

module.exports = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ ok: false, error: 'Token requerido' });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(403).json({ ok: false, error: 'Token inválido o expirado' });
  }
};
