const nodemailer = require('nodemailer');

let transporter = null;

async function initTransporter() {
  if (transporter) return transporter;

  if (process.env.SMTP_HOST && process.env.SMTP_USER &&
      process.env.SMTP_PASS && !process.env.SMTP_PASS.includes('xxxx')) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 465,
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    console.log('📧 SMTP Gmail configurado correctamente.');
    return transporter;
  }

  // Modo simulación (sin credenciales reales)
  console.log('⚠️  Sin credenciales SMTP — usando modo simulación (Ethereal)...');
  const testAccount = await nodemailer.createTestAccount();
  transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: { user: testAccount.user, pass: testAccount.pass },
  });
  console.log('✅ SMTP Ethereal listo (modo pruebas).');
  return transporter;
}

/**
 * Envía el código OTP de acceso al usuario.
 */
exports.sendOTPEmail = async (emailDestino, nombreCompleto, otpCode, minutes = 30) => {
  try {
    const tp = await initTransporter();

    const result = await tp.sendMail({
      from: '"Emeltec — Panel Industrial" <no-reply@emeltec.cl>',
      to: emailDestino,
      subject: '🔐 Tu código de acceso — Emeltec',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px;
                    border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #2563eb; margin-bottom: 4px;">Panel Industrial Emeltec</h2>
          <p>Hola <strong>${nombreCompleto}</strong>,</p>
          <p>Tu código de acceso es:</p>
          <div style="background: #f1f5f9; padding: 20px; border-radius: 8px;
                      text-align: center; margin: 20px 0;">
            <span style="font-size: 2.5em; font-weight: bold; letter-spacing: 8px;
                         color: #1e293b;">${otpCode}</span>
          </div>
          <p style="color: #64748b; font-size: 0.9em;">
            Este código es válido por <strong>${minutes} minutos</strong>. No lo compartas con nadie.
          </p>
        </div>
      `,
    });

    const previewUrl = nodemailer.getTestMessageUrl(result);
    if (previewUrl) {
      console.log('─────────────────────────────────────');
      console.log('📨 Ver correo simulado:', previewUrl);
      console.log('─────────────────────────────────────');
    }

    return { ok: true, previewUrl: previewUrl || null };
  } catch (error) {
    console.error('❌ Error al enviar correo:', error.message);
    return { ok: false, error: error.message };
  }
};
