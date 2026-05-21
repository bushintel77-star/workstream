# CRM — Zoho CRM Free (Curtis & Co default)

Architecture rationale: [CRM-ARCHITECTURE.md](CRM-ARCHITECTURE.md).

**Workstream** = jobs by site address (sketch, quote, audit).  
**Zoho CRM Free** = contacts, leads, deals (up to **3 users**).  
**n8n** = glue (free cloud tier) — receives Workstream webhooks and writes to Zoho.

No CRM inside Workstream. This is the chosen external stack.

## Solo operator — free

**Zoho CRM Free** is built for small teams: **$0 for up to 3 users**, no card required.
A **solo operator** (one person) is well inside that — you are not paying for CRM seats.

| Solo need | Zoho Free |
|-----------|-----------|
| One login | Yes |
| Contacts, leads, deals | Yes |
| Pipeline stages | Yes |
| Pay only when you hire user 2–3 | Still free until you outgrow 3 users |

Workstream **Lite** = one operator free on the job side; Zoho Free = one operator free on
the client side. Same commercial idea.

## AI-ready (how the stack fits)

**AI-ready** here means the **workflow** is built for AI, not that Zoho Free includes
every Zoho “Zia” feature (Zia on CRM is mainly on **paid** Zoho editions).

| Layer | AI role |
|-------|---------|
| **Workstream** | Claude design, audit, transcription, sketch → quote (your AI co-pilot) |
| **n8n** | Optional extra AI step later (summarise transcript, tag lead) |
| **Zoho CRM** | Structured home for **outcomes** — deal stage, client name, quote/portal URLs from webhooks |

When Workstream generates a quote, Zoho receives `quote_url`, `portal_url`, and
`client_name` automatically — CRM stays in sync with AI output without retyping.

If you later want **Zia** inside Zoho (predictions, assistant), upgrade Zoho; until then
the solo stack is **Workstream AI + Zoho records**.

## Why Zoho here

| | |
|--|--|
| Solo / small studio | Free for 1–3 users — ideal for Curtis & Co scale |
| Pipeline | Leads/deals with stages (enquiry → quote → won/lost) |
| Region | Common with AU small business; pairs with Zoho Books if you ever need it |
| Workstream | Webhook → n8n → Zoho; deal updates when AI quote is ready |

## Architecture

```text
Workstream (Studio + CRM_WEBHOOK_URL)
    │  POST JSON
    ▼
n8n Webhook (production URL)
    │  Zoho CRM node (OAuth)
    ▼
Zoho CRM Free — Lead or Deal per event
```

## 1. Zoho CRM Free

1. Sign up: [Zoho CRM](https://www.zoho.com/crm/) → **Free** edition.
2. Create a pipeline (e.g. **Landscape**):
   - New enquiry
   - Quote sent
   - Deposit / won
   - Lost
3. Optional: custom field **Workstream project ID** (text) on Deals for linking back.

## 2. n8n workflow

1. [n8n.io](https://n8n.io) — free account.
2. New workflow:
   - **Webhook** — method POST, path e.g. `workstream-crm`, respond 200.
   - **Zoho CRM** — connect Zoho OAuth (CRM scope).
   - Branch on `{{ $json.body.event }}` (or `{{ $json.event }}` depending on n8n version):

| Workstream `event` | Zoho action (suggested) |
|--------------------|-------------------------|
| `project.created` | Create **Lead** — Company/Last name from address; Description = status |
| `quote.generated` | Create or update **Deal** — Deal name = address; Stage = Quote sent; add `quote_url`, `portal_url` in description |
| `manual.sync` | Same as quote — used by **Test** and **Send quote pack** |

3. **Activate** workflow → copy **Production webhook URL** (https://….app.n8n.cloud/webhook/…).

Example mapping (Deal on quote):

- **Deal Name:** `{{ $json.address }}`
- **Stage:** Quote sent (your pipeline)
- **Description:** `Quote: {{ $json.quote_url }}\nPortal: {{ $json.portal_url }}\nClient: {{ $json.client_name }}`
- **Closing Date:** optional

## 3. Workstream

1. **Settings → Integration hub** → **Upgrade to Studio** (or dev unlock).
2. **Settings → CRM** → paste n8n URL into **CRM webhook URL** → Save.
3. **Integration hub → CRM → Test** — should create a row in Zoho.
4. On a project with a quote: **Client handoff → Send quote pack** (CRM + optional email).

## Webhook payload (reference)

Workstream sends:

```json
{
  "source": "workstream",
  "event": "quote.generated",
  "project_id": "uuid",
  "address": "36 Wrights Terrace, Prahran VIC 3181",
  "status": "outputs",
  "client_name": "Eleanor Marsh",
  "quote_url": "https://workstream-api…/outputs/….html",
  "portal_url": "https://workstream-web…/portal/quote_view/…",
  "created_at": "2026-05-21T…"
}
```

## Seamless UX (same brand, one app)

You **work in Workstream** — Curtis & Co layout, client name, email, pipeline
stage (Enquiry → Quote sent → Won / Lost), portal link, quote send.

**Zoho is a sync target**, not a second workspace:

| You see | Where |
|---------|--------|
| Client + stage + sync status | Project → **Client** card |
| Quote + portal + email | Same card |
| Full CRM history (optional) | Open Zoho only when you need it |

Clients never see Zoho — only your quote and portal.

## Operator habit

| System | Holds |
|--------|--------|
| **Workstream** | Client on project, site, sketch, quote, audit, send |
| Zoho (background) | Mirror of deals for reporting / Zoho mobile app |
| Xero/MYOB (Studio) | Invoice, GST, payment |

New job → new project; set client once on the project — **Save and send quote pack**
updates Zoho without leaving the screen.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Test fails “not configured” | Save `CRM_WEBHOOK_URL`; Studio plan |
| n8n 404 | Workflow not active; wrong production URL |
| Zoho empty | Check n8n execution log; OAuth reconnect Zoho CRM |
| Duplicate deals | Add n8n step: search deal by `project_id` custom field before create |

See [INTEGRATIONS.md](INTEGRATIONS.md) for API paths and [PLANS.md](PLANS.md) for Lite vs Studio.
