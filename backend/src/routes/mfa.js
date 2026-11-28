'use strict';

const express = require('express');
const { authenticator } = require('otplib');
const { pool } = require('../db');
const { authenticateSession } = require('../auth');
const { encryptSecret, decryptSecret } = require('../mfa-crypto');

const router = express.Router();

function validCode(value) {
  return typeof value === 'string' && /^\d{6}$/.test(value);
}

router.post('/setup', authenticateSession, async (req, res, next) => {
  try {
    if (!pool) return res.status(503).json({ error: 'MFA service unavailable' });
    const current = await pool.query('SELECT mfa_enabled FROM app_users WHERE id = $1', [req.user.id]);
    if (!current.rows[0] || current.rows[0].mfa_enabled) {
      return res.status(409).json({ error: 'MFA is already enabled for this account' });
    }

    const secret = authenticator.generateSecret();
    const encrypted = encryptSecret(secret);
    await pool.query(
      'UPDATE app_users SET mfa_pending_secret_enc = $1 WHERE id = $2',
      [encrypted, req.user.id]
    );
    const otpauthUrl = authenticator.keyuri(req.user.email, 'DUB Digital System', secret);
    return res.status(200).json({
      secret,
      otpauth_url: otpauthUrl,
      message: 'Add this account to an authenticator app, then verify a current six-digit code.'
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/verify', authenticateSession, async (req, res, next) => {
  try {
    if (!pool) return res.status(503).json({ error: 'MFA service unavailable' });
    const code = req.body && req.body.code;
    if (!validCode(code)) return res.status(400).json({ error: 'A six-digit authenticator code is required' });

    const result = await pool.query(
      'SELECT mfa_pending_secret_enc, mfa_enabled FROM app_users WHERE id = $1',
      [req.user.id]
    );
    const account = result.rows[0];
    if (!account || account.mfa_enabled || !account.mfa_pending_secret_enc) {
      return res.status(409).json({ error: 'Start MFA setup before verification' });
    }

    const secret = decryptSecret(account.mfa_pending_secret_enc);
    if (!authenticator.check(code, secret)) {
      return res.status(401).json({ error: 'Invalid authenticator code' });
    }

    await pool.query(
      `UPDATE app_users
       SET mfa_secret_enc = mfa_pending_secret_enc,
           mfa_pending_secret_enc = NULL,
           mfa_enabled = TRUE,
           updated_at = now()
       WHERE id = $1`,
      [req.user.id]
    );
    await pool.query(
      `INSERT INTO audit_events (actor_user_id,event_type,target_type,target_id)
       VALUES ($1::uuid,'mfa_enabled','app_user',$1::text)`,
      [req.user.id]
    );
    // Force a fresh login so the newly enabled second factor is required.
    await pool.query(
      'UPDATE user_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
      [req.user.id]
    );
    return res.status(200).json({
      mfa_enabled: true,
      sessions_revoked: true,
      message: 'MFA enabled. Sign in again with your authenticator code.'
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
