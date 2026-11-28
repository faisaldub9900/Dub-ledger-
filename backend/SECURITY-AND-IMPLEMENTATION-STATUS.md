# DUB Digital System — Backend status

Developer / Creator: **Shakeel Faisal**

This status reflects the source on `backend-foundation`. A passing test suite is not the same as production deployment or independent security approval.

## Implemented and tested in source
- Express API with Helmet, JSON size limit, exact-origin CORS allow-list, global and authentication rate limits, health and database-readiness endpoints.
- PostgreSQL schema for a single Owner, users, sessions, wallets, transactions, balanced ledger entries, exchange-rate storage and audit events.
- Argon2id password verification and one-time Owner bootstrap; random bearer sessions are stored as SHA-256 digests and can be revoked.
- TOTP MFA enrollment and verification; MFA secrets are encrypted with AES-256-GCM using a private environment key. Enabling MFA revokes existing sessions.
- Owner-only user administration and account activation/deactivation.
- Wallet creation, wallet balances and transaction history.
- Deposit, withdrawal and same-currency transfer requests; requests remain pending until Owner approval.
- Owner approval/rejection routes; posting writes balanced entries inside a database transaction and checks available balance.
- GitHub Actions now provisions a disposable PostgreSQL 16 service, applies migrations, bootstraps a test-only Owner and runs unit plus API integration tests.
- Latest verified test run: **16 passed, 0 failed**. The PostgreSQL-backed integration test covers health/readiness, Owner login, MFA enrollment and re-login, session revocation, Owner-only access, member creation, wallet deposit, transfer, withdrawal, balance calculations, insufficient-funds protection and logout.

## Not yet implemented / production verification outstanding
- Cloud deployment and a persistent production PostgreSQL instance; HTTPS/TLS, production secrets, backups/restore drills, monitoring and alerting.
- Password reset and MFA recovery codes, login notifications, stronger account lockout controls and independent security review.
- Live FX provider integration, quote freshness/validation and cross-currency conversion. The exchange_rates table is storage only.
- External payment-provider integrations. EasyPaisa, JazzCash, IQ Option, Neteller and Skrill are not connected; no real-money movement is implemented.
- Offline sync and conflict handling.
- Broader integration, concurrency, migration-upgrade, backup/restore and penetration testing.

## Safety and deployment rule
This is a tested development foundation, not a production-ready financial service. Do not expose it publicly or enter real financial records until deployment hardening, backup/restore verification and independent security review are complete. Never commit passwords, API keys, MFA seeds, recovery codes or production connection strings.

## Financial invariant
Every posted transaction must balance to zero per currency. Transfers and withdrawals are authorized server-side and posted atomically. Idempotency keys prevent duplicate requests. Historical transactions must not be silently repriced when exchange rates change.
