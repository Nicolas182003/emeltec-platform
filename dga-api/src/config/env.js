/**
 * @comentario-codex
 * Centraliza variables de entorno de dga-api, incluyendo URL oficial/mock de DGA y credenciales de base de datos.
 */
require('dotenv').config();

module.exports = {
  nodeEnv:        process.env.NODE_ENV          || 'development',
  port:           Number(process.env.PORT       || 3002),
  jwtSecret:      process.env.JWT_SECRET        || 'super_secret_dev_key_12345',
  dgaApiUrl:      process.env.DGA_API_URL       || 'https://dga.mop.gob.cl/api',
  dgaMockMode:    process.env.DGA_MOCK_MODE     === 'true',
  internalApiKey: process.env.INTERNAL_API_KEY  || '',
  db: {
    host:                    process.env.DB_HOST     || 'localhost',
    port:                    Number(process.env.DB_PORT || 5432),
    database:                process.env.DB_NAME     || 'telemetry_platform',
    user:                    process.env.DB_USER     || 'postgres',
    password:                process.env.DB_PASSWORD || '',
    max:                     10,
    idleTimeoutMillis:       30000,
    connectionTimeoutMillis: 5000,
  },
};
