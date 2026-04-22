/**
 * alertClient.js — Cliente HTTP para enviar alertas a main-api.
 *
 * auth-api no envía correos directamente — delega esa responsabilidad
 * a main-api a través de este cliente. Así toda la lógica de alertas
 * (a quién notificar, qué plantilla usar, etc.) vive en un solo lugar.
 *
 * Comunicación:
 *   auth-api  →  POST http://localhost:3000/internal/alerts
 *                Header: x-internal-key: <INTERNAL_API_KEY>
 *
 * Diseño importante:
 *   Si main-api no está disponible o responde con error, esta función
 *   SOLO loguea el problema — nunca lanza una excepción que interrumpa
 *   la operación principal (ej: creación de usuario).
 */

// URL base de main-api — se puede cambiar en .env cuando se suba a la nube
const MAIN_API_URL     = process.env.MAIN_API_URL     || 'http://localhost:3000';

// Clave compartida entre servicios internos para autenticar las peticiones
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || '';

/**
 * Envía una notificación de alerta al endpoint interno de main-api.
 *
 * @param {string} tipo  - Tipo de alerta: 'usuario_creado', 'empresa_creada', etc.
 * @param {object} datos - Payload del evento (varía según el tipo)
 */
exports.enviarAlerta = async (tipo, datos) => {
  try {
    const res = await fetch(`${MAIN_API_URL}/internal/alerts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-key': INTERNAL_API_KEY, // autenticación interna
      },
      body: JSON.stringify({ tipo, datos }),
    });

    if (!res.ok) {
      // main-api respondió pero con error (ej: tipo inválido, clave incorrecta)
      const body = await res.text();
      console.warn(`⚠️  alertClient: main-api respondio ${res.status}: ${body}`);
    } else {
      console.log(`📨 alertClient: alerta "${tipo}" enviada a main-api`);
    }
  } catch (err) {
    // No se pudo conectar con main-api (ej: servicio caído, red no disponible)
    // Se loguea el error pero NO se propaga — las alertas son secundarias
    console.warn(`⚠️  alertClient: no se pudo conectar con main-api: ${err.message}`);
  }
};
