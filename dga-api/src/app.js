/**
 * @comentario-codex
 * Configura Express para dga-api: JSON, CORS, rutas DGA, healthcheck y manejo centralizado de errores.
 */
const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const morgan       = require('morgan');
const dgaRoutes    = require('./routes/dgaRoutes');
const healthRoutes = require('./routes/healthRoutes');
const errorMiddleware = require('./middlewares/errorMiddleware');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.use('/api/health', healthRoutes);
app.use('/api/dga',    dgaRoutes);

app.use(errorMiddleware);

module.exports = app;
