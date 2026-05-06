process.env.TZ = "UTC";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const srcRoot = path.join(projectRoot, "src");
const dbModulePath = path.join(srcRoot, "config", "db.js");

function clearSrcModules() {
  for (const key of Object.keys(require.cache)) {
    if (key.startsWith(srcRoot)) {
      delete require.cache[key];
    }
  }
}

function createDbMock() {
  const handlers = [];
  const calls = [];

  return {
    calls,
    enqueue(result) {
      handlers.push(result);
    },
    pool: {
      on() {},
      async query(text, params = []) {
        calls.push({ text, params });

        if (handlers.length === 0) {
          throw new Error(`Consulta no mockeada: ${text}`);
        }

        const next = handlers.shift();
        return typeof next === "function" ? next(text, params, calls) : next;
      },
    },
  };
}

function loadApp(dbMock) {
  clearSrcModules();
  require.cache[dbModulePath] = {
    id: dbModulePath,
    filename: dbModulePath,
    loaded: true,
    exports: dbMock.pool,
  };

  return require(path.join(srcRoot, "app.js"));
}

async function withTestServer(dbMock, run) {
  const app = loadApp(dbMock);
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });

  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await run(baseUrl, dbMock.calls);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    clearSrcModules();
  }
}

test("GET /api/pozos/ieee754/periodos lista buckets por periodo de guardado", async () => {
  const dbMock = createDbMock();
  dbMock.enqueue({
    rows: [
      {
        bucket_start: "2026-05-03T21:00:00.000Z",
        range_start: "2026-05-03T21:00:00.000Z",
        range_end: "2026-05-10T21:00:00.000Z",
        inicio: "2026-05-03 21:00",
        fin: "2026-05-10 21:00",
        total: 65,
      },
    ],
  });

  await withTestServer(dbMock, async (baseUrl, calls) => {
    const response = await fetch(
      `${baseUrl}/api/pozos/ieee754/periodos?serial_id=POZO-TEST-001&reg_alta=REG5&reg_baja=REG6&periodo=week`
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.periodo, "week");
    assert.equal(body.intervalo, "1 week");
    assert.equal(body.total, 1);
    assert.equal(body.periodos[0].total, 65);
    assert.match(calls[0].text, /time_bucket\(\$4::interval, time\)/i);
    assert.deepEqual(calls[0].params, ["POZO-TEST-001", "REG5", "REG6", "1 week"]);
  });
});

test("POST /api/pozos/ieee754 convierte registros dentro del bucket seleccionado", async () => {
  const dbMock = createDbMock();
  dbMock.enqueue({
    rows: [
      {
        periodo_intervalo: "1 day",
        bucket_start: "2026-05-05T21:00:00.000Z",
        range_start: "2026-05-05T21:00:00.000Z",
        range_end: "2026-05-06T21:00:00.000Z",
        inicio: "2026-05-05 21:00",
        fin: "2026-05-06 21:00",
        total: 2,
      },
    ],
  });
  dbMock.enqueue({
    rows: [
      { w_alta: "16712", w_baja: "0", fecha: "2026-05-06", hora: "10:00:00" },
      { w_alta: "16800", w_baja: "26214", fecha: "2026-05-06", hora: "11:00:00" },
    ],
  });

  await withTestServer(dbMock, async (baseUrl, calls) => {
    const response = await fetch(`${baseUrl}/api/pozos/ieee754`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serial_id: "POZO-TEST-001",
        reg_alta: "REG5",
        reg_baja: "REG6",
        periodo: "day",
        bucket_start: "2026-05-05T21:00:00.000Z",
        word_swap: false,
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.total, 2);
    assert.equal(body.periodo.periodo, "day");
    assert.equal(body.datos[0].valor, 12.5);
    assert.ok(Math.abs(body.datos[1].valor - 20.049999237060547) < 0.000001);
    assert.match(calls[0].text, /time_bucket\(\$4::interval, time\) = \$5::timestamptz/i);
    assert.match(calls[1].text, /FROM equipo/i);
    assert.deepEqual(calls[1].params, [
      "POZO-TEST-001",
      "REG5",
      "REG6",
      "2026-05-05T21:00:00.000Z",
      "2026-05-06T21:00:00.000Z",
    ]);
  });
});

test("POST /api/pozos/nivel-freatico responde lectura y nivel calculado", async () => {
  const dbMock = createDbMock();
  dbMock.enqueue({
    rows: [
      {
        id_serial: "POZO-TEST-001",
        lectura: "12",
        fecha: "2026-05-06",
        hora: "10:00:00",
      },
    ],
  });

  await withTestServer(dbMock, async (baseUrl, calls) => {
    const response = await fetch(`${baseUrl}/api/pozos/nivel-freatico`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serial_id: "POZO-TEST-001",
        variable_nivel: "nivel_pozo",
        profundidad_sensor: 30,
        profundidad_total: 60,
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.lectura_sensor_m, 12);
    assert.equal(body.nivel_freatico_m, 18);
    assert.equal(body.profundidad_total_m, 60);
    assert.deepEqual(calls[0].params, ["POZO-TEST-001", "nivel_pozo"]);
  });
});

test("POST /api/pozos/caudal convierte m3/h a l/s sin consultar base de datos", async () => {
  const dbMock = createDbMock();

  await withTestServer(dbMock, async (baseUrl, calls) => {
    const response = await fetch(`${baseUrl}/api/pozos/caudal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ valor: 18 }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.resultado.valor, 5);
    assert.equal(calls.length, 0);
  });
});

test("GET /api/pozos/ieee754/periodos rechaza periodos invalidos", async () => {
  const dbMock = createDbMock();

  await withTestServer(dbMock, async (baseUrl, calls) => {
    const response = await fetch(
      `${baseUrl}/api/pozos/ieee754/periodos?serial_id=POZO-TEST-001&reg_alta=REG5&reg_baja=REG6&periodo=hora`
    );
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.ok, false);
    assert.match(body.message, /periodo invalido/i);
    assert.equal(calls.length, 0);
  });
});
