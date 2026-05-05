/**
 * @comentario-codex
 * Job de envio DGA: decide periodicidad, arma el JSON oficial, envia o simula, y registra comprobantes.
 */
const axios  = require('axios');
const pool   = require('../config/db');
const { dgaApiUrl, dgaMockMode } = require('../config/env');

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatFechaMedicion(date) {
  const d = new Date(date);
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}

function formatHoraMedicion(date) {
  const d = new Date(date);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function stringifyMedicion(value, fallback = '0.0') {
  if (value === null || value === undefined) return fallback;
  if (Number.isNaN(Number(value))) return fallback;
  return String(value);
}

// Arma el JSON que exige la API DGA para una medicion.
function buildDgaJson(medicion) {
  return {
    status: '00',
    message: '',
    data: {
      fechaMedicion: formatFechaMedicion(medicion.time),
      horaMedicion: formatHoraMedicion(medicion.time),
      caudal: stringifyMedicion(medicion.caudal),
      totalizador: stringifyMedicion(medicion.totalizador, '0'),
      nivelFreaticoDelPozo: stringifyMedicion(medicion.nivel_freatico),
    },
  };
}

// Duracion minima entre envios segun la periodicidad configurada para cada sitio.
const INTERVALO_MS = {
  minuto: 60 * 1000,
  hora:   60 * 60 * 1000,
  dia:    24 * 60 * 60 * 1000,
  semana: 7  * 24 * 60 * 60 * 1000,
  mes:    30 * 24 * 60 * 60 * 1000,
  anio:   365 * 24 * 60 * 60 * 1000,
};

// Determina si ya corresponde enviar otro reporte para el sitio.
function debeEnviar(periodicidad, ultimoEnvio) {
  if (!ultimoEnvio) return true;
  const elapsed = Date.now() - new Date(ultimoEnvio).getTime();
  return elapsed >= (INTERVALO_MS[periodicidad] ?? INTERVALO_MS.hora);
}

// Construye el JSON DGA, lo envia o simula, y registra el comprobante en la base de datos.
async function ejecutarEnvio(sitio_id) {
  const { rows: configs } = await pool.query(
    `SELECT du.*, s.id_serial
     FROM dga_user du
     JOIN sitio s ON s.id = du.sitio_id
     WHERE du.sitio_id = $1 AND du.activo = TRUE`,
    [sitio_id]
  );

  if (!configs.length) {
    const err = new Error('Config DGA no encontrada para el sitio');
    err.status = 404;
    throw err;
  }

  const config = configs[0];

  const { rows: [lastEnvio] } = await pool.query(
    "SELECT MAX(periodo_fin) AS ultimo FROM dga_reporte WHERE sitio_id = $1 AND estatus = 'enviado'",
    [sitio_id]
  );
  const since = lastEnvio.ultimo || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Se envian solo datos consolidados posteriores al ultimo periodo enviado correctamente.
  const { rows: datos } = await pool.query(
    `SELECT * FROM dga_datos
     WHERE sitio_id = $1 AND time > $2
     ORDER BY time ASC`,
    [sitio_id, since]
  );

  if (!datos.length) {
    const err = new Error('No hay datos nuevos para enviar');
    err.status = 404;
    throw err;
  }

  const periodo_inicio = datos[0].time;
  const periodo_fin    = datos[datos.length - 1].time;

  // Resumen del periodo: promedios para nivel/caudal y ultima lectura para totalizador.
  const avg = (key) => datos.reduce((s, r) => s + (Number(r[key]) || 0), 0) / datos.length;
  const nivel_freatico = avg('nivel_freatico');
  const caudal         = avg('caudal');
  const totalizador    = datos[datos.length - 1].totalizador;

  const payload = buildDgaJson(datos[datos.length - 1]);

  let estatus     = 'pendiente';
  let comprobante = null;

  if (dgaMockMode) {
    // En modo mock se marca como enviado para poder validar pantallas y reportes localmente.
    estatus     = 'enviado';
    comprobante = payload;
    console.log(`[dga-api][Cron2][MOCK] Simulating DGA response for sitio ${config.sitio_id}`);
  } else {
    try {
      const response = await axios.post(`${dgaApiUrl}/reporte`, payload, {
        timeout: 30000,
        headers: { 'Content-Type': 'application/json' },
      });
      estatus     = 'enviado';
      comprobante = response.data;
    } catch (err) {
      estatus     = 'rechazado';
      comprobante = {
        error:  err.message,
        status: err.response?.status ?? null,
        detail: err.response?.data   ?? null,
      };
    }
  }

  const { rows: [reporte] } = await pool.query(
    `INSERT INTO dga_reporte
       (dga_user_id, sitio_id, periodo_inicio, periodo_fin,
        nivel_freatico, caudal, totalizador, estatus, comprobante, enviado_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
     RETURNING *`,
    [config.id, sitio_id, periodo_inicio, periodo_fin,
     nivel_freatico, caudal, totalizador, estatus, JSON.stringify(comprobante)]
  );

  // Mantiene la configuracion con el ultimo estado/comprobante visible para consultas rapidas.
  await pool.query(
    `UPDATE dga_user SET estatus = $1, comprobante = $2, updated_at = NOW() WHERE id = $3`,
    [estatus, JSON.stringify(comprobante), config.id]
  );

  return { ...reporte, dga_json: payload };
}

// Recorre todos los sitios activos y envia solo los que ya cumplieron su periodicidad.
async function sendPendientes() {
  const { rows: configs } = await pool.query(
    'SELECT sitio_id, periodicidad FROM dga_user WHERE activo = TRUE'
  );

  for (const { sitio_id, periodicidad } of configs) {
    try {
      const { rows: [last] } = await pool.query(
        "SELECT MAX(enviado_at) AS ultimo FROM dga_reporte WHERE sitio_id = $1 AND estatus = 'enviado'",
        [sitio_id]
      );
      if (!debeEnviar(periodicidad, last.ultimo)) continue;
      await ejecutarEnvio(sitio_id);
    } catch (err) {
      if (err.status !== 404) {
        console.error(`[dga-api][Cron2] Error enviando sitio ${sitio_id}:`, err.message);
      }
    }
  }
}

module.exports = { ejecutarEnvio, sendPendientes };
