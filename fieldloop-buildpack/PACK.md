# FieldLoop v0.1 — Implementation Standard

> **Normative.** This document and the files it references define the standard
> that FieldLoop v0.1 must meet. Any instruction (chat, ticket, or other) that
> contradicts a file in this pack is void — the file wins.
>
> **Riding principle.** This standard is a loose rein. It pins the destination
> (the verification gate), the guardrails (the SHALL / SHALL NOT constraints),
> and the non-negotiables (identity, design intent, compliance). Everything else
> — code structure, library choices within the stack, component implementation —
> is the implementer's free head. Prescribe the outcome, not the steps.
>
> **One exception: the design aesthetic is fully specified, never loose.**
> `DESIGN-SYSTEM.md` is prescriptive by design — every token, material, card
> variant, and interaction principle is canonical. The implementer has no free
> head on how it looks: it is rendered exactly as specified, down to hex values
> and radii. Loose reins apply to how the system is built, never to how it
> presents.
>
> **The rider's posture — tight by design.** Loose reins never mean a loose
> rider. The implementer finds its own way and rhythm; the standard holds its
> own position firmly, without gripping the horse's mouth:
>
> - **Thighs and knees tight** — the grip that never relaxes: tenancy (RLS
>   isolation by `parent_abn`), auth boundaries, server-authoritative financials,
>   and the `packages/contracts` boundary. Security and data integrity hold firm
>   no matter how freely the horse strides.
> - **Back straight** — the standard's integrity: the verification gate is
>   enforced, deviations require explicit sign-off, and the honesty notes stand.
>   No slouching, no silent shortcuts.
> - **Elbows in** — scope discipline: the 12 screens, four entities, the pinned
>   integrations. The surface stays compact; the implementer chooses its own
>   cadence but never wanders off the course.

## 1. Scope

Implement FieldLoop v0.1: an offline-first field operations platform for
Chatsworth Constructions Pty Ltd and its four operating entities (Chatsworth
Constructions general building, Caulfield South Plumbing, Majon Kitchens, Roof
Distributors), per this standard:

- **Mobile (Expo/React Native):** 100% offline via WatermelonDB with action
  queuing; JSA/SWMS pre-start, vehicle/hazard log, voice capture, evidence gate,
  compliance certificates, client signoff + Dispute-Shield, quotes, POs,
  timesheets, tax invoices.
- **Web (Next.js 15):** desktop-first multi-entity dispatch canvas with
  drag-and-drop scheduling and fallback division views.
- **Backend (Supabase + R2):** Postgres RLS isolated by parent ABN; R2 site photos.
- **Integrations:** MYOB Business API v2, Xero, VBA360 (adapter), Slack webhooks,
  Google Workspace (Gmail + Sheets).

The pack contains the canonical migrations, connector source, compliance engine,
design tokens, and wireframes. The implementation **assembles the application
around them** — it does not redesign them.

## 2. Normative references

| File | Standard |
|------|----------|
| `SPEC.md` | Technical specification (architecture, hierarchy, integration suite) |
| `COMPANY-PROFILE.md` | Corporate identity (ABN/ACN, entities) |
| `DESIGN-SYSTEM.md` | Precision Glass-Chrome tokens, card directive, interaction principles |
| `WIREFRAMES.md` | The 12 screens — the canonical UI contract |
| `FORMS.md` | Form/input patterns and the screen → field → schema mapping |
| `COMPLIANCE.md` | Victorian statutory triggers and artefacts |
| `database/` | Postgres migrations, WatermelonDB schema, sync contract |
| `auth/AUTH.md` | Auth and RLS tenant isolation |
| `accounting-sync/` | MYOB + Xero connectors, OAuth token store |
| `compliance-engine/` | Hasher, VBA triggers, gas validators, Slack, VBA client |
| `integrations/` | Google Workspace (Gmail + Sheets) office workflow |
| `ci/` | Verification gate and acceptance criteria |

## 3. Target repository layout

```
fieldloop-app/
├── package.json                  # pnpm workspace root, Node 22, Turbo
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
├── .env.example                  # non-secret placeholders only
├── packages/
│   ├── contracts/                # Zod schemas — the API/client contract boundary
│   ├── database/                 # Supabase migrations (from database/*.sql)
│   ├── accounting-sync/          # MYOB + Xero connectors (from accounting-sync/*)
│   ├── compliance-engine/        # hasher, VBA triggers, gas tests, Slack, VBA client
│   └── integrations/             # Google Workspace: Gmail + Sheets (from integrations/*)
├── apps/
│   ├── web/                      # Next.js 15 App Router + shadcn/ui + Tailwind
│   ├── mobile/                   # Expo + WatermelonDB
│   └── mcp-server/               # MCP capability layer (RLS-scoped tools)
└── supabase/
    ├── migrations/               # 001_initial_schema.sql, 002_rls_and_helpers.sql
    └── config.toml
```

