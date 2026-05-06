// Rutas de utilidades para pozos de agua (todas bajo /api/pozos)
const express = require("express");
const router = express.Router();

const {
  convertirIEEE754,
  listarPeriodosIEEE754,
  getNivelFreatico,
  calcularCaudal,
} = require("../controllers/pozosController");

router.get("/ieee754/periodos", listarPeriodosIEEE754);
router.post("/ieee754", convertirIEEE754);
router.post("/nivel-freatico", getNivelFreatico);
router.post("/caudal", calcularCaudal);

module.exports = router;
