'use strict';

const express = require('express');
const { pool } = require('../db');
const { authenticateSession } = require('../auth');

const router = express.Router();
router.use(authenticateSession);

function minorUnits(amount, currency) {
  if (typeof amount !== 'string' || !/^(0|[1-9]\d*)(\.\d+)?$/.test(amount)) return null;
  const digits = currency === 'JPY' ? 0 : (currency === 'KWD' || currency === 'BHD' ? 3 : 2);
  const parts = amount.split('.');
  if ((parts[1] || '').length > digits) return null;
  const whole = BigInt(parts[0]);
  const fraction = BigInt(((parts[1] || '').padEnd(digits, '0')) || '0');
  const value = whole * (10n ** BigInt(digits)) + fraction;
  if (value <= 0n || value > 9000000000000000n) return null;
  return value.toString();
}

function currencyCode(value) {
  return typeof value === 'string' && /^[A-Z]{3}$/.test(value) ? value : null;
}

router.get('/wallets', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT w.id,w.name,w.currency,w.account_kind,w.created_at,
              COALESCE(SUM(e.amount_minor),0)::text AS balance_minor
       FROM wallets w
       LEFT JOIN ledger_entries e ON e.wallet_id=w.id
       WHERE w.owner_user_id=$1 AND w.is_active=TRUE AND w.is_system=FALSE
       GROUP BY w.id ORDER BY w.created_at ASC`,
      [req.user.id]
    );
    return res.json({ wallets: result.rows });
  } catch (error) { return next(error); }
});

router.post('/wallets', async (req, res, next) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const currency = currencyCode(body.currency);
    const kinds = ['cash','bank','mobile_wallet','broker','e_wallet','other'];
    const kind = body.account_kind;
    if (!name || name.length > 80 || name.startsWith('__') || !currency || !kinds.includes(kind)) {
      return res.status(400).json({ error: 'Wallet name, three-letter currency, and valid account kind are required' });
    }
    const result = await pool.query(
      `INSERT INTO wallets(owner_user_id,name,currency,account_kind)
       VALUES($1,$2,$3,$4)
       RETURNING id,name,currency,account_kind,created_at`,
      [req.user.id,name,currency,kind]
    );
    await pool.query(
      `INSERT INTO audit_events(actor_user_id,event_type,target_type,target_id,details)
       VALUES($1,'wallet_created','wallet',$2,jsonb_build_object('name',$3,'currency',$4))`,
      [req.user.id,result.rows[0].id,name,currency]
    );
    return res.status(201).json({ wallet: { ...result.rows[0], balance_minor: '0' } });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'A wallet with this name and currency already exists' });
    return next(error);
  }
});

router.post('/transactions', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const type = body.transaction_type;
    const allowed = ['deposit','withdrawal','transfer'];
    const currency = currencyCode(body.currency);
    const amountMinor = minorUnits(body.amount, currency || '');
    const description = typeof body.description === 'string' ? body.description.trim().slice(0,500) : '';
    const idempotencyKey = req.get('Idempotency-Key') || '';
    if (!allowed.includes(type) || !currency || !amountMinor ||
        !/^[A-Za-z0-9._:-]{12,128}$/.test(idempotencyKey)) {
      return res.status(400).json({ error: 'Valid transaction type, currency, positive amount, and Idempotency-Key (12-128 characters) are required' });
    }
    const sourceId = type === 'withdrawal' || type === 'transfer' ? body.source_wallet_id : null;
    const destinationId = type === 'deposit' || type === 'transfer' ? body.destination_wallet_id : null;
    if ((sourceId && typeof sourceId !== 'string') || (destinationId && typeof destinationId !== 'string') ||
        (type === 'transfer' && sourceId === destinationId)) {
      return res.status(400).json({ error: 'Valid distinct source and destination wallets are required' });
    }

    await client.query('BEGIN');
    const walletIds = [sourceId,destinationId].filter(Boolean);
    if (walletIds.length) {
      const wallets = await client.query(
        'SELECT id,currency FROM wallets WHERE id=ANY($1::uuid[]) AND owner_user_id=$2 AND is_active=TRUE AND is_system=FALSE FOR UPDATE',
        [walletIds,req.user.id]
      );
      if (wallets.rowCount !== walletIds.length || wallets.rows.some(w => w.currency.trim() !== currency)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Wallet not found, inactive, or currency does not match' });
      }
    }

    const result = await client.query(
      `INSERT INTO ledger_transactions
       (transaction_type,status,description,idempotency_key,created_by,source_wallet_id,destination_wallet_id,amount_minor,currency)
       VALUES($1,'pending',$2,$3,$4,$5,$6,$7,$8)
       RETURNING id,transaction_type,status,description,amount_minor::text,currency,created_at`,
      [type,description,idempotencyKey,req.user.id,sourceId,destinationId,amountMinor,currency]
    );
    await client.query(
      `INSERT INTO audit_events(actor_user_id,event_type,target_type,target_id,details)
       VALUES($1,'transaction_requested','ledger_transaction',$2,jsonb_build_object('type',$3,'amount_minor',$4,'currency',$5))`,
      [req.user.id,result.rows[0].id,type,amountMinor,currency]
    );
    await client.query('COMMIT');
    return res.status(201).json({ transaction: result.rows[0], approval_required: true });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error.code === '23505') return res.status(409).json({ error: 'This Idempotency-Key has already been used' });
    return next(error);
  } finally { client.release(); }
});

router.get('/transactions', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT t.id,t.transaction_type,t.status,t.description,t.amount_minor::text,t.currency,
              t.created_at,t.approved_at,t.posted_at,t.rejection_reason
       FROM ledger_transactions t
       WHERE t.created_by=$1
          OR EXISTS(SELECT 1 FROM wallets w WHERE w.owner_user_id=$1
                    AND w.id IN (t.source_wallet_id,t.destination_wallet_id))
       ORDER BY t.created_at DESC LIMIT 200`,
      [req.user.id]
    );
    return res.json({ transactions: result.rows });
  } catch (error) { return next(error); }
});

module.exports = router;
