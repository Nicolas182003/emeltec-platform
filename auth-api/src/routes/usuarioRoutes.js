const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/usuarioController');

// GET  /api/usuarios        → listar todos los usuarios
router.get('/',  ctrl.listarUsuarios);

// POST /api/usuarios        → crear nuevo usuario
router.post('/', ctrl.crearUsuario);

module.exports = router;
