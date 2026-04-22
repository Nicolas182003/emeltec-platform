require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const apiKeyMiddleware  = require('./middlewares/apiKeyMiddleware');
const jwtMiddleware     = require('./middlewares/jwtMiddleware');
const authRoutes        = require('./routes/authRoutes');
const usuarioRoutes     = require('./routes/usuarioRoutes');
const empresaRoutes     = require('./routes/empresaRoutes');
const subEmpresaRoutes  = require('./routes/subEmpresaRoutes');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middlewares globales ──────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Health check (público) ────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'auth-api', timestamp: new Date().toISOString() });
});

// ── Rutas públicas — login y OTP ─────────────────────────────────
app.use('/api/auth', authRoutes);

// ── Rutas protegidas por JWT (frontend) ──────────────────────────
app.use('/api/front/empresas',  jwtMiddleware, empresaRoutes);
app.use('/api/front/usuarios',  jwtMiddleware, usuarioRoutes);

// ── Rutas protegidas por API Key (admin tools) ────────────────────
app.use(apiKeyMiddleware);
app.use('/api/usuarios',        usuarioRoutes);
app.use('/api/empresas',        empresaRoutes);
app.use('/api/sub-empresas',    subEmpresaRoutes);

// ── Manejo de errores ─────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({ ok: false, error: err.message || 'Error interno del servidor' });
});

app.listen(PORT, () => {
  console.log(`🚀 auth-api corriendo en http://localhost:${PORT}`);
  console.log(`🔓 Públicas:   POST /api/auth/request-code  |  POST /api/auth/login`);
  console.log(`🔐 JWT:        GET  /api/front/empresas     |  POST /api/front/usuarios`);
  console.log(`🔑 API Key:    /api/usuarios  /api/empresas  /api/sub-empresas`);
});
