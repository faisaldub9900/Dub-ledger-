# DUB Digital System — Backend Foundation

Developer / Creator: **Shakeel Faisal**

This folder is the API-server foundation for DUB Digital System. It is separate from the Debian-based desktop ISO build kit.

## Requirements

- Node.js 20 or newer
- npm
- PostgreSQL 14 or newer

## Run locally

1. Copy `.env.example` to `.env`.
2. Create a dedicated PostgreSQL database and application role. Give the role only the permissions needed by this application.
3. Put the private PostgreSQL connection string in `.env` as `DATABASE_URL`. Never commit real credentials.
4. Review `HOST`, `PORT`, and set `CORS_ORIGIN` to the exact frontend origin.
5. Run `npm install`.
6. Run `npm run db:migrate` to apply the idempotent initial schema.
7. Run `npm test` for the authorization middleware tests.
8. Run `npm start`.
9. Check `/health` for API liveness and `/ready` for database readiness.

For managed PostgreSQL requiring TLS, set `DATABASE_SSL=true`. Certificate verification remains enabled.

## Current scope

- Express API process with security headers, strict JSON body limit, exact-origin CORS, and request rate limiting
- PostgreSQL connection pool and database readiness endpoint
- Initial PostgreSQL schema and repeatable schema application script
- Server-side authorization middleware helpers
- Unit tests for authenticated-user and owner-role middleware
- No public sign-up, wallet mutation, or withdrawal endpoints

## Important security status

This remains a **development foundation, not a production-ready financial server**. Database connectivity is implemented but has not been tested against a live database in this repository environment. Login/session verification, password hashing, MFA, owner bootstrap, financial posting services, approval workflows, and deployment are not yet implemented. The authorization helpers are not a substitute for a verified session-authentication layer.

Do not expose this API to the public internet or enter real financial data until the missing controls and integration tests are complete.

## Required next stages

1. Inspect and integrate the existing DUB application source from the Cloud Build Kit archive.
2. Implement secure owner bootstrap, password hashing, MFA, session verification, and session revocation.
3. Add audited, approval-gated transfers and withdrawals with atomic double-entry posting and idempotency.
4. Add reconciliation, exchange-rate provenance, encrypted backups, restore tests, and offline synchronization rules.
5. Run database integration tests and an independent security review before deployment.

The owner identity must be configured securely during deployment; no credentials or secrets belong in source control.
