/**
 * @comentario-codex
 * Programa los jobs periodicos de dga-api para poblar datos y enviar reportes cuando corresponda.
 */
const cron = require('node-cron');
const { populateDgaDatos } = require('./cron1-populate');
const { sendPendientes }   = require('./cron2-send');

function startCrons() {
  // Cron 1 (alta prioridad): pobla dga_datos cada minuto
  cron.schedule('* * * * *', async () => {
    try { await populateDgaDatos(); }
    catch (err) { console.error('[dga-api][Cron1]', err.message); }
  });

  // Cron 2: evalÃºa y envÃ­a a la DGA cada 5 minutos (debeEnviar filtra por periodicidad)
  cron.schedule('*/5 * * * *', async () => {
    try { await sendPendientes(); }
    catch (err) { console.error('[dga-api][Cron2]', err.message); }
  });

  console.log('[dga-api] Crons iniciados â€” Cron1: cada minuto | Cron2: cada 5 min');
}

module.exports = { startCrons };

