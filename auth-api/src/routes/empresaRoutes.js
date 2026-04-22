const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/empresaController');

// GET  /api/empresas        → listar todas las empresas
router.get('/',  ctrl.listarEmpresas);

// POST /api/empresas        → crear nueva empresa
router.post('/', ctrl.crearEmpresa);

module.exports = router;
