'use strict';

const { Pool } = require('pg');

const databaseUrl = process.env.DATABASE_URL;
const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      max: Number.parseInt(process.env.DB_POOL_MAX || '10', 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      ...(process.env.DATABASE_SSL === 'true'
        ? { ssl: { rejectUnauthorized: true } }
        : {})
    })
  : null;

if (pool) {
  pool.on('error', (error) => {
    // Do not log connection strings, credentials, or query parameters.
    console.error('Unexpected idle PostgreSQL client error:', error.message);
  });
}

async function checkDatabase() {
  if (!pool) {
    const error = new Error('DATABASE_URL is not configured');
    error.code = 'DATABASE_NOT_CONFIGURED';
    throw error;
  }
  await pool.query('SELECT 1');
  return true;
}

async function closeDatabase() {
  if (pool) await pool.end();
}

module.exports = { pool, checkDatabase, closeDatabase };
