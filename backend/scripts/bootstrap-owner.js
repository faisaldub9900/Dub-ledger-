'use strict';

require('dotenv').config();

const argon2 = require('argon2');
const { Client } = require('pg');

function required(name) {
  const value = process.env[name];
  if (!value || !value.trim()) throw new Error(name + ' is required');
  return value.trim();
}

async function main() {
  const databaseUrl = required('DATABASE_URL');
  const email = required('OWNER_EMAIL').toLowerCase();
  const displayName = required('OWNER_NAME');
  const password = process.env.OWNER_PASSWORD || '';

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new Error('OWNER_EMAIL must be a valid email address');
  }
  if (displayName.length > 120) throw new Error('OWNER_NAME is too long');
  if (password.length < 14 || password.length > 1024) {
    throw new Error('OWNER_PASSWORD must be at least 14 characters');
  }

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1
  });

  const client = new Client({
    connectionString: databaseUrl,
    ...(process.env.DATABASE_SSL === 'true'
      ? { ssl: { rejectUnauthorized: true } }
      : {})
  });

  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('dub-single-owner-bootstrap'))");
    const existingOwner = await client.query(
      "SELECT id FROM app_users WHERE role = 'owner' LIMIT 1"
    );
    if (existingOwner.rowCount > 0) {
      throw new Error('An Owner account already exists; bootstrap will not replace it');
    }

    await client.query(
      `INSERT INTO app_users (email, display_name, password_hash, role)
       VALUES ($1, $2, $3, 'owner')`,
      [email, displayName, passwordHash]
    );
    await client.query(
      `INSERT INTO audit_events (event_type, target_type, target_id, details)
       VALUES ('owner_bootstrapped', 'app_user', $1, jsonb_build_object('email', $2::text))`,
      [email, email]
    );
    await client.query('COMMIT');
    console.log('The single DUB Owner account was created. Remove OWNER_PASSWORD from the environment now.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('Owner bootstrap failed:', error.message);
  process.exitCode = 1;
});
