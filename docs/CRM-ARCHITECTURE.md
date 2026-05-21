# CRM architecture — Curtis & Co / Workstream

Decision record. Complements [CRM-ZOHO.md](CRM-ZOHO.md) (setup) and
[PLANS.md](PLANS.md) (Lite vs Studio).

## Decision (locked)

| Layer | Product | Pattern |
|-------|---------|---------|
| **Job lifecycle** | **Workstream** | Native — survey, studio, costing, audit, quote, portal, permits |
| **Contacts / pipeline** | **Zoho CRM Free** | **Headless substrate** — sync via n8n webhook; operator UI in Workstream |
| **Accounting** | Xero / MYOB | Studio integrations |
| **Client-facing brand** | **Curtis & Co only** | Quotes, portal, Resend email — no Zoho branding |

**Not chosen:** iframe embed of vendor CRM, white-label CRM as the product, or
GoHighLevel as primary engine (US/marketing-centric; poor fit for Melbourne
design studio).

## Three architectural patterns (vendor-agnostic)

| Pattern | Description | Curtis & Co |
|---------|-------------|-------------|
| **Native embed** | Vendor UI inside your app (iframe / extensions) | Rejected — breaks seamless brand, brittle |
| **White-label SaaS** | Vendor runs stack; your domain/logo on *their* UI | Deferred — only if reselling CRM as a product |
| **Headless / API-first** | Your UI; vendor = data + logic + integrations | **Selected** — Workstream Client panel + webhook → Zoho |

Customers and day-to-day operators stay in **Workstream**. Zoho is optional
for full CRM views and reporting.

## Tradie / FSM insight

Generic CRM vendors optimise **contacts and comms**. Field service platforms
(ServiceM8, simPRO, AroFlo, Tradify) bundle **jobs, quotes, scheduling, site
photos, timesheets**.

Workstream is **not** “CRM with jobs added.” It is the **job and design
lifecycle** product. CRM is a **thin sync layer** (name, email, pipeline stage,
quote/portal URLs) — avoids rebuilding 70% of an FSM on top of contact records.

## Vendor shortlist (reference)

| Vendor | Strength | Weakness for us |
|--------|----------|-----------------|
| **Zoho CRM Free / OEM** | AU presence, extensible, solo free tier | Zia AI on paid tiers; OEM for full white-label CRM domain |
| **HubSpot API + own UI** | Mature APIs | Not free at scale; same headless pattern as Zoho |
| **GoHighLevel** | Real white-label resale | US telephony/SMS; marketing funnel DNA |
| **Twenty** | OSS, GraphQL, headless-friendly | Self-host ops; no built-in AU comms |
| **Salesforce embedded** | Enterprise | Overkill for solo / boutique studio |

**Current implementation:** Zoho Free + [n8n](https://n8n.io) production webhook
→ `CRM_WEBHOOK_URL` in Workstream Settings.

## Operator UX principle

| Audience | Sees |
|----------|------|
| **Client** | Curtis & Co quote, portal, email |
| **Operator (daily)** | Workstream — Client card per project (name, email, stage, sync, send quote pack) |
| **Operator (occasional)** | Zoho app — history, bulk pipeline, mobile CRM |

“Open Zoho only when you need the full CRM view” — routine updates from Workstream.

## When to revisit

| Trigger | Action |
|---------|--------|
| Solo studio, same brand | Keep Zoho Free + Workstream Client panel |
| Need `crm.curtisandco.com.au` with logo on CRM screens | Evaluate **Zoho OEM** program |
| Resell branded CRM to other landscapers | Evaluate **GoHighLevel** or Zoho OEM — new business line |
| Drop Zoho dependency | **Twenty** self-host or in-app client list (larger build) |
| Scheduling / timesheets / ServiceM8 parity | **FSM features in Workstream** — not a CRM swap |

## Related code and docs

- Project **Client** fields: `client_name`, `client_email`, `crm_stage`, `crm_synced_at`
- `PATCH /projects/:id/client` — save from Workstream UI
- `POST /projects/:id/integrations/sync` — quote pack + background CRM/email
- [INTEGRATIONS.md](INTEGRATIONS.md) — hub, channels, API
- [CRM-ZOHO.md](CRM-ZOHO.md) — Zoho + n8n setup steps
