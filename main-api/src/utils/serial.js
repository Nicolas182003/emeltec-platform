/**
 * Resuelve el serial del registro mas reciente disponible en log_records.
 */
async function getLatestSerialId(pool) {
  const { rows } = await pool.query(
    `
    SELECT serial_id
    FROM ts_pozos
    ORDER BY ts DESC
    LIMIT 1
    `
  );

  return rows[0]?.serial_id || null;
}

module.exports = {
  getLatestSerialId,
};
