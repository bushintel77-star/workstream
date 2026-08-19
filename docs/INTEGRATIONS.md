# Integrations hub

Workstream connects to external tools from **Settings → Integrations** and
**Settings → Integration hub** (status, tests, event log).

## Plans

| Plan | Integrations |
|------|----------------|
| **Lite** | Save keys; **dev fallbacks** for AI/maps/accounting; CRM/email sync skipped or test-only |
| **Studio** | **Live** calls when keys are set |

Upgrade: **Settings → Integration hub → Upgrade to Studio** (Stripe Checkout when
`STRIPE_STUDIO_PRICE_ID` is set; otherwise dev unlock).

| Method | Path |
|--------|------|
| POST | `/integrations/plan/checkout` — returns `{ checkout_url }` |
| POST | `/integrations/plan/upgrade` — dev `{ "plan": "studio" }` |

## Connectors

| Channel | Settings keys | Use |
|---------|---------------|-----|
| Anthropic | `ANTHROPIC_API_KEY` | Design, audit, vision |
| OpenAI | `OPENAI_API_KEY` | Whisper transcription |
| Vicmap (keyless) | none | GNAF addresses, cadastre, overlays, StateView ortho aerial |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Portal deposits |
| MYOB | `MYOB_ACCESS_TOKEN`, `MYOB_COMPANY_FILE_ID` | Invoice drafts |
| Xero | `XERO_ACCESS_TOKEN`, `XERO_TENANT_ID` | Invoice drafts |
| CRM | `CRM_WEBHOOK_URL` | POST JSON → **n8n → Zoho CRM** ([setup](CRM-ZOHO.md)) |
| Email | `RESEND_API_KEY`, `EMAIL_FROM` | Client quote pack |

## CRM webhook payload

```json
{
  "source": "workstream",
  "event": "project.created | quote.generated | manual.sync",
  "project_id": "uuid",
  "address": "site address",
  "status": "draft",
  "client_name": "optional",
  "quote_url": "optional",
  "portal_url": "optional"
}
```

**Auto events:** `project.created` on new project; `quote.generated` when quote output is created (Studio + webhook set).

**Manual sync:** `POST /projects/:id/integrations/sync` with optional `to_email`, `client_name`, `include_portal`.

## Email

Resend sends plain-text quote pack when Studio + keys set and `to_email` provided on sync.

## API

| Method | Path |
|--------|------|
| GET | `/integrations/hub` |
| POST | `/integrations/hub/test` `{ "channel": "crm", "to_email"?: "..." }` |
| POST | `/integrations/plan/upgrade` `{ "plan": "studio" }` |
| POST | `/projects/:id/integrations/sync` |

See [PLANS.md](PLANS.md) for Lite vs Studio policy.

## CRM (Zoho) — quick link

Curtis & Co default: **[CRM-ZOHO.md](CRM-ZOHO.md)** — Zoho CRM Free + n8n production
webhook URL in `CRM_WEBHOOK_URL`.
