/**
 * @comentario-codex
 * Job de normalizacion DGA: toma lecturas crudas por registro y consolida datos en dga_datos.
 */
const pool = require('../config/db');

// Redondea una fecha al inicio del periodo configurado para agrupar lecturas.
function getBucketFloor(date, periodicidad) {
  const d = new Date(date);
  switch (periodicidad) {
    case 'minuto': return new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes());
    case 'hora':   return new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours());
    case 'dia':    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    case 'semana': return new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());
    case 'mes':    return new Date(d.getFullYear(), d.getMonth(), 1);
    case 'anio':   return new Date(d.getFullYear(), 0, 1);
    default:       return new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours());
  }
}

// Agrupa lecturas crudas de equipo por periodo DGA y calcula los valores consolidados.
function agruparPorBucket(rows, periodicidad, config) {
  const buckets = new Map();

  for (const row of rows) {
    const key = getBucketFloor(row.time, periodicidad).toISOString();
    if (!buckets.has(key)) buckets.set(key, { count: 0, nf: 0, caudal: 0, totalizador: null });
    const b = buckets.get(key);
    const data = row.data;

    // Los nombres de registro vienen desde la configuracion DGA del sitio.
    if (config.reg_nivel_freatico && data[config.reg_nivel_freatico] != null) {
      b.nf += Number(data[config.reg_nivel_freatico]);
    }
    if (config.reg_caudal && data[config.reg_caudal] != null) {
      b.caudal += Number(data[config.reg_caudal]);
    }
    if (config.reg_totalizador && data[config.reg_totalizador] != null) {
      const val = Number(data[config.reg_totalizador]);
      if (!isNaN(val)) b.totalizador = val;
    }
    b.count++;
  }

  return Array.from(buckets.entries()).map(([time, b]) => ({
    time:           new Date(time),
    nivel_freatico: b.count > 0 ? b.nf / b.count : null,
    caudal:         b.count > 0 ? b.caudal / b.count : null,
    totalizador:    b.totalizador,
  }));
}

// Toma datos nuevos desde equipo y los deja normalizados en dga_datos para envios posteriores.
async function populateDgaDatos() {
  const { rows: configs } = await pool.query(`
    SELECT du.*, s.id_serial
    FROM dga_user du
    JOIN sitio s ON s.id = du.sitio_id
    WHERE du.activo = TRUE
  `);

  for (const config of configs) {
    try {
      const { rows: [last] } = await pool.query(
        'SELECT MAX(time) AS last_time FROM dga_datos WHERE sitio_id = $1',
        [config.sitio_id]
      );
      const since = last.last_time || new Date(Date.now() - 24 * 60 * 60 * 1000);

      // Solo se reprocesan lecturas posteriores al ultimo dato DGA guardado para este sitio.
      const { rows: equipoData } = await pool.query(
        'SELECT time, data FROM equipo WHERE id_serial = $1 AND time > $2 ORDER BY time ASC',
        [config.id_serial, since]
      );

      if (!equipoData.length) continue;

      const grupos = agruparPorBucket(equipoData, config.periodicidad, config);
      for (const g of grupos) {
        // Evita duplicar datos cuando el cron se ejecuta mas de una vez sobre el mismo periodo.
        await pool.query(
          `INSERT INTO dga_datos (time, sitio_id, nivel_freatico, caudal, totalizador)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (time, sitio_id) DO NOTHING`,
          [g.time, config.sitio_id, g.nivel_freatico, g.caudal, g.totalizador]
        );
      }
    } catch (err) {
      console.error(`[dga-api][Cron1] Error procesando sitio ${config.sitio_id}:`, err.message);
    }
  }
}

module.exports = { populateDgaDatos };
