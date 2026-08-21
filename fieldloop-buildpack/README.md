# FieldLoop v0.1 — Build Standard

**Implementation standard:** tool-agnostic — any implementer (human or agent) builds from it
**Parent enterprise:** Chatsworth Constructions Pty Ltd (ABN 90 056 106 855 · ACN 056 106 855)
**Operating entities:** Chatsworth Constructions (general building) · Caulfield South Plumbing · Majon Kitchens · Roof Distributors
**Pack version:** 0.1.0-FINAL

This directory is the canonical, self-contained build standard for FieldLoop. It is
the **single source of truth** for implementing the product. It is *not* a finished
application — it is the specification, the canonical source modules, the database
migrations, and the verification gates that an implementer turns into the
`fieldloop-app` repository.

## What FieldLoop is

FieldLoop is a voice-first, offline-capable field operations platform for a
multi-entity Australian trade group. A technician in a basement or roof cavity runs
100% offline on a phone; an office scheduler drags jobs on a web canvas; accounting
flows to MYOB/Xero; VBA compliance certificates auto-trigger on statutory thresholds;
cross-trade referrals broadcast to Slack.

## Directory map

| Path | Contents |
|------|----------|
| `PACK.md` | **Entry point.** The implementation standard. Read this first. |
| `SPEC.md` | Full technical specification (architecture, hierarchy, integration suite). |
| `COMPANY-PROFILE.md` | Canonical corporate profile (About us, ABN/ACN, specialties, entity model). |
| `COMPLIANCE.md` | Victorian statutory & regulatory framework, with exact trigger rules. |
| `DESIGN-SYSTEM.md` | Precision Glass-Chrome (Leica-inspired) design tokens — Tailwind, CSS, React Native. |
| `WIREFRAMES.md` | The 12 end-to-end screen wireframes. |
| `FORMS.md` | Form-filling patterns (2026) + screen → field → schema mapping. |
| `database/` | Supabase Postgres migrations, WatermelonDB schema, offline sync contract, extensibility & partitioning. |
| `auth/` | Supabase Auth + RLS tenant-isolation model. |
| `accounting-sync/` | MYOB Business API v2 + Xero connectors, OAuth token store. |
| `integrations/` | Google Workspace (Gmail + Sheets) office workflow, MCP server spec. |
| `compliance-engine/` | Dispute-Shield hasher, VBA triggers, gas/backflow/TMV validators, Slack webhooks, VBA360 adapter. |
| `ci/` | CI pipeline config and the acceptance gate (including the HITL checkpoint). |

## Decisions locked in this pack (v0.1.0-FINAL)

| Decision | Locked value | Rationale |
|----------|-------------|-----------|
| Mobile platform | **Expo (React Native) only** | WatermelonDB (local SQLite sync) is native-only; no browser PWA target. |
| Backend | **Supabase (Postgres RLS) + Cloudflare R2** | Multi-tenant RLS isolated by parent ABN; zero-egress photo storage. |
| Web | **Next.js 15 (App Router) + shadcn/ui** | Desktop-first drag-and-drop scheduling canvas. |
| Accounting | **MYOB Business API v2 + Xero** | Two-way sync; itemized draft invoices tied to parent ABN. |
| Compliance | **VBA360 adapter + Dispute-Shield SHA-256** | Auto PIC stamping, $750 COES threshold, signature locks. |
| Event bus | **Outbound Slack webhooks** | Block Kit lead dispatch + OHS alerts. |
| Monorepo | **pnpm workspace + Turbo**, Node 22, TypeScript strict | Matches the harness's known-good tooling. |
| Tenancy | **RLS via `auth.uid()` + `entity_members`**, scoped by `parent_abn` | The original `current_setting` approach alone is unsafe; membership-based RLS is authoritative. |
| Entities | **4 operating entities** (parent general building + 3 divisions) | Matches the "four companies" in the corporate About us; ABN 90 056 106 855 / ACN 056 106 855. |

## How to build from this standard

1. Read `PACK.md` — it is the implementation standard and the definition of done.
2. Build work streams 1–4 (scaffold → database → connectors → UI).
3. **Hold at the human review gate:** Tailwind tokens and UI layouts require
   sign-off before the CI test suite may run.
4. After approval, run the verification gate (work stream 5) and report.

## Developing in parallel (many builders, one idea)

The pack is designed so many people or implementers can develop FieldLoop from
the same source of truth without colliding:

- **Pin the pack version.** Every pack change bumps the version in `PACK.md`
  (currently 0.1.0-FINAL). Each implementer declares which version they built
  against, so "different builds" are never silently divergent.
- **Split by package, not by screen.** `packages/contracts` is the Zod boundary —
  whoever owns contracts first pins every interface; database, accounting-sync,
  compliance-engine, integrations, web, and mobile then build independently
  against it.
- **Files beat instructions.** The pack is the shared memory: if any instruction
  contradicts a file here, the file wins. Deviations are logged, never silent.
- **One definition of done.** Every implementer ships against the same
  `ci/ACCEPTANCE.md` gate, so independent work merges into one consistent product.
- **One human review gate.** The styling review happens once (tokens and layouts),
  then the verification gate runs for all streams.

That way "plenty of people developing the idea" is a feature, not a coordination
problem.

## Honesty notes baked into the pack

- **VBA360 has no confirmed public REST API.** The pack ships a `VbaComplianceClient`
  adapter with a clearly-marked stub and a manual-lodge (PDF + email) fallback. The
  standard prohibits fabricating VBA360 endpoints; confirm live API access before
  wiring it.
- **MYOB/Xero OAuth** requires registered app credentials and (for MYOB) a
  company-file URI. The pack defines the token store and connectors; secrets come
  from env, never the repo.
- **The `e3b0c442…` hash** in the original spec is the SHA-256 of the empty string —
  a placeholder, not a real dispute-shield value. The hasher module fixes this with a
  canonical serialization.
