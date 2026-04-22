/**
 * alertRoutes.js — Rutas internas del sistema de alertas.
 *
 * Expone el endpoint POST /internal/alerts que solo pueden usar
 * servicios internos autorizados (auth-api u otros futuros servicios).
 *
 * Protección: el middleware internalKeyMiddleware exige el header
 * x-internal-key con el valor definido en INTERNAL_API_KEY del .env.
 * Si la clave no coincide, rechaza con 401.
 */

const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/alertController');

/**
 * Middleware de autenticación interna.
 * Compara el header x-internal-key con la variable de entorno INTERNAL_API_KEY.
 * Solo permite pasar a servicios que conozcan esta clave.
 */
function internalKeyMiddleware(req, res, next) {
  const key = req.headers['x-internal-key'];
  if (!key || key !== process.env.INTERNAL_API_KEY) {
    return res.status(401).json({ ok: false, error: 'No autorizado' });
  }
  next();
}

// POST /internal/alerts — recibe y despacha una alerta
router.post('/', internalKeyMiddleware, controller.recibirAlerta);

module.exports = router;
