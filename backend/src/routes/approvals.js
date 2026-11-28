'use strict';

const express = require('express');
const { pool } = require('../db');
const { authenticateSession } = require('../auth');
const { requireOwner } = require('../authz');
const { isUuid } = require('../ids');

const router = express.Router();
router.use(authenticateSession, requireOwner);

router.get('/pending', async (_req,res,next) => {
  try {
    const result = await pool.query(
      `SELECT id,transaction_type,description,amount_minor::text,currency,
              source_wallet_id,destination_wallet_id,created_by,created_at
       FROM ledger_transactions WHERE status='pending' ORDER BY created_at ASC LIMIT 200`
    );
    return res.json({ pending: result.rows });
  } catch(error) { return next(error); }
});

router.post('/:id/approve', async (req,res,next) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Valid transaction ID is required' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const selected = await client.query(
      `SELECT * FROM ledger_transactions WHERE id=$1 AND status='pending' FOR UPDATE`,
      [req.params.id]
    );
    if (!selected.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Pending transaction not found' });
    }
    const tx = selected.rows[0];
    const amount = tx.amount_minor.toString();
    const currency = tx.currency.trim();
    let entries = [];

    if (tx.transaction_type === 'transfer') {
      const wallets = await client.query(
        'SELECT id,currency,owner_user_id,is_active,is_system FROM wallets WHERE id=ANY($1::uuid[]) FOR UPDATE',
        [[tx.source_wallet_id,tx.destination_wallet_id]]
      );
      if (wallets.rowCount !== 2 || wallets.rows.some(w => !w.is_active || w.is_system || w.currency.trim() !== currency)) {
        throw new Error('Transfer wallet validation failed');
      }
      const source = wallets.rows.find(w => w.id === tx.source_wallet_id);
      const destination = wallets.rows.find(w => w.id === tx.destination_wallet_id);
      if (!source || !destination || source.owner_user_id !== destination.owner_user_id) {
        throw new Error('Transfer wallets must belong to the same user');
      }
      const balance = await client.query(
        'SELECT COALESCE(SUM(amount_minor),0)::numeric AS balance FROM ledger_entries WHERE wallet_id=$1',
        [source.id]
      );
      if (BigInt(balance.rows[0].balance) < BigInt(amount)) throw new Error('Insufficient wallet balance');
      entries = [[source.id,(-BigInt(amount)).toString()],[destination.id,amount]];
    } else {
      const walletId = tx.transaction_type === 'deposit' ? tx.destination_wallet_id : tx.source_wallet_id;
      const walletResult = await client.query(
        'SELECT id,currency,owner_user_id,is_active,is_system FROM wallets WHERE id=$1 FOR UPDATE',
        [walletId]
      );
      const wallet = walletResult.rows[0];
      if (!wallet || !wallet.is_active || wallet.is_system || wallet.currency.trim() !== currency) {
        throw new Error('Transaction wallet validation failed');
      }
      const clearingName = '__clearing__' + currency;
      const clearingResult = await client.query(
        `INSERT INTO wallets(owner_user_id,name,currency,account_kind,is_system)
         VALUES($1,$2,$3,'other',TRUE)
         ON CONFLICT(owner_user_id,name,currency) DO UPDATE SET is_system=TRUE
         RETURNING id`,
        [wallet.owner_user_id,clearingName,currency]
      );
      const clearingId = clearingResult.rows[0].id;
      if (tx.transaction_type === 'deposit') {
        entries = [[wallet.id,amount],[clearingId,(-BigInt(amount)).toString()]];
      } else {
        const balance = await client.query(
          'SELECT COALESCE(SUM(amount_minor),0)::numeric AS balance FROM ledger_entries WHERE wallet_id=$1',
          [wallet.id]
        );
        if (BigInt(balance.rows[0].balance) < BigInt(amount)) throw new Error('Insufficient wallet balance');
        entries = [[wallet.id,(-BigInt(amount)).toString()],[clearingId,amount]];
      }
    }

    for (const [walletId,amountMinor] of entries) {
      await client.query(
        'INSERT INTO ledger_entries(transaction_id,wallet_id,currency,amount_minor) VALUES($1,$2,$3,$4)',
        [tx.id,walletId,currency,amountMinor]
      );
    }
    await client.query(
      `UPDATE ledger_transactions
       SET status='posted',approved_by=$2,approved_at=now(),posted_at=now()
       WHERE id=$1`,
      [tx.id,req.user.id]
    );
    await client.query(
      `INSERT INTO audit_events(actor_user_id,event_type,target_type,target_id,details)
       VALUES($1,'transaction_approved','ledger_transaction',$2,jsonb_build_object('amount_minor',$3,'currency',$4))`,
      [req.user.id,tx.id,amount,currency]
    );
    await client.query('COMMIT');
    return res.json({ id:tx.id,status:'posted',approved_by:req.user.id });
  } catch(error) {
    await client.query('ROLLBACK').catch(() => {});
    return res.status(409).json({ error: error.message || 'Could not approve transaction' });
  } finally { client.release(); }
});

router.post('/:id/reject', async (req,res,next) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Valid transaction ID is required' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE ledger_transactions SET status='rejected',approved_by=$2,approved_at=now(),
              rejection_reason=$3
       WHERE id=$1 AND status='pending'
       RETURNING id`,
      [req.params.id,req.user.id,req.body && typeof req.body.reason === 'string' ? req.body.reason.trim().slice(0,500) : 'Rejected by Owner']
    );
    if (!result.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Pending transaction not found' });
    }
    await client.query(
      `INSERT INTO audit_events(actor_user_id,event_type,target_type,target_id)
       VALUES($1,'transaction_rejected','ledger_transaction',$2)`,
      [req.user.id,req.params.id]
    );
    await client.query('COMMIT');
    return res.json({ id:req.params.id,status:'rejected' });
  } catch(error) {
    await client.query('ROLLBACK').catch(() => {});
    return next(error);
  } finally { client.release(); }
});

module.exports = router;
