/**
 * @comentario-codex
 * Punto de arranque de dga-api: levanta el servidor HTTP y muestra informacion basica del entorno.
 */
const app               = require('./app');
const { port, nodeEnv } = require('./config/env');
const { startCrons }    = require('./jobs/scheduler');

app.listen(port, () => {
  console.log(`[dga-api] HTTP corriendo en http://localhost:${port}`);
  console.log(`[dga-api] Entorno: ${nodeEnv}`);
  startCrons();
});
