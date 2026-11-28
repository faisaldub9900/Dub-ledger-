# DUB Digital System — Backend Foundation

Developer / Creator: **Shakeel Faisal**

This folder is the initial API-server foundation for DUB Digital System. It is separate from the Debian-based desktop ISO build kit.

## Requirements

- Node.js 20 or newer
- npm

## Run locally

1. Copy `.env.example` to `.env`.
2. Review `HOST`, `PORT`, and set `CORS_ORIGIN` to the exact frontend origin.
3. Run `npm install`.
4. Run `npm start`.
5. Check `http://127.0.0.1:8080/health` (or the configured host and port).

## Current scope

- Express API process
- Basic security headers with Helmet
- Strict JSON body limit
- Exact-origin CORS allow-list
- Basic request rate limiting
- Health endpoint and graceful shutdown
- No public sign-up, wallet mutation, or withdrawal endpoints

## Important security status

This is a **development foundation, not a production-ready financial server**. It is not deployed or connected to a database yet. Do not expose it to the public internet or enter real financial data.

## Required next stages

1. Inspect and integrate the existing DUB application source from the Cloud Build Kit archive.
2. Add PostgreSQL schema and migrations for users, sessions, wallets, ledger accounts, and immutable double-entry transactions.
3. Implement the single designated Owner/Super Admin, password hashing, MFA, session revocation, and server-side authorization (deny by default).
4. Add approval-gated transfers and withdrawals, idempotency, audit events, and reconciliation tests.
5. Add encrypted backups, restore tests, and offline synchronization rules.
6. Run automated tests and security review before deployment.

The owner identity must be configured securely during deployment; no credentials or secrets belong in source control.
