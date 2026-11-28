# DUB Trading Ledger — IQ Option Integration Plan

**Product:** DUB Trading Ledger  
**Creator / Developer credit:** Shakeel Faisal  
**Purpose:** Extend the existing DUB Ledger with a reliable trading journal and account-reconciliation module.

## Important scope boundary

This module records and reconciles trading activity. It does not hold, transfer, or safeguard funds, place trades, or guarantee withdrawals. Funds remain with the broker, bank, or wallet provider.

## Planned capabilities

1. **Trading journal**
   - Record instrument, direction, stake, entry/close time, result, profit/loss, fees, and source reference.
   - Show daily and cumulative profit/loss, win/loss counts, and searchable history.
2. **IQ Option data import**
   - First investigate whether IQ Option provides an officially supported API or account export for the user's account and region.
   - Prefer an official API or user-exported CSV/report.
   - If no supported integration exists, provide a guided CSV import; do not scrape private endpoints or request/store the user's IQ Option password, session cookies, or 2FA codes.
   - Prevent duplicate imports using stable transaction/trade IDs where available; otherwise use a reviewable duplicate-check key.
3. **Wallet and cash ledger**
   - Separate balances for IQ Option, EasyPaisa, JazzCash, Bank, and Cash.
   - Record every transfer with source account, destination account, amount, currency, exchange rate, timestamp, and reference.
   - Update both account balances and the consolidated balance without treating an internal transfer as income or expense.
4. **Currency conversion**
   - Keep original USD amounts and the applied USD/PKR rate for auditability.
   - Allow a live rate provider when online and a clearly timestamped last-known/manual rate offline.
   - Never silently rewrite historical conversion rates.
5. **Offline-first storage and backup**
   - Save transactions locally so entry and review work offline.
   - Add encrypted export/backup and a restore/validation flow.
   - If cloud sync is later added, use conflict detection and preserve transaction history rather than silently overwriting records.

## Delivery stages

- **Stage 1 — Inspect current source:** unpack and review the existing Windows Cloud Build Kit and identify its application framework, data model, and build process.
- **Stage 2 — Ledger foundation:** add trading accounts, transaction schema, import history, and balance reconciliation.
- **Stage 3 — Import adapter:** implement the official API/export route that is actually available; otherwise implement CSV import.
- **Stage 4 — Offline and backup:** add local persistence, export, restore, and integrity checks.
- **Stage 5 — Test and package:** test duplicate imports, transfers, currency conversions, offline use, backup/restore, and Windows/mobile compatibility.

## Acceptance checks

- Importing the same trade file twice must not double-count trades.
- A transfer must decrease the source account and increase the destination account by the correctly converted amount.
- Deposits, withdrawals, trading P/L, and internal transfers must remain distinct transaction types.
- Offline entries must survive app restart and be included in backup.
- Restore must verify the backup before replacing local data.

## Current repository note

The repository currently contains a Windows Cloud Build Kit ZIP and a short README. The application source has not yet been inspected from this repository, so implementation must wait until the ZIP contents can be extracted and reviewed. No IQ Option connection is claimed or assumed at this stage.
