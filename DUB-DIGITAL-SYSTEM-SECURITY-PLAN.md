# DUB Digital System — Security and Product Blueprint

**Product:** DUB Digital System / DUB Ledger  
**Owner model:** One Owner / Super Admin (the project owner)  
**Creator / Developer credit:** Shakeel Faisal  
**Status:** Architecture specification only; implementation must be integrated into the inspected application source.

## 1. Product boundary

DUB is a financial recordkeeping and account-reconciliation system. It records balances, deposits, withdrawals, transfers, trading journal entries, exchange rates, and supporting references. It does not itself hold customer funds or make bank, wallet, broker, or crypto withdrawals. Real money remains with the regulated bank, wallet, or broker provider. Any future provider connection must use that provider's official, supported integration and explicit user authorization.

## 2. Ownership and authorization

- Exactly one designated Owner / Super Admin account is provisioned during secure first-run setup.
- No public sign-up may create another Owner or Super Admin.
- Owner role assignment, recovery, and ownership transfer must require a separate, strongly authenticated and audited procedure.
- Other accounts, if later enabled, receive least-privilege roles (for example read-only or data-entry); they cannot grant themselves permissions.
- Enforce authorization on the server/API and data layer, not only by hiding buttons in the user interface.
- Deny by default. Every privileged operation must check the authenticated user, role, resource ownership, and session state.

## 3. Authentication and account protection

- Use a modern password hashing algorithm (Argon2id preferred; scrypt or bcrypt with current parameters if unavailable). Never store plaintext passwords.
- Require MFA for Owner access. Prefer passkeys/WebAuthn or TOTP; use one-time recovery codes stored hashed. SMS OTP is a fallback, not the only protection.
- Require recent re-authentication for changing security settings, exporting all data, restoring backups, or approving sensitive actions.
- Use secure, HttpOnly, SameSite cookies; rotate sessions after login and privilege changes; provide session revocation and device/session history.
- Rate-limit login, OTP, recovery, and sensitive endpoints; add temporary lockouts and security alerts without enabling easy denial-of-service.
- Never request or store broker passwords, wallet seed phrases, private keys, session cookies, or one-time codes.

## 4. Financial ledger integrity

- Store money as integer minor units (for example paisa) or fixed-precision decimal values; never use binary floating point for balances.
- Store original currency, converted amount, exchange rate, rate source, and rate timestamp separately.
- Transfers are atomic double-entry operations: debit the source and credit the destination; an internal transfer is not income or expense.
- Record deposits, withdrawals, fees, trading profit/loss, and internal transfers as distinct transaction types.
- Never silently rewrite historical rates or transactions. Corrections use reversal/adjustment entries with a reason and audit trail.
- Use unique idempotency keys for imports and transfer submissions to prevent duplicate posting.
- Reconcile account totals from the transaction journal; do not rely on editable balance fields as the source of truth.

## 5. Sensitive action controls

- DUB ledger entries for withdrawals are records only unless a supported provider integration is separately designed and approved.
- If a provider integration is added, require provider-side authorization, explicit confirmation of destination and amount, recent MFA, transaction limits, and a final review screen.
- DUB must never claim that an external withdrawal or transfer succeeded until the provider confirms it.
- Send alerts for new device logins, password/MFA changes, backup exports/restores, role changes, and sensitive financial actions.

## 6. Data protection and backups

- Minimize personal and financial data collected.
- Encrypt network traffic with TLS and encrypt sensitive data at rest using managed keys where a server is used.
- Keep secrets in environment/secret management, never in source code, browser storage, repository files, or logs.
- Provide encrypted backup export, checksum/integrity validation, and a restore preview before replacing current data.
- Preserve an audit log for create/update/reversal/export/restore/security events. Prevent ordinary users from editing or deleting audit records.
- Offline mode must clearly identify local-only changes and sync conflicts. Do not represent unsynced local data as cloud-backed.

## 7. Required testing before release

- Verify non-owner accounts cannot access Owner routes or APIs.
- Verify users cannot promote themselves or alter role claims.
- Test MFA, session revocation, brute-force throttling, and account recovery.
- Test atomic transfers, currency conversion precision, reversal entries, and duplicate imports.
- Test backup tampering detection and restore validation.
- Test offline operation, app restart persistence, and sync conflict handling.
- Run dependency and secret scanning; never publish credentials or real financial data in test fixtures.

## 8. Implementation gate

The repository currently includes a build-kit ZIP and ISO build workflows, but the actual application source has not yet been unpacked and reviewed in this working session. This document is a design baseline, not a claim that the security controls above are already implemented. Integrate these controls only after inspecting the real app framework, storage model, and deployment target.
