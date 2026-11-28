# DUB Digital System — Backend status

Developer / Creator: **Shakeel Faisal**

## Implemented in this branch
- Minimal Express API server with Helmet, JSON size limit, exact-origin CORS allow-list and request rate limiting.
- PostgreSQL schema draft for users, single owner role, sessions, wallets, transactions, ledger entries, exchange rates and audit events.
- Deny-by-default authentication and owner authorization helper middleware.
- No public signup, withdrawal or wallet-write endpoint has been exposed.

## Not yet implemented or verified
- Database provisioning, migrations execution and integration tests.
- Password login, Argon2id hashing, MFA enrollment/verification, secure cookie/session lifecycle.
- Authentication middleware that verifies sessions and sets req.user.
- Owner bootstrap procedure and recovery process.
- Transaction posting service with atomic double-entry writes, approval workflow and reversal flow.
- Live FX provider integration, backup/restore, offline sync.
- Cloud deployment, TLS, secrets management, monitoring and security testing.

## Critical deployment rule
Do not expose this API to the public internet or use real financial records until all outstanding items are implemented and tested. Never commit passwords, API keys, MFA seeds, recovery codes or production connection strings.

## Financial invariant
Each posted transaction must have entries that sum to zero per currency. Transfers and withdrawals must be authorized server-side, recorded atomically, idempotent and auditable. Exchange rates must be stored with source and observation timestamp; historical transactions must not be silently repriced.
