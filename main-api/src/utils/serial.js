/**
 * Resuelve el serial del registro mas reciente disponible en log_records.
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

  return rows[0]?.serial_id || null;
}

module.exports = {
  getLatestSerialId,
};
