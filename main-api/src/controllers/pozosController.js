/**
 * Controladores de utilidades para pozos de agua.
 * - Conversion IEEE 754 de 32 bits a partir de registros Modbus, hex o bytes raw
 * - Calculo de nivel freatico a partir de logs + parametros del usuario
 */
const pool = require("../config/db");
const { registrosModbusAFloat32 } = require("../utils/ieee754");
const { calcularNivelFreatico } = require("../utils/nivelFreatico");
const { m3hALs } = require("../utils/caudal");
const { getLatestSerialId } = require("../utils/serial");

/**
 * POST /api/pozos/ieee754
 *
 * Calculadora pura IEEE 754 — el usuario provee todos los datos, sin acceso a DB.
 *
 * Body:
 *   palabras   {[number, number]}  Dos valores de 16 bits (0–65535).
 *                                  palabras[0] = primer word  (High por defecto)
 *                                  palabras[1] = segundo word (Low  por defecto)
 *   word_swap  {boolean}           Intercambia el orden de los dos words (default: false).
 *                                  false → [0] primero, ABCD (Big-Endian estandar)
 *                                  true  → [1] primero, CDAB (Schneider, ABB, Siemens)
 */
async function convertirIEEE754(req, res, next) {
  try {
    const { palabras, word_swap = false } = req.body;

    if (!Array.isArray(palabras) || palabras.length !== 2) {
      return res.status(400).json({
        ok: false,
        message: '"palabras" debe ser un array con exactamente 2 valores de 16 bits. Ej: [18543, 22683]',
      });
    }

    const w1 = Number(palabras[0]);
    const w2 = Number(palabras[1]);

    if (!Number.isInteger(w1) || w1 < 0 || w1 > 65535) {
      return res.status(400).json({
        ok: false,
        message: `palabras[0] debe ser un entero entre 0 y 65535, se recibio: ${palabras[0]}`,
      });
    }
    if (!Number.isInteger(w2) || w2 < 0 || w2 > 65535) {
      return res.status(400).json({
        ok: false,
        message: `palabras[1] debe ser un entero entre 0 y 65535, se recibio: ${palabras[1]}`,
      });
    }

    const resultado = registrosModbusAFloat32(w1, w2, Boolean(word_swap));

    return res.json({
      ok: true,
      valor: resultado.valor,
      hex: resultado.hex,
      word_swap: resultado.word_swap,
      detalle: resultado.detalle,
    });
  } catch (err) {
    if (err.message.includes("debe ser")) {
      return res.status(400).json({ ok: false, message: err.message });
    }
    next(err);
  }
}

/**
 * POST /api/pozos/nivel-freatico
 *
 * Consulta la última lectura de nivel del pozo en la tabla `equipo` y
 * calcula el nivel freático usando los parámetros físicos del pozo.
 *
 * Body:
 *   serial_id          {string}  ID del equipo. Si se omite, usa el más reciente.
 *   variable_nivel     {string}  Clave dentro del JSON `data` (default: "nivel_pozo").
 *   profundidad_sensor {number}  Profundidad del sensor desde la superficie [m].
 *   profundidad_total  {number}  Profundidad total del pozo [m].
 */
async function getNivelFreatico(req, res, next) {
  try {
    const {
      serial_id,
      variable_nivel = "nivel_pozo",
      profundidad_sensor,
      profundidad_total,
    } = req.body;

    if (profundidad_sensor === undefined || profundidad_total === undefined) {
      return res.status(400).json({
        ok: false,
        message: "Los parametros profundidad_sensor y profundidad_total son obligatorios",
      });
    }

    const profSensor = Number(profundidad_sensor);
    const profTotal  = Number(profundidad_total);

    if (!Number.isFinite(profSensor) || profSensor <= 0) {
      return res.status(400).json({
        ok: false,
        message: "profundidad_sensor debe ser un numero positivo valido",
      });
    }

    if (!Number.isFinite(profTotal) || profTotal <= 0) {
      return res.status(400).json({
        ok: false,
        message: "profundidad_total debe ser un numero positivo valido",
      });
    }

    if (profTotal <= profSensor) {
      return res.status(400).json({
        ok: false,
        message: "profundidad_total debe ser mayor que profundidad_sensor",
      });
    }

    const serialId = serial_id || (await getLatestSerialId(pool));
    if (!serialId) {
      return res.status(404).json({
        ok: false,
        message: "No hay equipos disponibles",
      });
    }

    const { rows } = await pool.query(
      `
      SELECT
        serial_id,
        data->>$2                                                          AS lectura,
        TO_CHAR((ts AT TIME ZONE 'UTC') - INTERVAL '3 hours', 'YYYY-MM-DD') AS fecha,
        TO_CHAR((ts AT TIME ZONE 'UTC') - INTERVAL '3 hours', 'HH24:MI:SS') AS hora
      FROM ts_pozos
      WHERE serial_id = $1
        AND data ? $2
      ORDER BY ts DESC
      LIMIT 1
      `,
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
      profundidadTotal: profTotal,
    });

    return res.json({
      ok: true,
      serial_id: serialId,
      fecha: rows[0].fecha,
      hora: rows[0].hora,
      lectura_sensor_m: lecturaPozo,
      nivel_freatico_m,
      profundidad_total_m: profTotal,
    });
  } catch (err) {
    if (err.message.includes("debe ser")) {
      return res.status(400).json({ ok: false, message: err.message });
    }
    next(err);
  }
}

/**
 * POST /api/pozos/caudal
 *
 * Convierte caudal de m³/h a l/s.
 * Formula: l/s = m³/h / 3.6
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
    entrada: { valor: num, unidad: "m³/h" },
    resultado: { valor: num / 3.6, unidad: "l/s" },
  });
}

module.exports = { convertirIEEE754, getNivelFreatico, calcularCaudal };
