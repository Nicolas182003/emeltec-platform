// Convierte caudal de m³/h a l/s.
// 1 m³/h = 1000 l / 3600 s = 1/3.6 l/s
function m3hALs(valor) {
  if (!Number.isFinite(valor)) {
    throw new Error("valor debe ser un numero finito");
  }
  return valor / 3.6;
}

module.exports = { m3hALs };
