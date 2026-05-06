/**
 * Controladores de utilidades para pozos de agua.
 * - Conversion IEEE 754: dos registros Modbus -> float32, periodo de guardado
 * - Calculo de nivel freatico desde ultima lectura
 * - Conversion de caudal m³/h → l/s
 */
const pool = require("../config/db");
const { registrosModbusAFloat32 } = require("../utils/ieee754");
const { calcularNivelFreatico }   = require("../utils/nivelFreatico");
const { getLatestSerialId }       = require("../utils/serial");

/**
 * POST /api/pozos/ieee754
 *
 * Convierte dos registros Modbus a Float32 IEEE 754 para un bucket de tiempo.
 * Los nombres de registro pueden ser cualquier clave presente en equipo.data.
 *
 * Body:
 *   serial_id  {string}   ID del equipo. Si se omite, usa el mas reciente.
 *   reg_alta   {string}   Nombre del registro High Word (ej: "REG5", "AI3").
 *   reg_baja   {string}   Nombre del registro Low Word  (ej: "REG6", "AI4").
 *   periodo      {string}   day, week, month o year.
 *   bucket_start {string}   Inicio ISO del bucket seleccionado.
 *   word_swap    {boolean}  Intercambia el orden de los words (default: false).
 */
async function convertirIEEE754(req, res, next) {
  try {
    const { serial_id, reg_alta, reg_baja, periodo = "day", bucket_start, word_swap = false } = req.body;

    if (!reg_alta || !reg_baja) {
      return res.status(400).json({
        ok: false,
        message: '"reg_alta" y "reg_baja" son obligatorios.',
      });
    }

    const serialId = serial_id || (await getLatestSerialId(pool));
    if (!serialId) {
      return res.status(404).json({ ok: false, message: "No hay equipos disponibles" });
    }

    const bucket = await getBucketRange(periodo, bucket_start, serialId, reg_alta, reg_baja);
    if (!bucket) {
      return res.status(404).json({
        ok: false,
        message: bucket_start
          ? `No hay datos para el bucket "${bucket_start}" en periodo "${periodo}"`
          : `No hay buckets disponibles para el periodo "${periodo}"`,
      });
    }

    const { rows } = await pool.query(
      `SELECT
         data->>$2 AS w_alta,
         data->>$3 AS w_baja,
         TO_CHAR((time AT TIME ZONE 'UTC') - INTERVAL '3 hours', 'YYYY-MM-DD') AS fecha,
         TO_CHAR((time AT TIME ZONE 'UTC') - INTERVAL '3 hours', 'HH24:MI:SS') AS hora
       FROM equipo
       WHERE id_serial = $1
         AND data ? $2
         AND data ? $3
         AND time >= $4
         AND time < $5
       ORDER BY time ASC`,
      [serialId, reg_alta, reg_baja, bucket.range_start, bucket.range_end]
    );

    if (!rows.length) {
      return res.status(404).json({
        ok: false,
        message: `No se encontraron registros "${reg_alta}" y "${reg_baja}" para "${serialId}" en el periodo seleccionado`,
        serial_id: serialId,
        bucket,
      });
    }

    const datos = [];
    const errores = [];

    for (const row of rows) {
      const w1 = Number(row.w_alta);
      const w2 = Number(row.w_baja);

      if (!Number.isInteger(w1) || w1 < 0 || w1 > 65535 ||
          !Number.isInteger(w2) || w2 < 0 || w2 > 65535) {
        errores.push({ fecha: row.fecha, hora: row.hora, w_alta: row.w_alta, w_baja: row.w_baja });
        continue;
      }

      const resultado = registrosModbusAFloat32(w1, w2, Boolean(word_swap));
      datos.push({
        fecha: row.fecha,
        hora:  row.hora,
        valor: resultado.valor,
      });
    }

    return res.json({
      ok: true,
      serial_id: serialId,
      reg_alta,
      reg_baja,
      periodo: bucket,
      word_swap: Boolean(word_swap),
      total: datos.length,
      datos,
      ...(errores.length && { errores_conversion: errores }),
    });
  } catch (err) {
    next(err);
  }
}

