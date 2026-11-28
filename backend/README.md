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
4. Set `DATABASE_SSL=true` when the database provider requires verified TLS.
5. Run `npm install`.
6. Run `npm run db:migrate` to apply the initial schema.

## Create the one Owner account

The bootstrap script creates the first and only Owner. It refuses to run if an Owner already exists.

Set `OWNER_EMAIL`, `OWNER_NAME`, and a strong `OWNER_PASSWORD` (at least 14 characters) temporarily in a private shell or secret manager, then run:

```sh
npm run owner:bootstrap
```

Do not put a real password in GitHub files, workflow YAML, screenshots, or chat. Remove the temporary password from the shell/secret store after bootstrap. The database enforces one Owner with a partial unique index. There is no public sign-up endpoint and no endpoint that can promote a user to Owner.

## Start and test

- `npm test` — unit tests
- `npm start` — start API
- `GET /health` — API process liveness
- `GET /ready` — PostgreSQL readiness
- `POST /auth/login` — email/password login
- `GET /auth/me` — current session user; send `Authorization: Bearer <token>`
- `POST /auth/logout` — revoke current session

Sessions use cryptographically random bearer tokens; only SHA-256 token digests are stored in PostgreSQL. Passwords are hashed with Argon2id. Authentication requests have a separate rate limit. Session lifetime defaults to 12 hours and is capped at 7 days.

MFA-enabled accounts are deliberately denied password-only sessions. The MFA challenge and enrollment flow are not yet implemented; do not enable `mfa_enabled` on an account until a tested MFA flow is deployed.

## Security status

This is still a **development foundation, not a production-ready financial service**. Login, session lookup/revocation, password hashing, and first-Owner bootstrap are implemented in source, but have not yet been exercised against a live PostgreSQL instance here. MFA, password reset, login notifications, account lockout, financial posting services, approval workflows, application integration, deployment, and independent security review remain outstanding.

Do not expose the API publicly or enter real financial data until the outstanding controls and integration tests are complete. Use HTTPS in any deployed environment and keep database/network access restricted.
