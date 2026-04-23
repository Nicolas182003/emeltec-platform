const nodemailer = require('nodemailer');

// Singleton o Inicializador Async del transporter
let transporter = null;

async function initTransporter() {
  if (transporter) return transporter;

  // Si tienes credenciales reales de un proveedor (Gmail, Sendgrid), configúralas en .env
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    const isPort465 = process.env.SMTP_PORT === '465';
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: isPort465, // true para port 465, false para otros puertos
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    return transporter;
  }

  // De lo contrario, usar una cuenta gratuita temporal Ethereal para Desarrollo/Pruebas
  console.log("No se detectaron credenciales SMTP fijas. Generando cuenta de pruebas en Ethereal...");
  const testAccount = await nodemailer.createTestAccount();
  
  transporter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });
  
  console.log("SMTP Ethereal (Pruebas) configurado con éxito.");
  return transporter;
}

exports.sendWelcomeEmail = async (emailDestino, nombreCompleto, passwordGenerado) => {
  try {
    const tp = await initTransporter();

    const result = await tp.sendMail({
      from: '"Panel de Control Telemetría" <no-reply@monitoreo-industrial.com>',
      to: emailDestino,
      subject: "Tus nuevas credenciales de acceso",
      text: `Hola ${nombreCompleto}, tu cuenta ha sido creada. Tu contraseña temporal es: ${passwordGenerado}. Recuerda cambiarla al ingresar.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
          <h2 style="color: #2563eb;">Bienvenido a tu Panel de Telemetría</h2>
          <p>Hola <strong>${nombreCompleto}</strong>,</p>
          <p>Tu cuenta corporativa ha sido creada exitosamente. A continuación encontrarás tus credenciales de inicio de sesión iniciales:</p>
          <div style="background-color: #f8fafc; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>URL de Acceso:</strong> <a href="http://localhost:4200/login">http://localhost:4200/login</a></p>
            <p><strong>Usuario:</strong> ${emailDestino}</p>
            <p><strong>Contraseña Temporal:</strong> <span style="font-size: 1.2em; letter-spacing: 2px; color: #1e293b;">${passwordGenerado}</span></p>
          </div>
          <p style="color: #64748b; font-size: 0.9em;">Por razones de seguridad, recuerda no compartir estas credenciales con otras personas.</p>
        </div>
      `,
    });

    console.log("-----------------------------------------");
    console.log("Correo Enviado con éxito a:", emailDestino);
    // IMPORTANTE: Esto mostrará un enlace visual en la consola para ver qué correo se envió si usamos la capa de pruebas.
    console.log("Ver correo simulado aquí: %s", nodemailer.getTestMessageUrl(result));
    console.log("-----------------------------------------");

    return { ok: true, previewUrl: nodemailer.getTestMessageUrl(result) };
  } catch (error) {
    console.error("Error al enviar el correo:", error);
    return { ok: false, error: error.message };
  }
};
