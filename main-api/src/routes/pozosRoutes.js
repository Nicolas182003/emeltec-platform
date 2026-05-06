// Rutas de utilidades para pozos de agua (todas bajo /api/pozos)
const express = require("express");
const router = express.Router();

const { convertirIEEE754, getNivelFreatico, calcularCaudal } = require("../controllers/pozosController");

router.post("/ieee754",         convertirIEEE754);    // Convierte dos words Modbus → float32
router.post("/nivel-freatico",  getNivelFreatico);    // Calcula profundidad del nivel freático
router.post("/caudal",          calcularCaudal);      // Convierte m³/h → l/s

module.exports = router;
