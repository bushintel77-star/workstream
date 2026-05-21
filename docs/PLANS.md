# Plans — Lite (free) vs paid integrations

Product policy for **Workstream** when offered as a commercial service (beyond
Curtis & Co internal use). **Not enforced in code yet** — documents intent for
pricing, marketing, and future Stripe seat gating.

## Lite (free) — first user

**Who:** one operator login (one Clerk user / one `owner_id` workspace).

**Included at no charge:**

| Capability | Notes |
|------------|--------|
| Core pipeline | Voice → survey → design studio → costing → audit → outputs |
| Design studio | Catalog, sketch, envelope estimate, develop-from-sketch |
| Dev fallbacks | Missing API keys use canned AI/transcripts/maps so the app is usable zero-keys |
| Client portal | Magic links (operator sends URL manually) |
| Settings | Rate card, plant palette, crew, design assets |

**Not included on Lite (or live keys disabled until upgrade):**

- Live **Anthropic** / **OpenAI** (beyond dev fallback caps if any)
- Live **Mapbox** geocode/aerial
- **Stripe** live deposit checkout
- **MYOB** / **Xero** live invoice sync
- Future **email** send (Resend / M365) — paid integration only
- **Extra operator seats** (second login)

Lite is intentionally **full product depth for one person**, not a crippled
demo. Integrations are the upsell, not the sketch/quote workflow.

## Studio (paid)

**Who:** same product, **live integrations** and optional **extra seats**.

| Add-on | Billing shape (target) |
|--------|-------------------------|
| **Integrations pack** | Monthly subscription unlocks live keys: AI, Mapbox, Stripe, MYOB/Xero |
| **Extra seats** | Per-seat monthly on top of pack (2nd user, office, etc.) |
| **Email** (future) | Part of integrations pack or small add-on |

**First user stays on Lite** until the studio owner upgrades the workspace.
Upgrading does not remove Lite access for user 1 — it **unlocks** live connectors
for that workspace.

## Integration matrix

| Integration | Lite | Studio (paid) |
|-------------|------|----------------|
| Clerk auth | 1 user | 1 user + paid seats |
| Anthropic (design, audit) | Dev fallback | Live API |
| OpenAI (Whisper) | Dev fallback | Live API |
| Mapbox | Dev fallback | Live token |
| Stripe (portal deposit) | Dev checkout URL | Live Checkout |
| MYOB AccountRight | Dev invoice draft | Live draft |
| Xero | Dev invoice draft | Live draft |
| Email (not built) | — | Planned paid |
| CRM | **External** (free tier) | Same + Xero/MYOB live sync on Studio |

## Recommended stack (Curtis & Co intent)

**Workstream** = jobs: walkthrough, sketch, quote, audit, portal, permits.

**CRM** = **Zoho CRM Free** — headless substrate via **n8n** (not embedded UI).
See [CRM-ARCHITECTURE.md](CRM-ARCHITECTURE.md) and [CRM-ZOHO.md](CRM-ZOHO.md).

| Layer | Tool | Cost |
|-------|------|------|
| Operations | Workstream Lite | 1 user free; full pipeline |
| CRM | Zoho CRM Free + n8n | $0 tiers |
| Money | MYOB / Xero + Stripe | Workstream Studio when live keys needed |

**Handoff:** client name + email live in the CRM; each **project** in Workstream
uses site **address** (+ optional Xero/MYOB contact when on Studio). Operator
links them manually (same client, new job = new project).

Future optional: webhook or Zapier from Workstream “quote ready” → CRM deal
stage — not required for v1.

## What we are not building

- In-app CRM (contacts/leads DB) — use external free CRM instead
- Autonomous council lodgement or email without operator action

## Implementation punch list (commercial)

When productising:

1. `WorkspacePlan`: `lite` | `studio` on `owner_id`
2. Gate `hydrateEnvFromStore` / integration save: live keys only if `studio`
3. Stripe Subscription: **integrations pack** + **seat** price IDs
4. Clerk: org or allowlist; block 2nd member if `seats_used >= seat_limit`
5. Settings UI: plan badge, upgrade CTA, which integrations are live vs fallback

Until then, Curtis & Co runs with Fly secrets = effective Studio tier.

## Related docs

- [INTEGRATIONS.md](INTEGRATIONS.md) — hub API, CRM webhook, Resend, connector keys
- [QUOTE_WORKFLOW.md](QUOTE_WORKFLOW.md) — operator sequence
- [../OUTSTANDING.md](../OUTSTANDING.md) — engineering punch list
- Settings → Integrations (keys + hub; Studio unlocks live connectors)