const PERIODOS_IEEE754 = {
  day: "1 day",
  week: "1 week",
  month: "1 month",
  year: "1 year",
};

function getPeriodoInterval(periodo) {
  const interval = PERIODOS_IEEE754[periodo];
  if (!interval) {
    const validos = Object.keys(PERIODOS_IEEE754).join(", ");
    throw new Error(`periodo invalido: "${periodo}". Use ${validos}`);
  }
  return interval;
}

async function getBucketRange(periodo, bucketStart, serialId, regAlta, regBaja) {
  const interval = getPeriodoInterval(periodo);
  const params = [serialId, regAlta, regBaja, interval];
  let bucketFilter = "";

  if (bucketStart) {
    params.push(bucketStart);
    bucketFilter = "AND time_bucket($4::interval, time) = $5::timestamptz";
  }

  const { rows } = await pool.query(
    `SELECT
       $4::text AS periodo_intervalo,
       time_bucket($4::interval, time) AS bucket_start,
       time_bucket($4::interval, time) + $4::interval AS range_end,
       time_bucket($4::interval, time) AS range_start,
       TO_CHAR((time_bucket($4::interval, time) AT TIME ZONE 'UTC') - INTERVAL '3 hours', 'YYYY-MM-DD HH24:MI') AS inicio,
       TO_CHAR(((time_bucket($4::interval, time) + $4::interval) AT TIME ZONE 'UTC') - INTERVAL '3 hours', 'YYYY-MM-DD HH24:MI') AS fin,
       COUNT(*)::int AS total
     FROM equipo
     WHERE id_serial = $1
       AND data ? $2
       AND data ? $3
       ${bucketFilter}
     GROUP BY bucket_start
     ORDER BY bucket_start DESC
     LIMIT 1`,
    params
  );

  if (!rows[0]) return null;
  return {
    periodo,
    intervalo: rows[0].periodo_intervalo,
    bucket_start: rows[0].bucket_start,
    range_start: rows[0].range_start,
    range_end: rows[0].range_end,
    inicio: rows[0].inicio,
    fin: rows[0].fin,
    total: rows[0].total,
  };
}

async function listarPeriodosIEEE754(req, res, next) {
  try {
    const { serial_id, reg_alta, reg_baja, periodo = "day" } = req.query;
    const interval = getPeriodoInterval(periodo);
    const serialId = serial_id || (await getLatestSerialId(pool));

    const { rows } = await pool.query(
      `SELECT
         time_bucket($4::interval, time) AS bucket_start,
         time_bucket($4::interval, time) AS range_start,
         time_bucket($4::interval, time) + $4::interval AS range_end,
         TO_CHAR((time_bucket($4::interval, time) AT TIME ZONE 'UTC') - INTERVAL '3 hours', 'YYYY-MM-DD HH24:MI') AS inicio,
         TO_CHAR(((time_bucket($4::interval, time) + $4::interval) AT TIME ZONE 'UTC') - INTERVAL '3 hours', 'YYYY-MM-DD HH24:MI') AS fin,
         COUNT(*)::int AS total
       FROM equipo
       WHERE ($1::text IS NULL OR id_serial = $1)
         AND ($2::text IS NULL OR data ? $2)
         AND ($3::text IS NULL OR data ? $3)
       GROUP BY bucket_start
       ORDER BY bucket_start DESC`,
      [serialId || null, reg_alta || null, reg_baja || null, interval]
    );

    return res.json({
      ok: true,
      serial_id: serialId || null,
      periodo,
      intervalo: interval,
      total: rows.length,
      periodos: rows,
    });
  } catch (err) {
    if (err.message.startsWith("periodo invalido")) {
      return res.status(400).json({ ok: false, message: err.message });
    }
    next(err);
  }
}

