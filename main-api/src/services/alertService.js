/**
 * alertService.js — Servicio de envio de correos de alerta usando Resend.
 *
 * Este modulo es responsable UNICAMENTE de construir el HTML del correo
 * y enviarlo a traves de la API de Resend desde la direccion suport@emeltec.cl.
 * No decide a quien enviar — eso lo hace alertDispatcher.js.
 *
 * Tipos de alerta soportados:
 *   - usuario_creado    : se registro un nuevo usuario en el sistema
 *   - empresa_creada    : se registro una nueva empresa
 *   - umbral_telemetria : un dispositivo supero un limite de medicion
 *   - monitoreo         : alerta general del sistema (placeholder para futuro)
 *   - error_archivo     : el pipeline Go fallo al procesar un archivo de telemetria
 */

const { Resend } = require('resend');

// Instancia unica del cliente Resend (se crea la primera vez que se usa)
let resend = null;

/**
 * Retorna el cliente Resend inicializado.
 * Lanza error si falta la API key en el .env.
 */
function getClient() {
  if (resend) return resend;
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY no esta definida en el .env de main-api');
  }
  resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

/**
 * Plantillas HTML de correo por tipo de alerta.
 * Cada clave es un tipo de alerta y recibe los datos del evento
 * para construir el subject y el HTML del mensaje.
 */
