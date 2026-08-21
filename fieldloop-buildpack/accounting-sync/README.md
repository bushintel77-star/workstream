# FieldLoop v0.1 — Accounting Sync (MYOB + Xero)

Server-side connectors. Clients never hold accounting OAuth tokens; they trigger
a sync and the API resolves a fresh token from the `oauth_tokens` table.

## Modules

| File | Responsibility |
|------|----------------|
| `token-store.ts` | Generic OAuth token store + `ensureFreshToken` refresh helper. |
| `myob.ts` | MYOB Business API v2: company files, draft invoice push, refresh. |
| `xero.ts` | Xero Accounting API: contacts, draft invoice (ACCREC) push, refresh. |

## Setup (secrets via env, never committed)

### MYOB Business API v2

1. Register an app at developer.myob.com → obtain `clientId`, `clientSecret`,
   and an API key (`MYOB_API_KEY`).
2. Complete the OAuth2 authorization-code flow (scope `CompanyFile`) to obtain
   an initial `access_token` + `refresh_token` + `companyFileUri`.
3. Store `{ access_token, refresh_token, expires_at, company_file_uri }` in
   `oauth_tokens` for the entity.
4. Env: `MYOB_CLIENT_ID`, `MYOB_CLIENT_SECRET`, `MYOB_API_KEY`.

Tax codes are resolved per company file (`TaxCode.UID`); do not hardcode — GST
is typically the `GST` code, GST-free is `FRE`. Resolve at setup and store the
UIDs per entity.

### Xero

1. Create an OAuth2 app at developer.xero.com → `clientId`, `clientSecret`.
2. Complete the authorization-code flow (scope `accounting.transactions`,
   `accounting.contacts`) and connect to a tenant to obtain `tenant_id`.
3. Store `{ access_token, refresh_token, expires_at, tenant_id }` in
   `oauth_tokens`. Xero refresh tokens **rotate** — always persist the new
   refresh token returned by a refresh.
4. Env: `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`.

## Two-way sync contract

- **Pull:** contacts (and accounts) so office staff map a FieldLoop client to a
  `ContactID` / `UID`.
- **Push:** itemized **draft** sales invoices (`Status: Open` in MYOB,
  `Status: DRAFT` in Xero) tied to the parent ABN. Invoices stay draft for human
  approval in the accounting package.

## Idempotency

Both connectors key on the invoice number. A duplicate-number error from MYOB or
Xero is treated as idempotent success; the sync job records the external
reference and does not retry.
