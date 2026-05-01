const express = require('express');
const net     = require('net');
const pool    = require('../config/db');
const router  = express.Router();

const AUTH_API_URL      = process.env.AUTH_API_URL      || 'http://localhost:3001';
const CSVCONSUMER_HOST  = process.env.CSVCONSUMER_HOST  || 'localhost';
const CSVCONSUMER_PORT  = Number(process.env.CSVCONSUMER_PORT || 50051);

async function checkDatabase() {
  try {
    const { rows } = await pool.query('SELECT NOW() AS server_time');
    return { ok: true, database: 'Conexión exitosa', server_time: rows[0].server_time };
  } catch (err) {
    return { ok: false, database: 'Sin conexión', error: err.message };
  }
}

async function checkAuthApi() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${AUTH_API_URL}/api/health`, { signal: controller.signal });
    clearTimeout(timeout);
    const body = await res.json();
    return { ok: body.ok === true, message: body.message || 'Auth API operativa', database: body.database };
  } catch {
    return { ok: false, message: 'Sin respuesta' };
  }
}

function checkGrpcPipeline() {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const done = (ok, message) => {
      socket.destroy();
      resolve({ ok, message });
    };
    socket.setTimeout(4000);
    socket.connect(CSVCONSUMER_PORT, CSVCONSUMER_HOST, () => done(true,  'Pipeline gRPC operativo'));
    socket.on('error',   () => done(false, 'Sin respuesta'));
    socket.on('timeout', () => done(false, 'Timeout'));
  });
}

router.get('/', async (req, res) => {
  const [db, auth, pipeline] = await Promise.all([
    checkDatabase(),
    checkAuthApi(),
    checkGrpcPipeline(),
  ]);

  const allOk = db.ok && auth.ok && pipeline.ok;

  return res.status(allOk ? 200 : 207).json({
    ok: allOk,
    server_time: db.server_time || null,
    services: {
      main_api: {
        ok:       db.ok,
        message:  db.ok ? 'API principal operativa' : 'Error en API principal',
        database: db.database,
        ...(db.error && { error: db.error }),
      },
      auth_api: {
        ok:       auth.ok,
        message:  auth.message,
        database: auth.database,
      },
      pipeline: {
        ok:      pipeline.ok,
        message: pipeline.message,
      },
    },
  });
});

module.exports = router;