/**
 * POST /api/pozos/nivel-freatico
 *
 * Consulta la ultima lectura de nivel del pozo en equipo
 * y calcula el nivel freatico usando los parametros fisicos del pozo.
 *
 * Body:
 *   serial_id          {string}  ID del equipo. Si se omite, usa el mas reciente.
 *   variable_nivel     {string}  Clave dentro del JSON data (default: "nivel_pozo").
 *   profundidad_sensor {number}  Profundidad del sensor desde la superficie [m].
 *   profundidad_total  {number}  Profundidad total del pozo [m].
 */
async function getNivelFreatico(req, res, next) {
  try {
    const {
      serial_id,
      variable_nivel     = "nivel_pozo",
      profundidad_sensor,
      profundidad_total,
    } = req.body;

    if (profundidad_sensor === undefined || profundidad_total === undefined) {
      return res.status(400).json({
        ok: false,
        message: "profundidad_sensor y profundidad_total son obligatorios",
      });
    }

    const profSensor = Number(profundidad_sensor);
    const profTotal  = Number(profundidad_total);

    if (!Number.isFinite(profSensor) || profSensor <= 0) {
      return res.status(400).json({ ok: false, message: "profundidad_sensor debe ser un numero positivo valido" });
    }
    if (!Number.isFinite(profTotal) || profTotal <= 0) {
      return res.status(400).json({ ok: false, message: "profundidad_total debe ser un numero positivo valido" });
    }
    if (profTotal <= profSensor) {
      return res.status(400).json({ ok: false, message: "profundidad_total debe ser mayor que profundidad_sensor" });
    }

    const serialId = serial_id || (await getLatestSerialId(pool));
    if (!serialId) {
      return res.status(404).json({ ok: false, message: "No hay equipos disponibles" });
    }

    const { rows } = await pool.query(
      `SELECT
         id_serial,
         data->>$2 AS lectura,
         TO_CHAR((time AT TIME ZONE 'UTC') - INTERVAL '3 hours', 'YYYY-MM-DD') AS fecha,
         TO_CHAR((time AT TIME ZONE 'UTC') - INTERVAL '3 hours', 'HH24:MI:SS') AS hora
       FROM equipo
       WHERE id_serial = $1
         AND data ? $2
       ORDER BY time DESC
       LIMIT 1`,
      [serialId, variable_nivel]
    );

    if (!rows.length || rows[0].lectura === null) {
      return res.status(404).json({
        ok: false,
        message: `No se encontro la variable "${variable_nivel}" para el equipo "${serialId}"`,
        serial_id: serialId,
        variable_nivel,
      });
    }

    const lecturaPozo = Number(rows[0].lectura);

    if (!Number.isFinite(lecturaPozo)) {
      return res.status(422).json({
        ok: false,
        message: `El valor de "${variable_nivel}" no es numerico: ${rows[0].lectura}`,
      });
    }

    const nivel_freatico_m = calcularNivelFreatico({
      lecturaPozo,
      profundidadSensor: profSensor,
      profundidadTotal:  profTotal,
    });

    return res.json({
      ok: true,
      serial_id: serialId,
      fecha: rows[0].fecha,
      hora:  rows[0].hora,
      lectura_sensor_m: lecturaPozo,
      nivel_freatico_m,
      profundidad_total_m: profTotal,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/pozos/caudal
 *
 * Convierte caudal de m³/h a l/s.
 *
 * Body:
 *   valor  {number}  Caudal en m³/h
 */
function calcularCaudal(req, res) {
  const { valor } = req.body;

  if (valor === undefined) {
    return res.status(400).json({ ok: false, message: '"valor" es obligatorio' });
  }

  const num = Number(valor);

  if (!Number.isFinite(num)) {
    return res.status(400).json({ ok: false, message: "valor debe ser un numero valido" });
  }

  return res.json({
    ok: true,
    entrada:   { valor: num,        unidad: "m³/h" },
    resultado: { valor: num / 3.6,  unidad: "l/s"  },
  });
}

module.exports = { convertirIEEE754, listarPeriodosIEEE754, getNivelFreatico, calcularCaudal };
