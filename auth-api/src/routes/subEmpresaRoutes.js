const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/subEmpresaController');

// GET  /api/sub-empresas    → listar todas las sub-empresas
router.get('/',  ctrl.listarSubEmpresas);

// POST /api/sub-empresas    → crear nueva sub-empresa
router.post('/', ctrl.crearSubEmpresa);

module.exports = router;
