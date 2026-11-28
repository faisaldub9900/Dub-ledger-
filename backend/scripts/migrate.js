'use strict';

require('dotenv').config();

const fs = require('node:fs/promises');
const path = require('node:path');
const { Client } = require('pg');

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL must be configured before running migrations');
  }

  const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
  const schema = await fs.readFile(schemaPath, 'utf8');
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ...(process.env.DATABASE_SSL === 'true'
      ? { ssl: { rejectUnauthorized: true } }
      : {})
  });

  await client.connect();
  try {
    await client.query(schema);
    console.log('DUB database schema applied successfully.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('Database migration failed:', error.message);
  process.exitCode = 1;
});
