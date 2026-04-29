const nodemailer = require('nodemailer');

let transporter = null;

function hasUsableSmtpConfig() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!process.env.SMTP_HOST || !user || !pass) return false;
  if (user === 'tu-correo@gmail.com') return false;
  if (pass.includes('xxxx')) return false;
  return true;
}

async function initTransporter() {
  if (transporter) return transporter;

  if (hasUsableSmtpConfig()) {
    const isPort465 = process.env.SMTP_PORT === '465';
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: isPort465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    return transporter;
  }

  console.log('No se detectaron credenciales SMTP fijas. Generando cuenta de pruebas en Ethereal...');
  const testAccount = await nodemailer.createTestAccount();

  transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });

  console.log('SMTP Ethereal (Pruebas) configurado con exito.');
  return transporter;
}

const SEVERIDAD_COLOR = {
  critica: '#dc2626',
  alta: '#ea580c',
  media: '#d97706',
  baja: '#65a30d',
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function labelSeveridad(severidad) {
  const labels = {
    critica: 'CRITICA',
    alta: 'ALTA',
    media: 'MEDIA',
    baja: 'BAJA',
  };
  return labels[severidad] || String(severidad || 'ALERTA').toUpperCase();
}

exports.sendAlertEmail = async (emailDestino, nombreCompleto, mensaje, regla) => {
  try {
    const tp = await initTransporter();
    const color = SEVERIDAD_COLOR[regla.severidad] || '#64748b';
    const alias = regla.reg_alias || regla.variable_key;
    const sitio = regla.sitio_desc || regla.sitio_id;
    const severidad = labelSeveridad(regla.severidad);
    const valorDetectado = regla.valor_detectado ?? 'sin dato disponible';
    const condicion = regla.condicion_texto || regla.condicion;
    const serial = regla.id_serial || 'N/A';

    const result = await tp.sendMail({
      from: '"Monitor de Alertas" <no-reply@monitoreo-industrial.com>',
      to: emailDestino,
      subject: `[${severidad}] ${sitio} - ${alias}`,
      text: [
        `Hola ${nombreCompleto},`,
        '',
        mensaje,
        '',
        `Severidad: ${severidad}`,
        `Sitio: ${sitio}`,
        `Equipo: ${serial}`,
        `Variable: ${alias}`,
        `Valor detectado: ${valorDetectado}`,
        `Regla: ${condicion}`,
        `Nombre alerta: ${regla.nombre}`,
      ].join('\n'),
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;border:1px solid #ddd;border-radius:10px;">
          <div style="background:${color};color:#fff;padding:12px 20px;border-radius:8px 8px 0 0;">
            <h2 style="margin:0;font-size:1.1em;">Alerta Industrial - ${escapeHtml(severidad)}</h2>
          </div>
          <div style="padding:20px;background:#f8fafc;">
            <p>Hola <strong>${escapeHtml(nombreCompleto)}</strong>,</p>
            <p style="font-size:1.05em;color:#1e293b;line-height:1.5;">${escapeHtml(mensaje)}</p>
            <table style="width:100%;border-collapse:collapse;margin-top:16px;">
              <tr><td style="padding:8px;font-weight:bold;color:#475569;">Severidad</td><td style="padding:8px;">${escapeHtml(severidad)}</td></tr>
              <tr style="background:#e2e8f0;"><td style="padding:8px;font-weight:bold;color:#475569;">Sitio</td><td style="padding:8px;">${escapeHtml(sitio)}</td></tr>
              <tr><td style="padding:8px;font-weight:bold;color:#475569;">Equipo</td><td style="padding:8px;">${escapeHtml(serial)}</td></tr>
              <tr style="background:#e2e8f0;"><td style="padding:8px;font-weight:bold;color:#475569;">Variable</td><td style="padding:8px;">${escapeHtml(alias)}</td></tr>
              <tr><td style="padding:8px;font-weight:bold;color:#475569;">Valor detectado</td><td style="padding:8px;">${escapeHtml(valorDetectado)}</td></tr>
              <tr style="background:#e2e8f0;"><td style="padding:8px;font-weight:bold;color:#475569;">Regla</td><td style="padding:8px;">${escapeHtml(condicion)}</td></tr>
              <tr><td style="padding:8px;font-weight:bold;color:#475569;">Nombre alerta</td><td style="padding:8px;">${escapeHtml(regla.nombre)}</td></tr>
            </table>
          </div>
          <p style="text-align:center;color:#94a3b8;font-size:0.8em;margin-top:16px;">
            Plataforma de Monitoreo Industrial - no responder a este correo
          </p>
        </div>
      `,
    });

    const previewUrl = nodemailer.getTestMessageUrl(result);
    if (previewUrl) console.log('Ver alerta simulada aqui: %s', previewUrl);
  } catch (error) {
    console.error('[emailService] Error enviando alerta a', emailDestino, ':', error.message);
  }
};

exports.sendNewUserNotificationToAdmin = async (emailAdmin, nombreAdmin, datosUsuario) => {
  try {
    const tp = await initTransporter();
    await tp.sendMail({
      from: '"Panel de Control Telemetria" <no-reply@monitoreo-industrial.com>',
      to: emailAdmin,
      subject: `Nuevo usuario registrado: ${datosUsuario.nombre}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;border:1px solid #ddd;border-radius:10px;">
          <h2 style="color:#2563eb;">Nuevo Usuario Registrado</h2>
          <p>Hola <strong>${escapeHtml(nombreAdmin)}</strong>,</p>
          <p>Se ha creado una nueva cuenta en la plataforma:</p>
          <div style="background:#f8fafc;padding:15px;border-radius:5px;margin:20px 0;">
            <p><strong>Nombre:</strong> ${escapeHtml(datosUsuario.nombre)}</p>
            <p><strong>Email:</strong> ${escapeHtml(datosUsuario.email)}</p>
            <p><strong>Tipo:</strong> ${escapeHtml(datosUsuario.tipo)}</p>
          </div>
          <p style="color:#64748b;font-size:0.9em;">Plataforma de Monitoreo Industrial - no responder a este correo</p>
        </div>
      `,
    });
  } catch (error) {
    console.error('[emailService] Error notificando admin de nuevo usuario:', error.message);
  }
};

exports.sendWelcomeEmail = async (emailDestino, nombreCompleto, passwordGenerado) => {
  try {
    const tp = await initTransporter();

    const result = await tp.sendMail({
      from: '"Panel de Control Telemetria" <no-reply@monitoreo-industrial.com>',
      to: emailDestino,
      subject: 'Tus nuevas credenciales de acceso',
      text: `Hola ${nombreCompleto}, tu cuenta ha sido creada. Tu contrasena temporal es: ${passwordGenerado}. Recuerda cambiarla al ingresar.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
          <h2 style="color: #2563eb;">Bienvenido a tu Panel de Telemetria</h2>
          <p>Hola <strong>${escapeHtml(nombreCompleto)}</strong>,</p>
          <p>Tu cuenta corporativa ha sido creada exitosamente. A continuacion encontraras tus credenciales de inicio de sesion iniciales:</p>
          <div style="background-color: #f8fafc; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>URL de Acceso:</strong> <a href="http://localhost:5173/login">http://localhost:5173/login</a></p>
            <p><strong>Usuario:</strong> ${escapeHtml(emailDestino)}</p>
            <p><strong>Contrasena Temporal:</strong> <span style="font-size: 1.2em; letter-spacing: 2px; color: #1e293b;">${escapeHtml(passwordGenerado)}</span></p>
          </div>
          <p style="color: #64748b; font-size: 0.9em;">Por razones de seguridad, recuerda no compartir estas credenciales con otras personas.</p>
        </div>
      `,
    });

    console.log('-----------------------------------------');
    console.log('Correo enviado con exito a:', emailDestino);
    console.log('Ver correo simulado aqui: %s', nodemailer.getTestMessageUrl(result));
    console.log('-----------------------------------------');

    return { ok: true, previewUrl: nodemailer.getTestMessageUrl(result) };
  } catch (error) {
    console.error('Error al enviar el correo:', error);
    return { ok: false, error: error.message };
  }
};
