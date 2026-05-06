function round(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * @param {object} params
 * @param {number} params.lecturaPozo        Lectura del sensor [m] — columna de agua sobre el sensor
 * @param {number} params.profundidadSensor  Profundidad del sensor desde la superficie [m]
 * @param {number} params.profundidadTotal   Profundidad total del pozo [m]
 * @returns {number} nivel_freatico_m
 */
function calcularNivelFreatico({ lecturaPozo, profundidadSensor, profundidadTotal }) {
  if (!Number.isFinite(lecturaPozo)) {
    throw new Error("lectura_pozo debe ser un numero finito");
  }
  if (!Number.isFinite(profundidadSensor) || profundidadSensor <= 0) {
    throw new Error("profundidad_sensor debe ser un numero positivo");
  }
  if (lecturaPozo > profundidadSensor) {
    throw new Error(
      `lectura_sensor (${lecturaPozo} m) no puede ser mayor que profundidad_sensor (${profundidadSensor} m)`
    );
  }

  const nivelFreatico_m = round(profundidadSensor - lecturaPozo, 3);

  if (Number.isFinite(profundidadTotal) && nivelFreatico_m > profundidadTotal) {
    throw new Error(
      `nivel_freatico calculado (${nivelFreatico_m} m) supera la profundidad_total del pozo (${profundidadTotal} m)`
    );
  }

  return nivelFreatico_m;
}

module.exports = { calcularNivelFreatico };
