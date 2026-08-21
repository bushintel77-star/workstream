# FieldLoop v0.1 — CI Pipeline

Runs in the `fieldloop-app` repository. This file describes the gate; adapt the
concrete runner (GitHub Actions / GitLab CI) at scaffold time. The gate is the
same either way.

## Gate stages (in order)

1. **Install** — `pnpm install --frozen-lockfile`
2. **Typecheck** — `pnpm typecheck` across all workspaces (builds contract deps first).
3. **Lint** — `pnpm lint` at `--max-warnings 0`.
4. **Unit tests** — `pnpm test` (Vitest). Focus areas:
   - `compliance-engine`: hasher determinism + verification, COES/DBI/MDC
     thresholds, GST math, gas soundness, backflow (>14 kPa), TMV band.
   - `accounting-sync`: MYOB/Xero payload mapping (draft status, tax-inclusive
     lines, invoice-number idempotency).
   - `contracts`: Zod schema round-trips.
5. **Build** — `pnpm build` (web) and `pnpm --filter mobile export` (Expo bundle).
6. **E2E smoke** (seeded) — web scheduler → create job → mobile offline queue →
   sync → draft invoice payload. Runs against a Supabase test instance with
   `RATE_LIMIT_MAX` relaxed for test tenants.
7. **RLS isolation test** — a user in entity A must receive 0 rows from entity B.

## Example GitHub Actions workflow

```yaml
name: ci
on: [push, pull_request]
jobs:
  gate:
    runs-on: ubuntu-latest
    env:
      SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
      SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9.15.4 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm build
      - run: pnpm test:e2e
```

## Secrets required

| Secret | Purpose |
|--------|---------|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Test instance |
| `R2_*` | Photo upload (e2e only) |
| `MYOB_*`, `XERO_*` | Present only in the integration sandbox, never required for unit/lint/typecheck |
| `SLACK_*` | Webhook URLs (mocked in tests) |

Accounting and Slack connectors are **mocked** in unit tests and the CI e2e
smoke; no live credentials are required to pass the gate.
