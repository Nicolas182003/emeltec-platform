/**
 * alertService.js — Servicio de envío de correos de alerta usando Resend.
 *
 * Este módulo es responsable ÚNICAMENTE de construir el HTML del correo
 * y enviarlo a través de la API de Resend desde la dirección suport@emeltec.cl.
 * No decide a quién enviar — eso lo hace alertDispatcher.js.
 *
 * Tipos de alerta soportados:
 *   - usuario_creado    : se registró un nuevo usuario en el sistema
 *   - empresa_creada    : se registró una nueva empresa
 *   - umbral_telemetria : un dispositivo superó un límite de medición
 *   - monitoreo         : alerta general del sistema (placeholder para futuro)
 */

const { Resend } = require('resend');

// Instancia única del cliente Resend (se crea la primera vez que se usa)
let resend = null;

/**
 * Retorna el cliente Resend inicializado.
 * Lanza error si falta la API key en el .env.
 */
function getClient() {
  if (resend) return resend;
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY no está definida en el .env de main-api');
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
    subject: `👤 Nuevo usuario registrado — ${nuevoUsuario.tipo}`,
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
        <p style="color:#64748b;font-size:0.85em;">Este es un correo automático. No responder.</p>
      </div>
    `,
  }),

  // Plantilla: nueva empresa registrada en el sistema
  empresa_creada: ({ empresa, creadoPor }) => ({
    subject: `🏢 Nueva empresa registrada — ${empresa.nombre}`,
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
        <p style="color:#64748b;font-size:0.85em;">Este es un correo automático. No responder.</p>
      </div>
    `,
  }),

  // Plantilla: un dispositivo superó el umbral de una variable (ej: temperatura, voltaje)
  umbral_telemetria: ({ equipo, variable, valor, limite, unidad }) => ({
    subject: `⚠️ Alerta de telemetría — ${equipo}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;
                  border:1px solid #fbbf24;border-radius:12px;">
        <h2 style="color:#d97706;">⚠️ Alerta de telemetría</h2>
        <p>Un dispositivo ha superado el límite configurado:</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:8px;color:#64748b;">Equipo</td>
              <td style="padding:8px;font-weight:bold;">${equipo}</td></tr>
          <tr style="background:#fef3c7;"><td style="padding:8px;color:#64748b;">Variable</td>
              <td style="padding:8px;">${variable}</td></tr>
          <tr><td style="padding:8px;color:#64748b;">Valor actual</td>
              <td style="padding:8px;color:#dc2626;font-weight:bold;">${valor} ${unidad || ''}</td></tr>
          <tr style="background:#fef3c7;"><td style="padding:8px;color:#64748b;">Límite</td>
              <td style="padding:8px;">${limite} ${unidad || ''}</td></tr>
        </table>
        <p style="color:#64748b;font-size:0.85em;">Este es un correo automático. No responder.</p>
      </div>
    `,
  }),

  // Plantilla: alerta general de monitoreo del sistema (para uso futuro)
  monitoreo: ({ mensaje, detalle }) => ({
    subject: `🔔 Alerta de monitoreo — Emeltec`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;
                  border:1px solid #e2e8f0;border-radius:12px;">
        <h2 style="color:#2563eb;">Alerta de monitoreo</h2>
        <p>${mensaje}</p>
        ${detalle ? `<pre style="background:#f1f5f9;padding:12px;border-radius:8px;font-size:0.85em;">${detalle}</pre>` : ''}
        <p style="color:#64748b;font-size:0.85em;">Este es un correo automático. No responder.</p>
      </div>
    `,
  }),
};

/**
 * Envía una alerta por correo a una lista de destinatarios.
 *
 * @param {string}   tipo     - Tipo de alerta. Debe ser una clave de `templates`.
 * @param {string[]} destinos - Array de emails a quienes se envía el correo.
 * @param {object}   datos    - Objeto con los datos que rellena la plantilla.
 * @returns {{ ok: boolean, id?: string, error?: string }}
 */
exports.enviarAlerta = async (tipo, destinos, datos) => {
  // Si no hay destinatarios, no se hace nada (ej: no hay SuperAdmins registrados aún)
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
      from: 'Emeltec Alertas <suport@emeltec.cl>', // dirección remitente verificada
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
    console.error(`❌ alertService excepción:`, err.message);
    return { ok: false, error: err.message };
  }
};
