/**
 * @comentario-codex
 * Declara rutas protegidas para configuracion, reportes y envio manual de datos DGA.
 */
const router = require('express').Router();
const auth   = require('../middlewares/authMiddleware');
const ctrl   = require('../controllers/dgaController');

// ConfiguraciÃ³n DGA por sitio
router.get   ('/config',           auth, ctrl.listConfigs);
router.get   ('/config/:sitio_id', auth, ctrl.getConfig);
router.post  ('/config',           auth, ctrl.createConfig);
router.put   ('/config/:id',       auth, ctrl.updateConfig);
router.delete('/config/:id',       auth, ctrl.deleteConfig);

// Historial de reportes
router.get('/reportes',           auth, ctrl.listReportes);
router.get('/reportes/:sitio_id', auth, ctrl.getReportesBySitio);

// Disparo manual de envÃ­o
router.post('/enviar/:sitio_id', auth, ctrl.enviarManual);

module.exports = router;
