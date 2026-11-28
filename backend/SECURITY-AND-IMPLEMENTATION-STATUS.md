# DUB Digital System — Backend status

Developer / Creator: **Shakeel Faisal**

This status reflects the current source files on the `backend-foundation` branch. Source-code presence does not mean production deployment or end-to-end verification.

## Implemented in source
- Express API with Helmet, JSON size limit, exact-origin CORS allow-list, global and authentication rate limits, health and database-readiness endpoints.
- PostgreSQL schema for a single Owner, users, sessions, wallets, transactions, balanced ledger entries, exchange-rate storage and audit events.
- Argon2id password verification and one-time Owner bootstrap; random bearer sessions are stored as SHA-256 digests and can be revoked.
- TOTP MFA enrollment and verification; MFA secrets are encrypted with AES-256-GCM using a private environment key.
- Owner-only user administration and account activation/deactivation.
- Wallet creation, wallet balances and transaction history.
- Deposit, withdrawal and same-currency transfer requests; requests remain pending until Owner approval.
- Owner approval/rejection routes; posting writes balanced entries inside a database transaction and checks available balance.
- Unit tests exist for authentication helpers, authorization, IDs, MFA encryption and money parsing.

## Not yet verified / outstanding
- Automated test execution result for the current commit and PostgreSQL-backed integration tests for migrations, login/session lifecycle, MFA routes, Owner permissions, transaction approval/rejection, concurrency and ledger balance invariants.
- Provisioning and operation of a real PostgreSQL instance; migration execution against that instance.
- Cloud deployment, HTTPS/TLS, production secrets, database backups and restore drills, monitoring and alerting.
- Password reset and MFA recovery codes, login notifications, stronger account lockout controls and independent security review.
- Live FX provider integration, quote freshness/validation and cross-currency conversion. The exchange_rates table is only storage at present.
- External payment-provider integrations. EasyPaisa, JazzCash, IQ Option, Neteller and Skrill are not connected; no real-money movement is implemented.
- Offline sync and conflict handling.

## Safety and deployment rule
This is a development foundation, not a production-ready financial service. Do not expose it publicly or enter real financial records until database-backed integration tests, deployment hardening, backup/restore verification and independent security review are complete. Never commit passwords, API keys, MFA seeds, recovery codes or production connection strings.

## Financial invariant
Every posted transaction must balance to zero per currency. Transfers and withdrawals must be authorized server-side, recorded atomically, idempotently and audibly. Historical transactions must not be silently repriced when exchange rates change.
