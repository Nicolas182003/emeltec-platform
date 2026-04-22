/**
 * authRoutes.js — Rutas de autenticación de Emeltec.
 *
 * Endpoints públicos (no requieren JWT):
 *   POST /api/auth/request-code  → solicita un OTP al correo
 *   POST /api/auth/login         → verifica OTP y emite JWT
 *
 * Endpoint protegido (requiere JWT válido):
 *   POST /api/auth/refresh       → renueva el JWT si hay actividad del usuario
 *                                  Si el token expiró (30 min sin uso), devuelve 401
 *                                  y el frontend debe redirigir al login
 */

const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/authController');

// POST /api/auth/request-code → genera y envía OTP al correo
router.post('/request-code', ctrl.requestCode);

// POST /api/auth/login        → verifica OTP/password y devuelve JWT de sesión
router.post('/login', ctrl.login);

// POST /api/auth/refresh      → renueva el JWT (el frontend llama esto con actividad)
router.post('/refresh', ctrl.refresh);

module.exports = router;