const templates = {

  // Plantilla: nuevo usuario creado en el sistema
  usuario_creado: ({ nuevoUsuario, creadoPor }) => ({
    subject: `Nuevo usuario registrado — ${nuevoUsuario.tipo}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;
                  border:1px solid #e2e8f0;border-radius:12px;">
        <h2 style="color:#2563eb;">Panel Industrial Emeltec</h2>
        <p>Se ha registrado un nuevo usuario en el sistema:</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:8px;color:#64748b;">Nombre</td>
              <td style="padding:8px;font-weight:bold;">${nuevoUsuario.nombre} ${nuevoUsuario.apellido}</td></tr>
          <tr style="background:#f8fafc;"><td style="padding:8px;color:#64748b;">Correo</td>
              <td style="padding:8px;">${nuevoUsuario.email}</td></tr>
          <tr><td style="padding:8px;color:#64748b;">Rol</td>
              <td style="padding:8px;">${nuevoUsuario.tipo}</td></tr>
          <tr style="background:#f8fafc;"><td style="padding:8px;color:#64748b;">Empresa</td>
              <td style="padding:8px;">${nuevoUsuario.empresa_id || '—'}</td></tr>
          <tr><td style="padding:8px;color:#64748b;">Creado por</td>
              <td style="padding:8px;">${creadoPor || 'Sistema'}</td></tr>
        </table>
        <p style="color:#64748b;font-size:0.85em;">Este es un correo automatico. No responder.</p>
      </div>
    `,
  }),

  // Plantilla: nueva empresa registrada en el sistema
  empresa_creada: ({ empresa, creadoPor }) => ({
    subject: `Nueva empresa registrada — ${empresa.nombre}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;
                  border:1px solid #e2e8f0;border-radius:12px;">
        <h2 style="color:#2563eb;">Panel Industrial Emeltec</h2>
        <p>Se ha registrado una nueva empresa en el sistema:</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:8px;color:#64748b;">Nombre</td>
              <td style="padding:8px;font-weight:bold;">${empresa.nombre}</td></tr>
          <tr style="background:#f8fafc;"><td style="padding:8px;color:#64748b;">RUT</td>
              <td style="padding:8px;">${empresa.rut}</td></tr>
          <tr><td style="padding:8px;color:#64748b;">Tipo</td>
              <td style="padding:8px;">${empresa.tipo_empresa}</td></tr>
          <tr style="background:#f8fafc;"><td style="padding:8px;color:#64748b;">Creado por</td>
              <td style="padding:8px;">${creadoPor || 'Sistema'}</td></tr>
        </table>
        <p style="color:#64748b;font-size:0.85em;">Este es un correo automatico. No responder.</p>
      </div>
    `,
  }),

  // Plantilla: un dispositivo supero el umbral de una variable (ej: temperatura, voltaje)
  umbral_telemetria: ({ equipo, variable, valor, limite, unidad }) => ({
    subject: `Alerta de telemetria — ${equipo}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;
                  border:1px solid #fbbf24;border-radius:12px;">
        <h2 style="color:#d97706;">Alerta de telemetria</h2>
        <p>Un dispositivo ha superado el limite configurado:</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:8px;color:#64748b;">Equipo</td>
              <td style="padding:8px;font-weight:bold;">${equipo}</td></tr>
          <tr style="background:#fef3c7;"><td style="padding:8px;color:#64748b;">Variable</td>
              <td style="padding:8px;">${variable}</td></tr>
          <tr><td style="padding:8px;color:#64748b;">Valor actual</td>
              <td style="padding:8px;color:#dc2626;font-weight:bold;">${valor} ${unidad || ''}</td></tr>
          <tr style="background:#fef3c7;"><td style="padding:8px;color:#64748b;">Limite</td>
              <td style="padding:8px;">${limite} ${unidad || ''}</td></tr>
        </table>
        <p style="color:#64748b;font-size:0.85em;">Este es un correo automatico. No responder.</p>
      </div>
    `,
  }),

  // Plantilla: alerta general de monitoreo del sistema (para uso futuro)
  monitoreo: ({ mensaje, detalle }) => ({
    subject: `Alerta de monitoreo — Emeltec`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;
                  border:1px solid #e2e8f0;border-radius:12px;">
        <h2 style="color:#2563eb;">Alerta de monitoreo</h2>
        <p>${mensaje}</p>
        ${detalle ? `<pre style="background:#f1f5f9;padding:12px;border-radius:8px;font-size:0.85em;">${detalle}</pre>` : ''}
        <p style="color:#64748b;font-size:0.85em;">Este es un correo automatico. No responder.</p>
      </div>
    `,
  }),

  // Plantilla: el pipeline Go fallo al procesar un archivo de telemetria.
  // Se envia cuando csvprocessor agota los 3 reintentos y mueve el archivo a failed_logs.
  error_archivo: ({ archivo, error, intentos, carpeta }) => ({
    subject: `Error en pipeline de telemetria — ${archivo}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;
                  border:1px solid #f72a2a;border-radius:12px;">
        <h2 style="color:#dc2626;">Error en pipeline de telemetria</h2>
        <p>El servicio de ingesta no pudo procesar un archivo despues de ${intentos} intentos:</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr>
            <td style="padding:8px;color:#64748b;width:130px;">Archivo</td>
            <td style="padding:8px;font-weight:bold;font-family:monospace;">${archivo}</td>
          </tr>
          <tr style="background:#fef2f2;">
            <td style="padding:8px;color:#64748b;">Error</td>
            <td style="padding:8px;color:#dc2626;">${error}</td>
          </tr>
          <tr>
            <td style="padding:8px;color:#64748b;">Intentos</td>
            <td style="padding:8px;">${intentos}</td>
          </tr>
          <tr style="background:#fef2f2;">
            <td style="padding:8px;color:#64748b;">Ubicacion</td>
            <td style="padding:8px;font-family:monospace;">${carpeta}/</td>
          </tr>
        </table>
        <p style="color:#92400e;background:#fef3c7;padding:12px;border-radius:8px;">
          El archivo fue movido a <strong>${carpeta}/</strong> para reintento automatico.
          Verificar el pipeline si el problema persiste.
        </p>
        <p style="color:#64748b;font-size:0.85em;">Este es un correo automatico. No responder.</p>
      </div>
    `,
  }),

};

/**
 * Envia una alerta por correo a una lista de destinatarios.
 *
 * @param {string}   tipo     - Tipo de alerta. Debe ser una clave de `templates`.
 * @param {string[]} destinos - Array de emails a quienes se envia el correo.
 * @param {object}   datos    - Objeto con los datos que rellena la plantilla.
 * @returns {{ ok: boolean, id?: string, error?: string }}
 */
exports.enviarAlerta = async (tipo, destinos, datos) => {
  // Si no hay destinatarios, no se hace nada (ej: no hay SuperAdmins registrados aun)
  if (!destinos || destinos.length === 0) {
    console.log(`⚠️  alertService: sin destinatarios para alerta tipo "${tipo}"`);
    return { ok: true, skipped: true };
  }

  // Verificar que el tipo de alerta tenga plantilla definida
  const buildTemplate = templates[tipo];
  if (!buildTemplate) {
    console.error(`❌ alertService: tipo de alerta desconocido "${tipo}"`);
    return { ok: false, error: `Tipo desconocido: ${tipo}` };
  }

  // Construir el contenido del correo a partir de los datos recibidos
  const { subject, html } = buildTemplate(datos);

  try {
    const client = getClient();

    // Llamada a la API de Resend para enviar el correo
    const { data, error } = await client.emails.send({
      from: 'noreply <noreply@emeltec.cl>', // direccion remitente verificada
      to: destinos,
      subject,
      html,
    });

    if (error) {
      console.error(`❌ alertService Resend error:`, error.message);
      return { ok: false, error: error.message };
    }

    console.log(`📧 Alerta "${tipo}" enviada a [${destinos.join(', ')}]. ID: ${data.id}`);
    return { ok: true, id: data.id };

  } catch (err) {
    console.error(`❌ alertService excepcion:`, err.message);
    return { ok: false, error: err.message };
  }
};
