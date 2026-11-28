'use strict';

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { checkDatabase, closeDatabase } = require('./db');
const authRoutes = require('./routes/auth');
const mfaRoutes = require('./routes/mfa');
const ownerRoutes = require('./routes/owner');
const ledgerRoutes = require('./routes/ledger');
const approvalRoutes = require('./routes/approvals');

const app = express();
const port = Number.parseInt(process.env.PORT || '8080', 10);
const host = process.env.HOST || '127.0.0.1';
const allowedOrigin = process.env.CORS_ORIGIN;
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid TCP port');

app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '32kb', strict: true }));
app.use(cors({
  origin(origin, callback) {
    if (!origin || origin === allowedOrigin) return callback(null, true);
    return callback(new Error('Origin not allowed'));
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
}));
app.use(rateLimit({ windowMs: 60000, limit: 60, standardHeaders: 'draft-7', legacyHeaders: false }));

app.get('/health', (_req, res) => res.status(200).json({
  service: 'DUB Digital System API',
  status: 'ok',
  environment: process.env.NODE_ENV || 'development'
}));
app.get('/ready', async (_req, res) => {
  try {
    await checkDatabase();
    return res.status(200).json({ status: 'ready', database: 'connected' });
  } catch (_error) {
    return res.status(503).json({ status: 'not_ready', database: 'unavailable' });
  }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts; try again later' }
});
app.use('/auth', authLimiter, authRoutes);
app.use('/mfa', authLimiter, mfaRoutes);
app.use('/owner', ownerRoutes);
app.use('/ledger', ledgerRoutes);
app.use('/approvals', approvalRoutes);
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, _req, res, _next) => {
  const message = process.env.NODE_ENV === 'production' ? 'Request could not be processed' : err.message;
  res.status(400).json({ error: message });
});

const server = app.listen(port, host, () => console.log(`DUB Digital System API listening on ${host}:${port}`));
let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received; closing API and database pool`);
  const forceExit = setTimeout(() => process.exit(1), 10000);
  forceExit.unref();
  server.close(async () => {
    try {
      await closeDatabase();
      clearTimeout(forceExit);
      process.exit(0);
    } catch (error) {
      console.error('Shutdown error:', error.message);
      process.exit(1);
    }
  });
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
