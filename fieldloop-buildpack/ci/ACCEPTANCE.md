# FieldLoop v0.1 — Acceptance Gate

This is the definition of done. Every item is checked before the build is
reported complete. The HITL styling checkpoint (Phase 4) must pass before the CI
suite runs.

## Phase gates

### Phase 4 — HITL Styling Checkpoint (blocking)

- [ ] Component gallery rendered for all 12 screens with applied tokens.
- [ ] Active Tailwind/CSS-variable theme values match `DESIGN-SYSTEM.md`.
- [ ] Divergences between wireframe and token spec are listed and signed off.
- [ ] Human approval recorded.

### Phase 5 — CI gate (blocking)

- [ ] `pnpm typecheck` green.
- [ ] `pnpm lint` green at zero warnings.
- [ ] All touched/new unit tests green.
- [ ] Web build green; Expo export green.
- [ ] Seeded e2e smoke green.
- [ ] RLS isolation test green.

## Functional acceptance checklist

### Multi-entity
- [ ] Entity switcher isolates jobs per division.
- [ ] A user in one entity cannot read another entity's data (RLS verified).

### Offline mobile
- [ ] Create job, capture photos, complete JSA, and sign off fully offline.
- [ ] Actions queue locally and push in order on reconnect.
- [ ] Soft-delete tombstones sync; financial totals re-sync server-authoritative.

### Compliance
- [ ] COES triggers when value > $750 inc. GST.
- [ ] COES triggers for gasfitting / below-ground drainage / cooling towers.
- [ ] DBI triggers above $16,000 domestic; MDC above $10,000 with capped deposit.
- [ ] Gas soundness fails unless 5-minute zero-drop; backflow fails at ≤14 kPa.
- [ ] Dispute-Shield hash is deterministic and verifiable.

### Accounting
- [ ] MYOB push creates an Open (draft) invoice with tax-inclusive lines.
- [ ] Xero push creates a DRAFT ACCREC with correct TaxType/AccountCode.
- [ ] Duplicate invoice number is treated as idempotent.

### Safety & referral
- [ ] JSA/SWMS pre-start unlocks clock-in only when complete.
- [ ] Evidence gate enforces 1 before + 1 after photo before completion.
- [ ] Cross-trade referral posts a Block Kit lead to the target division channel.

## Report format

The implementer reports, per work stream: what was built, test results, any
deviations from this standard (with justification), and remaining blockers. A
deviation without an explicit decision is a failure of the gate.
