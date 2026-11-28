'use strict';

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const port = Number.parseInt(process.env.PORT || '8080', 10);
const host = process.env.HOST || '127.0.0.1';
const allowedOrigin = process.env.CORS_ORIGIN;

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be a valid TCP port');
}

app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '32kb', strict: true }));
app.use(cors({
  origin(origin, callback) {
    // Non-browser clients may omit Origin. Browser origins must match exactly.
    if (!origin || origin === allowedOrigin) return callback(null, true);
    return callback(new Error('Origin not allowed'));
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
}));
app.use(rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false
}));

app.get('/health', (_req, res) => {
  res.status(200).json({
    service: 'DUB Digital System API',
    status: 'ok',
    environment: process.env.NODE_ENV || 'development'
  });
});

// No public registration, wallet mutation, or withdrawal endpoints are exposed.
// Financial and owner-only routes must be added with server-side authorization.
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, _req, res, _next) => {
  const message = process.env.NODE_ENV === 'production'
    ? 'Request could not be processed'
    : err.message;
  res.status(400).json({ error: message });
});

const server = app.listen(port, host, () => {
  console.log(`DUB Digital System API listening on ${host}:${port}`);
});

function shutdown(signal) {
  console.log(`${signal} received; closing server`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
