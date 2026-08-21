# FieldLoop v0.1 — Master Technical Specification

Parent enterprise: **Chatsworth Constructions Pty Ltd**
Operating entities: **Chatsworth Constructions (general building) · Caulfield South Plumbing · Majon Kitchens · Roof Distributors**
Document version: **0.1.0-FINAL**

## 1. System architecture & technical stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Field mobile app | React Native (Expo), **WatermelonDB** | 100% offline in basements/roof cavities with action queuing. Native-only DB — no PWA target. |
| Office web canvas | Next.js 15 (App Router) + shadcn/ui | Receptionist's console: drag-and-drop scheduling, roster, dispatch. PWA-installable; no Electron. |
| Backend & storage | Supabase (Postgres RLS) + Cloudflare R2 | Multi-tenant RLS isolated by parent ABN; R2 zero-egress site photo storage. |
| Accounting sync | MYOB Business API v2 + Xero API | Two-way sync: pull contacts/accounts; push itemized draft sales invoices tied to parent ABN. |
| Office workflow | Google Workspace (Gmail + Sheets) | Receptionist's tooling: inbound booking emails → job drafts; outbound confirmations/dispatch; Bookings/Roster Sheet sync. |
| Agent access | MCP server | Typed, RLS-scoped tools for AI agents; tool list built from the module manifest. |
| Compliance engine | VBA360 adapter + Dispute-Shield hasher | Auto-stamps Victorian PIC codes, enforces $750 COES threshold, SHA-256 signature locks. |
| Event broadcasting | Outbound Slack webhooks | Block Kit lead dispatch to division channels (#majon-kitchens-leads, #ohs-safety-alerts). |

## 2. Multi-entity enterprise hierarchy

FieldLoop isolates branding while consolidating corporate compliance and financial
accounting under a unified parent.

- **Parent:** Chatsworth Constructions Pty Ltd (ABN 90 056 106 855 · ACN 056 106 855).
- **Chatsworth Constructions (general building):** the parent's own operating
  entity — total building solutions, renovations, extensions, repairs.
- **Caulfield South Plumbing:** PIC Licence #118492 — general, gasfitting, drainage.
- **Majon Kitchens:** cabinetry, bathroom vanity repairs, custom joinery.
- **Roof Distributors:** metal and tile roofing repair and maintenance.

**Internal cross-trade referrals:** an on-site technician can flag a defect outside
their trade (e.g. a plumber flagging water-damaged cabinetry) to instantly dispatch a
pre-populated draft quote to the targeted division's pipeline via Slack.

## 3. UI design system

Full tokens in [`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md) (including the Precision
Glass-Chrome card directive); wireframes in [`WIREFRAMES.md`](WIREFRAMES.md);
form/input patterns and the screen→field mapping in [`FORMS.md`](FORMS.md). Core
Precision Glass-Chrome spec:

- Chassis: frosted smoked glass — `rgba(18,20,23,0.88)` with 20 px blur, milled
  1 px chrome stroke (`rgba(255,255,255,0.25)` → `rgba(0,0,0,0.8)`).
- Status LEDs: aperture red `#E60000`, amber `#FFB800`, pass green `#00C853` —
  functional marks only, zero ambient bleed.
- Type: DIN/Inter + tabular JetBrains Mono readouts; ink `#F8F9FA` / `#A1A1AA`.
- Touch: min 56 px height, 16 px padding; machined buttons with shutter-release press.
- Adaptive: solid `#121417` chassis fallback for reduced-transparency/contrast.

## 4. Database & integration suite

- Postgres core migration: [`database/001_initial_schema.sql`](database/001_initial_schema.sql)
- RLS + tenant helpers: [`database/002_rls_and_helpers.sql`](database/002_rls_and_helpers.sql)
- Offline sync schema: [`database/watermelon-schema.ts`](database/watermelon-schema.ts)
- Sync contract: [`database/sync-contract.md`](database/sync-contract.md)
- Auth/tenancy: [`auth/AUTH.md`](auth/AUTH.md)
- MYOB connector: [`accounting-sync/myob.ts`](accounting-sync/myob.ts)
- Xero connector: [`accounting-sync/xero.ts`](accounting-sync/xero.ts)
- OAuth token store: [`accounting-sync/token-store.ts`](accounting-sync/token-store.ts)
- Dispute-Shield hasher: [`compliance-engine/hasher.ts`](compliance-engine/hasher.ts)
- VBA/statutory triggers: [`compliance-engine/vba-triggers.ts`](compliance-engine/vba-triggers.ts)
- Gas/backflow/TMV validators: [`compliance-engine/gas-test.ts`](compliance-engine/gas-test.ts)
- Slack webhook engine: [`compliance-engine/webhooks.ts`](compliance-engine/webhooks.ts)
- VBA360 adapter: [`compliance-engine/vba-client.ts`](compliance-engine/vba-client.ts)
- Office workflow (Gmail + Sheets): [`integrations/google-workspace.md`](integrations/google-workspace.md)
- Gmail connector: [`integrations/gmail.ts`](integrations/gmail.ts)
- Google Sheets connector: [`integrations/sheets.ts`](integrations/sheets.ts)
- Extensibility & partitioning: [`database/EXTENSIBILITY.md`](database/EXTENSIBILITY.md)
- MCP server spec: [`integrations/mcp-server.md`](integrations/mcp-server.md)

### 4.1 Data model summary

- `entities` — one row per trading division, keyed to `parent_abn`.
- `entity_members` — maps an authenticated user (`auth.uid()`) to one or more
  entities; the authoritative RLS key.
- `jobs` — the central work order (`job_type`, `status`, site address, body-corp /
  insurance metadata, JSA/SWMS/COES flags, signature hash, totals).
- `job_line_items`, `quotes`, `quote_line_items` — financials.
- `photos`, `signatures`, `jsa_checklists`, `hazards` — field evidence & safety.
- `timesheets`, `purchase_orders`, `purchase_order_items` — labour & supply.
- `vba_certificates`, `backflow_tests` — compliance artefacts.
- `sync_outbox` — server-side action queue for offline replay.

## 5. Victorian statutory & regulatory framework

Binding detail in [`COMPLIANCE.md`](COMPLIANCE.md). Summary of triggers:

- **VBA Compliance Certificate (COES):** triggered when total job value exceeds
  **$750 inc. GST**, or the work involves gasfitting, below-ground sanitary drainage,
  or cooling towers. Lodged on VBA360 within 5 days of completion.
- **Gas soundness & pressure test (AS/NZS 5601):** static pressure, working pressure,
  5-minute zero-drop verification before gas reconnection sign-off.
- **Domestic Building Insurance (DBI):** domestic building/renovation contracts
  exceeding **$16,000**.
- **Major Domestic Building Contract:** consumer works exceeding **$10,000**; capped
  deposits (5% over $20k, 10% under $20k) and mandatory 5-day cooling-off disclosure.
- **Practitioner registration display:** invoices, quotes, and compliance forms render
  PIC #118492 alongside the parent ABN.

## 6. Cross-cutting rules

- GST is 10% (`total = subtotal * 1.1`); display AUD, `en-AU`.
- Financial totals are server-authoritative; field capture is client-authoritative.
- Contracts (`packages/contracts`) are the Zod boundary — change before API/client.
- No secrets in code; MYOB/Xero OAuth and Slack webhook URLs come from env.
- VBA360 is an adapter with a manual-lodge fallback until a public API is confirmed.
