'use strict';

const express = require('express');
const crypto = require('node:crypto');
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
    const secret = authenticator.generateSecret();
    const encrypted = encryptSecret(secret);
    await pool.query(
      'UPDATE app_users SET mfa_pending_secret_enc = $1 WHERE id = $2',
      [encrypted, req.user.id]
    );
    const label = encodeURIComponent(req.user.email);
    const issuer = encodeURIComponent('DUB Digital System');
    const otpauthUrl = authenticator.keyuri(label, issuer, secret);
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
      'SELECT mfa_pending_secret_enc FROM app_users WHERE id = $1',
      [req.user.id]
    );
    const encrypted = result.rows[0] && result.rows[0].mfa_pending_secret_enc;
    if (!encrypted) return res.status(409).json({ error: 'Start MFA setup before verification' });

    const secret = decryptSecret(encrypted);
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
       VALUES ($1,'mfa_enabled','app_user',$1)`,
      [req.user.id]
    );
    return res.status(200).json({ mfa_enabled: true });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
