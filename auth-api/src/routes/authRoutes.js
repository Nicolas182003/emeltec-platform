const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/authController');

// POST /api/auth/request-code  → genera y envía OTP al correo
router.post('/request-code', ctrl.requestCode);

// POST /api/auth/login         → verifica OTP y devuelve JWT
router.post('/login', ctrl.login);

module.exports = router;
