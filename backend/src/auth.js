'use strict';

const crypto = require('node:crypto');
const argon2 = require('argon2');
const { pool } = require('./db');

const SESSION_HOURS = Number.parseInt(process.env.SESSION_HOURS || '12', 10);
const TOKEN_BYTES = 32;

function hashToken(token) {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

async function authenticateSession(req, res, next) {
  try {
    const header = req.get('authorization') || '';
    const match = /^Bearer ([A-Za-z0-9_-]{40,})$/.exec(header);
    if (!match || !pool) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const tokenHash = hashToken(match[1]);
    const result = await pool.query(
      `SELECT u.id, u.email, u.display_name, u.role, u.is_active
       FROM user_sessions s
       JOIN app_users u ON u.id = s.user_id
       WHERE s.token_hash = $1
         AND s.revoked_at IS NULL
         AND s.expires_at > now()
       LIMIT 1`,
      [tokenHash]
    );

    const user = result.rows[0];
    if (!user || user.is_active !== true) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    req.user = user;
    req.sessionTokenHash = tokenHash;
    return next();
  } catch (error) {
    return next(error);
  }
}

async function login(req, res, next) {
  try {
    const email = typeof req.body.email === 'string'
      ? req.body.email.trim().toLowerCase()
      : '';
    const password = typeof req.body.password === 'string'
      ? req.body.password
      : '';

    if (!email || !password || email.length > 254 || password.length > 1024) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    if (!pool) {
      return res.status(503).json({ error: 'Authentication service unavailable' });
    }

    const result = await pool.query(
      `SELECT id, email, display_name, role, is_active, mfa_enabled, password_hash
       FROM app_users WHERE lower(email) = $1 LIMIT 1`,
      [email]
    );
    const user = result.rows[0];

    // Same response for unknown, inactive, and incorrect-password accounts.
    if (!user || user.is_active !== true ||
        !(await argon2.verify(user.password_hash, password))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Do not create a weaker session for an account that requires MFA.
    if (user.mfa_enabled) {
      return res.status(403).json({ error: 'MFA verification is required; password-only login is disabled' });
    }

    const token = crypto.randomBytes(TOKEN_BYTES).toString('base64url');
    const tokenHash = hashToken(token);
    const hours = Number.isInteger(SESSION_HOURS) && SESSION_HOURS >= 1 && SESSION_HOURS <= 168
      ? SESSION_HOURS
      : 12;

    await pool.query(
      `INSERT INTO user_sessions (user_id, token_hash, expires_at)
       VALUES ($1, $2, now() + ($3 * interval '1 hour'))`,
      [user.id, tokenHash, hours]
    );

    return res.status(200).json({
      token,
      token_type: 'Bearer',
      expires_in: hours * 3600,
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        role: user.role
      }
    });
  } catch (error) {
    return next(error);
  }
}

async function logout(req, res, next) {
  try {
    if (req.sessionTokenHash && pool) {
      await pool.query(
        'UPDATE user_sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL',
        [req.sessionTokenHash]
      );
    }
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
}

module.exports = { authenticateSession, login, logout };
