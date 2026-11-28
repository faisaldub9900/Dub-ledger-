BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS app_users (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 email TEXT NOT NULL UNIQUE,
 display_name TEXT NOT NULL,
 password_hash TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('owner','user')),
 is_active BOOLEAN NOT NULL DEFAULT TRUE,
 mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
 mfa_secret_enc TEXT,
 mfa_pending_secret_enc TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS app_users_email_lower_unique ON app_users (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS one_dub_owner_only ON app_users ((role)) WHERE role='owner';
CREATE TABLE IF NOT EXISTS user_sessions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
 token_hash TEXT NOT NULL UNIQUE,
 expires_at TIMESTAMPTZ NOT NULL,
 revoked_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_sessions_user_expiry ON user_sessions(user_id,expires_at);
CREATE TABLE IF NOT EXISTS wallets (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_user_id UUID NOT NULL REFERENCES app_users(id),
 name TEXT NOT NULL,
 currency CHAR(3) NOT NULL,
 account_kind TEXT NOT NULL CHECK (account_kind IN ('cash','bank','mobile_wallet','broker','e_wallet','other')),
 is_active BOOLEAN NOT NULL DEFAULT TRUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(owner_user_id,name,currency)
);
CREATE TABLE IF NOT EXISTS ledger_transactions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 transaction_type TEXT NOT NULL CHECK (transaction_type IN ('deposit','withdrawal','transfer','adjustment','trade_pnl')),
 status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','posted','reversed')),
 description TEXT NOT NULL DEFAULT '',
 external_reference TEXT,
 idempotency_key TEXT NOT NULL UNIQUE,
 created_by UUID NOT NULL REFERENCES app_users(id),
 approved_by UUID REFERENCES app_users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 approved_at TIMESTAMPTZ,
 posted_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS ledger_entries (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 transaction_id UUID NOT NULL REFERENCES ledger_transactions(id),
 wallet_id UUID NOT NULL REFERENCES wallets(id),
 currency CHAR(3) NOT NULL,
 amount_minor BIGINT NOT NULL CHECK (amount_minor <> 0),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ledger_entries_wallet_time ON ledger_entries(wallet_id,created_at DESC);
CREATE INDEX IF NOT EXISTS ledger_transactions_status_time ON ledger_transactions(status,created_at DESC);
CREATE TABLE IF NOT EXISTS exchange_rates (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 base_currency CHAR(3) NOT NULL,
 quote_currency CHAR(3) NOT NULL,
 rate NUMERIC(24,10) NOT NULL CHECK (rate > 0),
 source TEXT NOT NULL,
 observed_at TIMESTAMPTZ NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS audit_events (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 actor_user_id UUID REFERENCES app_users(id),
 event_type TEXT NOT NULL,
 target_type TEXT NOT NULL,
 target_id TEXT,
 details JSONB NOT NULL DEFAULT '{}'::jsonb,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION assert_ledger_transaction_balanced()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE tx_id UUID; bad_count INTEGER;
BEGIN
 tx_id := NEW.id;
 IF EXISTS (SELECT 1 FROM ledger_transactions WHERE id=tx_id AND status='posted') THEN
  SELECT count(*) INTO bad_count FROM (
   SELECT currency FROM ledger_entries WHERE transaction_id=tx_id
   GROUP BY currency HAVING SUM(amount_minor) <> 0
  ) unbalanced;
  IF bad_count > 0 OR NOT EXISTS (SELECT 1 FROM ledger_entries WHERE transaction_id=tx_id) THEN
   RAISE EXCEPTION 'Ledger transaction % is not balanced', tx_id;
  END IF;
 END IF;
 RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS ledger_balance_check ON ledger_transactions;
CREATE CONSTRAINT TRIGGER ledger_balance_check
AFTER INSERT OR UPDATE OF status ON ledger_transactions
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION assert_ledger_transaction_balanced();
COMMIT;

-- Safe for databases created before MFA columns were introduced.
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS mfa_secret_enc TEXT;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS mfa_pending_secret_enc TEXT;