## 4. Build standard (ordered work streams)

### 4.1 Scaffold

- pnpm workspace monorepo with Turbo, Node 22, TypeScript strict.
- `apps/web`: Next.js 15 App Router, Tailwind, shadcn/ui, CSS Modules where it
  keeps concerns local, Tailwind for layout/spacing.
- `apps/mobile`: Expo (managed workflow), WatermelonDB.
- `packages/contracts`: Zod schema boundary — contracts change before the API or
  any client.
- Supabase local (`supabase start`) with migrations applied.
- `.env.example` only (Supabase URL/anon key, R2 keys, MYOB/Xero/Google client
  ids, Slack webhook URLs). No secrets committed.

### 4.2 Database

- Apply `database/001_initial_schema.sql` and `database/002_rls_and_helpers.sql`.
- Generate TypeScript types from the schema into `packages/contracts`.
- WatermelonDB schema per `database/watermelon-schema.ts`; sync layer per
  `database/sync-contract.md`.
- Auth + tenancy per `auth/AUTH.md`: Supabase Auth, `entity_members`, RLS
  isolated by `parent_abn`.

### 4.3 Integrations

- `packages/accounting-sync` per the canonical files in `accounting-sync/`
  (token store, MYOB, Xero).
- `packages/compliance-engine` per the canonical files in `compliance-engine/`
  (hasher, VBA triggers, gas/backflow/TMV validators, Slack webhooks, VBA client).
- `packages/integrations` (Google Workspace) per the canonical files in
  `integrations/` (Gmail intake + send, Google Sheets Bookings/Roster sync).
- Implement the MCP server per `integrations/mcp-server.md` — RLS-scoped tools
  registered from the module manifest, never raw SQL.
- Unit tests (Vitest) for every pure function: hasher determinism, COES/DBI/MDC
  thresholds, GST math, gas soundness rules, backflow/TMV pass logic, Slack block
  payload shape, MYOB/Xero invoice mapping, Gmail booking parsing, Sheets
  import/export.

### 4.4 UI

- The web canvas (`apps/web`) and the 12 mobile screens (`apps/mobile`) per
  `WIREFRAMES.md`, styled with `DESIGN-SYSTEM.md` tokens (cards per the card
  directive), inputs per `FORMS.md` (native pickers, voice, camera/scan,
  autosave, live validation).
- Desktop-first web; 56 px minimum touch targets and glass focus rings on mobile.
- No inline styles where a module or token exists. No CSS-in-JS.

### 4.5 Verification

- Run the verification gate (§6) only after the human review gate (§5) has
  passed.

## 5. Human review gate (mandatory)

The CI test suite MUST NOT run before:

1. A rendered component gallery of every screen with the applied tokens, plus
   the active Tailwind/CSS-variable theme values per `DESIGN-SYSTEM.md`.
2. A list of any divergence between wireframe and token spec, for sign-off.
3. Explicit human approval of tokens and layouts.

## 6. Verification gate

The implementation is not complete until all of the following pass:

1. `pnpm typecheck` green across the workspace.
2. `pnpm lint` green at zero warnings.
3. All touched/new unit tests green.
4. Web build green; Expo export green.
5. Seeded e2e smoke green: web scheduler → create job → mobile offline queue →
   sync → MYOB/Xero draft invoice payload.
6. RLS isolation test green: a user in one entity receives zero rows from
   another entity.
7. Every screen in `WIREFRAMES.md` exists and matches `DESIGN-SYSTEM.md`; every
   form field maps per `FORMS.md`.

## 7. Constraints (SHALL / SHALL NOT)

- SHALL NOT fabricate VBA360 endpoints; the adapter interface and manual-lodge
  fallback in `compliance-engine/vba-client.ts` are normative until a live API is
  confirmed.
- SHALL NOT commit secrets; MYOB/Xero/Google credentials and Slack webhook URLs
  are env-only. OAuth refresh tokens live server-side only.
- SHALL treat financial totals as server-authoritative and field capture as
  client-authoritative (`database/sync-contract.md`).
- SHALL keep the Zod contract boundary in `packages/contracts` as the single
  source for API/client types.
- SHALL use Conventional Commits; no emoji in code, commits, or docs except the
  customer-approved Slack payloads and wireframe UI copy.

## 8. Versioning & reporting

- Each change to this pack bumps the version (currently 0.1.0-FINAL) at the top
  of this file. Implementers declare the exact pack version they built against.
- Reporting: per work stream, report what was built, test results, deviations
  from this standard (with justification), and blockers. A deviation without an
  explicit decision is a failure of the gate.
