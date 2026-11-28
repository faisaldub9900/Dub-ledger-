# DUB Digital System — Backend Foundation

Developer / Creator: **Shakeel Faisal**

This folder contains the API backend foundation. It is separate from the Debian desktop ISO build kit.

## Requirements

- Node.js 20 or newer
- npm
- PostgreSQL 14 or newer

## Database setup

1. Copy `.env.example` to a private `.env` file.
2. Create a dedicated PostgreSQL database and a restricted application role.
3. Set `DATABASE_URL`; never commit real credentials.
4. Set `DATABASE_SSL=true` when the provider requires verified TLS.
5. Generate a random 32-byte key, base64-encode it, and set `MFA_ENCRYPTION_KEY` in the private environment. Back it up securely; losing it makes stored MFA secrets unreadable.
6. Run `npm install` and `npm run db:migrate`.

## Create the one Owner account

The bootstrap script creates the first and only Owner and refuses to run if an Owner already exists.

Set `OWNER_EMAIL`, `OWNER_NAME`, and a strong `OWNER_PASSWORD` (at least 14 characters) temporarily in a private shell or secret manager, then run:

```sh
npm run owner:bootstrap
```

Never put a real password in GitHub files, workflow YAML, screenshots, or chat. Remove the temporary password from the environment after bootstrap. The database enforces one Owner with a unique partial index. There is no public sign-up endpoint or public Owner-promotion endpoint.

## Authentication API

- `POST /auth/login` — email/password; MFA-enabled users must also send `mfa_code`
- `GET /auth/me` — current session user; send `Authorization: Bearer <token>`
- `POST /auth/logout` — revoke the current session
- `GET /owner/users` — Owner-only user list
- `POST /owner/users` — Owner-only creation of a normal user (cannot create another Owner)
- `PATCH /owner/users/:id/status` — Owner-only user activation/deactivation; revokes that user's sessions
- `POST /mfa/setup` — authenticated user starts authenticator-app enrollment
- `POST /mfa/verify` — authenticated user confirms a six-digit authenticator code and enables MFA

Password hashes use Argon2id. Session tokens are random bearer tokens; only SHA-256 digests are stored in PostgreSQL. Authenticator secrets are encrypted at rest with AES-256-GCM using the private `MFA_ENCRYPTION_KEY`. Sessions default to 12 hours and are capped at 7 days. Authentication endpoints have a dedicated rate limit.

During MFA setup, the secret and otpauth URI are returned once to the authenticated user for adding to an authenticator app. Keep that response private. Do not enable MFA until you have added the secret to the authenticator app and verified its current code.

## Wallets, ledger, and Owner approvals

- `GET /ledger/wallets` — authenticated user's active wallet balances
- `POST /ledger/wallets` — create a wallet; provide `name`, `currency` (ISO-style three-letter code), and `account_kind`
- `POST /ledger/transactions` — request a deposit, withdrawal, or same-currency transfer; send a decimal `amount` as a string and a unique `Idempotency-Key` header (12-128 characters)
- `GET /ledger/transactions` — user's transaction history
- `GET /approvals/pending` — Owner-only pending requests
- `POST /approvals/:id/approve` — Owner approves and posts the balanced ledger entries
- `POST /approvals/:id/reject` — Owner rejects a pending request

Every transaction remains pending until Owner approval. Deposits and withdrawals use an internal clearing wallet so every posted transaction balances to zero for its currency. Transfers cannot cross currencies or wallet owners. Withdrawals and transfers are rejected if the source wallet has insufficient funds. Amounts are stored as integer minor units; USD/PKR use two decimals, JPY zero, and KWD/BHD three. Currency conversion between different currencies is not yet enabled.

## Start and test

- `npm test` — unit tests
- `npm start` — start API
- `GET /health` — API process liveness
- `GET /ready` — PostgreSQL readiness

## Security status

This remains a **development foundation, not a production-ready financial service**. Source code now includes Owner bootstrap, password login, revocable sessions, and TOTP-based MFA enrollment/verification. These features still need automated integration tests against PostgreSQL and a security review. Password reset, recovery codes, login notifications, account lockout, financial posting services, Owner approval workflows, application integration, deployment, and independent security review remain outstanding.

Do not expose the API publicly or enter real financial data until the remaining controls and integration tests are complete. Use HTTPS in deployment and restrict database/network access.
