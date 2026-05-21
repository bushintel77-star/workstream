import type { WorkspacePlan } from "@workstream/contracts";

export type SetupChannel = {
  channel: string;
  label: string;
  configured: boolean;
  live: boolean;
};

export type SetupStep = {
  id: string;
  label: string;
  href: string;
  done: boolean;
};

export function buildIntegrationSetupSteps(
  plan: WorkspacePlan,
  channels: SetupChannel[],
): SetupStep[] {
  const by = (c: string) => channels.find((x) => x.channel === c);
  const need = (c: string) => {
    const row = by(c);
    return plan === "studio" && row ? !row.live : false;
  };

  const steps: SetupStep[] = [
    {
      id: "plan",
      label:
        plan === "studio"
          ? "Studio plan active"
          : "Upgrade to Studio for live integrations",
      href: "/settings#hub",
      done: plan === "studio",
    },
    {
      id: "mapbox",
      label: "Mapbox — site aerial and geocode",
      href: "/settings#geo",
      done: !need("mapbox") && (by("mapbox")?.configured ?? false),
    },
    {
      id: "ai",
      label: "Anthropic + OpenAI — design and transcription",
      href: "/settings#ai",
      done:
        !need("anthropic") &&
        !need("openai") &&
        (by("anthropic")?.configured || by("openai")?.configured) === true,
    },
    {
      id: "crm",
      label: "Client sync — Zoho webhook in CRM settings (background)",
      href: "/settings#crm",
      done: by("crm")?.configured ?? false,
    },
    {
      id: "email",
      label: "Resend — client quote emails",
      href: "/settings#email",
      done: by("email")?.configured ?? false,
    },
    {
      id: "accounting",
      label: "MYOB or Xero — invoice drafts",
      href: "/settings/accounting",
      done:
        (by("myob")?.live ?? false) || (by("xero")?.live ?? false),
    },
    {
      id: "stripe",
      label: "Stripe — portal deposits",
      href: "/settings#payments",
      done: by("stripe")?.live ?? false,
    },
  ];

  return steps;
}
