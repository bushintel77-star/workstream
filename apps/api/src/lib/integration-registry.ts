export type IntegrationCategory =
  | "ai"
  | "geo"
  | "payments"
  | "auth"
  | "accounting"
  | "crm"
  | "email";

export type IntegrationDef = {
  key: string;
  label: string;
  description: string;
  env: string;
  category: IntegrationCategory;
  placeholder: string;
  /** Maps to integration hub channel for status/tests */
  channel: string | null;
};

export const INTEGRATION_REGISTRY: ReadonlyArray<IntegrationDef> = [
  {
    key: "ANTHROPIC_API_KEY",
    label: "Anthropic (Claude)",
    description:
      "Design, audit, and photo measurement. Lite uses dev fallback; Studio uses live API.",
    env: "ANTHROPIC_API_KEY",
    category: "ai",
    placeholder: "sk-ant-…",
    channel: "anthropic",
  },
  {
    key: "OPENAI_API_KEY",
    label: "OpenAI (Whisper)",
    description: "Site-walk transcription. Lite: dev fallback; Studio: live.",
    env: "OPENAI_API_KEY",
    category: "ai",
    placeholder: "sk-…",
    channel: "openai",
  },
  {
    key: "STRIPE_SECRET_KEY",
    label: "Stripe (secret)",
    description: "Portal deposit checkout sessions.",
    env: "STRIPE_SECRET_KEY",
    category: "payments",
    placeholder: "sk_live_… or sk_test_…",
    channel: "stripe",
  },
  {
    key: "STRIPE_WEBHOOK_SECRET",
    label: "Stripe webhook secret",
    description: "Verifies Stripe webhook signatures.",
    env: "STRIPE_WEBHOOK_SECRET",
    category: "payments",
    placeholder: "whsec_…",
    channel: "stripe",
  },
  {
    key: "CLERK_SECRET_KEY",
    label: "Clerk (secret)",
    description: "Production auth. Not plan-gated.",
    env: "CLERK_SECRET_KEY",
    category: "auth",
    placeholder: "sk_live_…",
    channel: null,
  },
  {
    key: "MYOB_ACCESS_TOKEN",
    label: "MYOB access token",
    description: "AccountRight invoice drafts from costing.",
    env: "MYOB_ACCESS_TOKEN",
    category: "accounting",
    placeholder: "Bearer token…",
    channel: "myob",
  },
  {
    key: "MYOB_COMPANY_FILE_ID",
    label: "MYOB company file ID",
    description: "Company file GUID for AccountRight API paths.",
    env: "MYOB_COMPANY_FILE_ID",
    category: "accounting",
    placeholder: "uuid…",
    channel: "myob",
  },
  {
    key: "XERO_ACCESS_TOKEN",
    label: "Xero access token",
    description: "OAuth2 access token for invoice drafts.",
    env: "XERO_ACCESS_TOKEN",
    category: "accounting",
    placeholder: "Bearer token…",
    channel: "xero",
  },
  {
    key: "XERO_TENANT_ID",
    label: "Xero tenant ID",
    description: "Connected organisation tenant.",
    env: "XERO_TENANT_ID",
    category: "accounting",
    placeholder: "uuid…",
    channel: "xero",
  },
  {
    key: "CRM_WEBHOOK_URL",
    label: "CRM webhook URL",
    description:
      "POST JSON to n8n → Zoho CRM (see docs/CRM-ZOHO.md) on project/quote events.",
    env: "CRM_WEBHOOK_URL",
    category: "crm",
    placeholder: "https://…",
    channel: "crm",
  },
  {
    key: "RESEND_API_KEY",
    label: "Resend API key",
    description: "Send quote pack emails to clients from Workstream.",
    env: "RESEND_API_KEY",
    category: "email",
    placeholder: "re_…",
    channel: "email",
  },
  {
    key: "EMAIL_FROM",
    label: "Email from address",
    description: "Sender for client emails (must match Resend verified domain).",
    env: "EMAIL_FROM",
    category: "email",
    placeholder: "quotes@curtisandco.com.au",
    channel: "email",
  },
] as const;

export const ALLOWED_INTEGRATION_KEYS = new Set(
  INTEGRATION_REGISTRY.map((i) => i.key),
);

export function integrationDef(key: string): IntegrationDef | undefined {
  return INTEGRATION_REGISTRY.find((i) => i.key === key);
}
