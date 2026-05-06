const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const mainApiRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(mainApiRoot, "..");

const requiredDirs = [
  "main-api/src/config",
  "main-api/src/controllers",
  "main-api/src/routes",
  "main-api/src/services",
  "main-api/src/utils",
  "main-api/test",
  "auth-api/src/config",
  "auth-api/src/controllers",
  "auth-api/src/routes",
  "frontend-angular/src/app",
  "infra-db/init-db",
];

const requiredFiles = [
  "docker-compose.yml",
  "main-api/package.json",
  "main-api/src/app.js",
  "main-api/src/server.js",
  "main-api/src/controllers/pozosController.js",
  "main-api/src/routes/pozosRoutes.js",
  "main-api/src/utils/ieee754.js",
  "main-api/src/utils/nivelFreatico.js",
  "main-api/test/api.test.js",
  "main-api/test/pozos.test.js",
  "auth-api/package.json",
  "auth-api/src/app.js",
  "auth-api/src/server.js",
  "frontend-angular/package.json",
  "frontend-angular/angular.json",
  "infra-db/init-db/01-init-schema.sql",
];

const ignoredPathPatterns = [
  /^\.git\//,
  /(^|\/)node_modules\//,
  /(^|\/)dist\//,
  /(^|\/)coverage\//,
  /(^|\/)\.angular\//,
  /^main-api\/demo\//,
  /^seed\.js$/,
  /^main-api\/src\/seed_.*\.js$/,
];

function toRepoPath(filePath) {
  return filePath.split(path.sep).join("/");
}

function existsFromRoot(relativePath) {
  return fs.existsSync(path.join(repoRoot, relativePath));
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const repoPath = toRepoPath(path.relative(repoRoot, fullPath));

    if (ignoredPathPatterns.some((pattern) => pattern.test(repoPath + (entry.isDirectory() ? "/" : "")))) {
      continue;
    }

    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
      continue;
    }

    files.push(repoPath);
  }

  return files;
}

test("estructura base del repo existe", () => {
  for (const dir of requiredDirs) {
    assert.equal(existsFromRoot(dir), true, `Falta carpeta requerida: ${dir}`);
    assert.equal(fs.statSync(path.join(repoRoot, dir)).isDirectory(), true, `${dir} no es carpeta`);
  }

  for (const file of requiredFiles) {
    assert.equal(existsFromRoot(file), true, `Falta archivo requerido: ${file}`);
    assert.equal(fs.statSync(path.join(repoRoot, file)).isFile(), true, `${file} no es archivo`);
  }
});

test("archivos locales de prueba quedan ignorados por el repo", () => {
  const gitignore = fs.readFileSync(path.join(repoRoot, ".gitignore"), "utf8");

  assert.match(gitignore, /^main-api\/demo\/$/m);
  assert.match(gitignore, /^seed\.js$/m);
  assert.match(gitignore, /^main-api\/src\/seed_\*\.js$/m);
});

test("el recorrido del repo ignora carpetas pesadas y encuentra archivos fuente", () => {
  const files = walk(repoRoot);

  assert.ok(files.includes("main-api/src/app.js"));
  assert.ok(files.includes("auth-api/src/app.js"));
  assert.ok(files.includes("frontend-angular/src/app/app.ts"));
  assert.equal(files.some((file) => file.includes("/node_modules/")), false);
  assert.equal(files.some((file) => file.startsWith("main-api/demo/")), false);
});

test("los archivos JS trackeados del backend tienen sintaxis valida", () => {
  const files = walk(repoRoot);
  const jsFiles = files.filter((file) =>
    /\.js$/.test(file) &&
    (
      file.startsWith("main-api/src/") ||
      file.startsWith("main-api/test/") ||
      file.startsWith("auth-api/src/")
    )
  );

  assert.ok(jsFiles.length > 0, "No se encontraron archivos JS para revisar");

  for (const file of jsFiles) {
    const source = fs.readFileSync(path.join(repoRoot, file), "utf8");
    new vm.Script(source, { filename: file });
  }
});

test("rutas principales de pozos estan conectadas al controlador", () => {
  const routes = fs.readFileSync(path.join(repoRoot, "main-api/src/routes/pozosRoutes.js"), "utf8");
  const controller = fs.readFileSync(path.join(repoRoot, "main-api/src/controllers/pozosController.js"), "utf8");

  assert.match(routes, /router\.get\("\/ieee754\/periodos",\s*listarPeriodosIEEE754\)/);
  assert.match(routes, /router\.post\("\/ieee754",\s*convertirIEEE754\)/);
  assert.match(routes, /router\.post\("\/nivel-freatico",\s*getNivelFreatico\)/);
  assert.match(routes, /router\.post\("\/caudal",\s*calcularCaudal\)/);

  assert.match(controller, /function getPeriodoInterval/);
  assert.match(controller, /async function listarPeriodosIEEE754/);
  assert.match(controller, /async function convertirIEEE754/);
  assert.match(controller, /async function getNivelFreatico/);
  assert.match(controller, /function calcularCaudal/);
});
