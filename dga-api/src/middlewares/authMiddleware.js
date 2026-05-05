/**
 * @comentario-codex
 * Valida JWT reutilizado por dga-api para proteger rutas operativas.
 */
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/env');

// Protege las rutas DGA reutilizando el token JWT emitido por la API de autenticacion.
module.exports = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, message: 'Token requerido' });
  }
  try {
    // Si el token es valido, deja el usuario decodificado disponible para los controladores.
    req.user = jwt.verify(auth.slice(7), jwtSecret);
    next();
  } catch {
    res.status(401).json({ ok: false, message: 'Token invalido o expirado' });
  }
};
