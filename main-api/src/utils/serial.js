/**
 * Resuelve el serial del registro mas reciente disponible en equipo.
 */
async function getLatestSerialId(pool) {
  const { rows } = await pool.query(
    `
    SELECT id_serial AS serial_id
    FROM equipo
    ORDER BY time DESC
    LIMIT 1
    `
  );

  return rows[0]?.serial_id || rows[0]?.id_serial || null;
}

module.exports = {
  getLatestSerialId,
};
