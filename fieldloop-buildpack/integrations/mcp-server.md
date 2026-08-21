# FieldLoop v0.1 — MCP Server (agent capability layer)

## 1. What MCP is (and is not)

**Model Context Protocol** — an open standard for exposing typed tools and data
to AI agents (Claude, Remy, any MCP-capable harness). It is an **access layer**,
not a database and not a partitioning mechanism. Partitioning lives in Postgres
(see `database/EXTENSIBILITY.md`); MCP sits in front of the API and inherits the
same RLS scoping.

## 2. Purpose

Any agent can operate FieldLoop the way a person would — read jobs, create job
drafts, assess compliance, dispatch, trigger accounting sync — through typed
tools, scoped by the caller's identity → Supabase JWT → RLS. The mobile and web
apps are unaffected and do not depend on the MCP server.

## 3. Architecture

- Server-side TypeScript service (`apps/mcp-server`) using the
  `@modelcontextprotocol/sdk`.
- Authenticates like the API (Supabase JWT); every tool call runs through the
  domain/API layer — **never raw SQL** — and inherits tenant scoping.
- The tool list is **built from the module manifest**: a new domain module
  registers its tools and they appear automatically. No per-tool wiring.

## 4. Core tools (v0.1)

| Tool | Kind | Purpose |
|------|------|---------|
| `find_entity` | read | Division lookup |
| `get_job` | read | Read a job |
| `create_job_draft` | write | Create a job draft (incl. from a booking email) |
| `update_job_status` | write | Transition job status |
| `assess_compliance` | pure | Evaluate COES/DBI/MDC triggers |
| `dispatch_job` | write | Assign technician + time + Slack alert |
| `create_referral` | write | Cross-trade referral |
| `sync_accounting` | write | Trigger MYOB/Xero draft invoice push |

## 5. Rules

- **No raw SQL tool.** Read tools vs write tools are separated and
  permission-gated by role (`admin` / `scheduler` / `technician`).
- Every agent action is **audit-logged** with the acting identity.
- MCP adds capability; it never bypasses tenancy, compliance, or the
  verification gate. A tool that could violate RLS or the statutory triggers is
  a defect.
