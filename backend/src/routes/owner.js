'use strict';

const express = require('express');
const argon2 = require('argon2');
const { pool } = require('../db');
const { authenticateSession } = require('../auth');
const { requireOwner } = require('../authz');

const router = express.Router();
router.use(authenticateSession, requireOwner);

router.get('/users', async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id,email,display_name,role,is_active,mfa_enabled,created_at
       FROM app_users ORDER BY created_at ASC`
    );
    return res.json({ users: result.rows });
  } catch (error) {
    return next(error);
  }
});

router.post('/users', async (req, res, next) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const displayName = typeof body.display_name === 'string' ? body.display_name.trim() : '';
    const password = typeof body.temporary_password === 'string' ? body.temporary_password : '';

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 ||
        !displayName || displayName.length > 120 || password.length < 14 || password.length > 1024) {
      return res.status(400).json({
        error: 'Valid email, display name, and a temporary password of at least 14 characters are required'
      });
    }

    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1
    });

    const result = await pool.query(
      `INSERT INTO app_users (email,display_name,password_hash,role)
       VALUES ($1,$2,$3,'user')
       RETURNING id,email,display_name,role,is_active,created_at`,
      [email, displayName, passwordHash]
    );
    const created = result.rows[0];
    await pool.query(
      `INSERT INTO audit_events (actor_user_id,event_type,target_type,target_id,details)
       VALUES ($1,'user_created','app_user',$2,jsonb_build_object('email',$3::text))`,
      [req.user.id, created.id, created.email]
    );
    return res.status(201).json({ user: created });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'An account with this email already exists' });
    return next(error);
  }
});

router.patch('/users/:id/status', async (req, res, next) => {
  try {
    const active = req.body && req.body.is_active;
    if (typeof active !== 'boolean') {
      return res.status(400).json({ error: 'is_active must be true or false' });
    }
    const targetId = req.params.id;
    if (targetId === req.user.id && active === false) {
      return res.status(409).json({ error: 'Owner cannot deactivate the current Owner session account' });
    }

    const result = await pool.query(
      `UPDATE app_users SET is_active=$1,updated_at=now()
       WHERE id=$2 AND role='user'
       RETURNING id,email,display_name,role,is_active`,
      [active, targetId]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'User account not found' });

    await pool.query(
      `UPDATE user_sessions SET revoked_at=now()
       WHERE user_id=$1 AND revoked_at IS NULL`,
      [targetId]
    );
    await pool.query(
      `INSERT INTO audit_events (actor_user_id,event_type,target_type,target_id,details)
       VALUES ($1,'user_status_changed','app_user',$2,jsonb_build_object('is_active',$3::boolean))`,
      [req.user.id, targetId, active]
    );
    return res.json({ user: result.rows[0], sessions_revoked: true });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
