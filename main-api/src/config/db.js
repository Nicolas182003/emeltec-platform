/**
 * Crea y exporta un pool compartido de PostgreSQL/TimescaleDB.
 * Toda consulta del proyecto pasa por esta unica conexion administrada.
 */
const { Pool } = require("pg");
const { db }   = require("./env");
const { formatUtcMinus3 } = require("../utils/timezone");

const TIMESTAMPTZ_OID = 1184;
const TIMESTAMP_OID = 1114;

const { types } = require("pg");

types.setTypeParser(TIMESTAMPTZ_OID, formatUtcMinus3);
types.setTypeParser(TIMESTAMP_OID, formatUtcMinus3);

const pool = new Pool({
  host:                    db.host,
  port:                    db.port,
  database:                db.database,
  user:                    db.user,
  password:                db.password,
  max:                     db.max,
  idleTimeoutMillis:       db.idleTimeoutMillis,
  connectionTimeoutMillis: db.connectionTimeoutMillis,
  options:                 "-c timezone=Etc/GMT+3",
});

pool.on("error", (err) => {
  console.error("[DB] Error inesperado en el pool:", err.message);
});

// Log de conexión exitosa al iniciar
pool.query("SELECT NOW()")
  .then(() => console.log("[DB] Conexión a TimescaleDB exitosa"))
  .catch((err) => console.error("[DB] No se pudo conectar:", err.message));

module.exports = pool;
