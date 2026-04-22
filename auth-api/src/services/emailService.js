const { Resend } = require('resend');

let resend = null;

function getClient() {
  if (resend) return resend;
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY no está definida en el .env');
  }
  resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

/**
 * Envía el código OTP de acceso al usuario.
 */
exports.sendOTPEmail = async (emailDestino, nombreCompleto, otpCode, minutes = 30) => {
  try {
    const client = getClient();

    const { data, error } = await client.emails.send({
      from: 'Emeltec — Panel Industrial <noreply@emeltec.cl>',
      to: [emailDestino],
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

    if (error) {
      console.error('❌ Error Resend:', error.message);
      return { ok: false, error: error.message };
    }

    console.log('📧 Correo enviado via Resend. ID:', data.id);
    return { ok: true, id: data.id };

  } catch (err) {
    console.error('❌ Error al enviar correo:', err.message);
    return { ok: false, error: err.message };
  }
};
