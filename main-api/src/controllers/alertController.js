/**
 * alertController.js — Controlador del endpoint interno de alertas.
 *
 * Recibe peticiones POST desde otros servicios internos (ej: auth-api)
 * y las pasa al dispatcher para que determine a quién notificar.
 *
 * Este endpoint NO es público — requiere el header x-internal-key.
 * La validación de esa clave se hace en alertRoutes.js (middleware).
 */

const dispatcher = require('../services/alertDispatcher');

// Tipos de alerta válidos que acepta el sistema
const TIPOS_VALIDOS = ['usuario_creado', 'empresa_creada', 'umbral_telemetria', 'monitoreo'];

/**
 * POST /internal/alerts
 *
 * Body esperado:
 * {
 *   tipo:  string  — tipo de alerta (ver TIPOS_VALIDOS)
 *   datos: object  — payload del evento, varía según el tipo
 * }
 *
 * Responde 202 (Accepted) de inmediato y procesa el envío en background.
 * Esto evita que la auth-api tenga que esperar a que el correo se envíe.
 */
exports.recibirAlerta = async (req, res, next) => {
  try {
    const { tipo, datos } = req.body;

    // Validar que se enviaron los campos requeridos
    if (!tipo || !datos) {
      return res.status(400).json({
        ok: false,
        error: 'Se requieren los campos: tipo, datos'
      });
    }

    // Validar que el tipo de alerta sea uno de los conocidos
    if (!TIPOS_VALIDOS.includes(tipo)) {
      return res.status(400).json({
        ok: false,
        error: `Tipo invalido. Valores permitidos: ${TIPOS_VALIDOS.join(', ')}`
      });
    }

    // Lanzar el despacho en background sin await — no bloqueamos al servicio que llamó
    // Si falla, solo se logua en consola (no afecta la operación principal)
    dispatcher.despachar(tipo, datos).catch(err => {
      console.error('❌ Error al despachar alerta en background:', err.message);
    });

    // Respondemos 202 (la petición fue aceptada y está siendo procesada)
    return res.status(202).json({
      ok: true,
      message: `Alerta "${tipo}" recibida y en proceso de envio`
    });

  } catch (err) {
    next(err);
  }
};
