/**
 * seed_pozos.js — Datos de prueba para la calculadora IEEE 754 de pozos.
 *
 * Inserta 30 dias de lecturas en equipo con registros REG5/REG6/REG7/REG8
 * que representan nivel de pozo y caudal en float32 IEEE 754.
 *
 * Uso: node src/seed_pozos.js
 */

const pool = require('./config/db');

const SERIAL_ID = 'POZO-TEST-001';
const DIAS       = 30;
const LECTURAS_POR_DIA = 24; // una por hora

/** Convierte un float32 en los dos words de 16 bits (Big-Endian). */
function floatAWords(valor) {
  const buf = Buffer.allocUnsafe(4);
  buf.writeFloatBE(valor, 0);
  return { alta: buf.readUInt16BE(0), baja: buf.readUInt16BE(2) };
}

/** Numero aleatorio con decimales entre min y max. */
function rand(min, max, dec = 2) {
  return parseFloat((min + Math.random() * (max - min)).toFixed(dec));
}

async function seed() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query('DELETE FROM equipo WHERE id_serial = $1', [SERIAL_ID]);
    console.log(`Datos anteriores de ${SERIAL_ID} eliminados.`);

    const ahora  = Date.now();
    const totalMs = DIAS * 24 * 60 * 60 * 1000;
    const intervalo = totalMs / (DIAS * LECTURAS_POR_DIA);

    let insertados = 0;

    for (let i = 0; i < DIAS * LECTURAS_POR_DIA; i++) {
      const ts     = new Date(ahora - totalMs + i * intervalo);
      const nivel  = rand(5.0, 25.0);
      const caudal = rand(0.5, 20.0);
      const presion = rand(1.0, 5.0);

      const wNivel  = floatAWords(nivel);
      const wCaudal = floatAWords(caudal);
      const wPresion = floatAWords(presion);

      await client.query(
        `INSERT INTO equipo (time, id_serial, data) VALUES ($1, $2, $3)`,
        [
          ts,
          SERIAL_ID,
          JSON.stringify({
            REG5: wNivel.alta,
            REG6: wNivel.baja,
            REG7: wCaudal.alta,
            REG8: wCaudal.baja,
            REG9: wPresion.alta,
            REG10: wPresion.baja,
          }),
        ]
      );
      insertados++;
    }

    await client.query('COMMIT');

    console.log(`\n✓ ${insertados} registros insertados para ${SERIAL_ID}`);
    console.log(`  Periodo: ultimos ${DIAS} dias, ${LECTURAS_POR_DIA} lecturas/dia`);
    console.log(`  Registros: REG5/REG6 = nivel pozo, REG7/REG8 = caudal, REG9/REG10 = presion`);
    console.log(`\nEjemplo de llamada:`);
    console.log(JSON.stringify({
      serial_id: SERIAL_ID,
      reg_alta: 'REG5',
      reg_baja: 'REG6',
      word_swap: false,
      dias: 30
    }, null, 2));

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error en seed:', err.message);
  } finally {
    client.release();
    pool.end();
  }
}

seed();
