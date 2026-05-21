"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  copyPortalLinkAction,
  syncQuotePackAction,
} from "../app/actions";
import { buildWhatsAppShareUrl } from "../lib/share-links";
import fab from "./share-fab.module.css";
import { useToast } from "./ToastHost";

export type ProjectShareFabProps = {
  projectId: string;
  address: string;
  quoteUrl: string | null;
  hasQuote: boolean;
  clientName?: string | null;
  clientEmail?: string | null;
};

export function ProjectShareFab({
  projectId,
  address,
  quoteUrl,
  hasQuote,
  clientName,
  clientEmail,
}: ProjectShareFabProps) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function close() {
    setOpen(false);
  }

  function run(fn: () => Promise<void>) {
    startTransition(async () => {
      try {
        await fn();
      } catch (e) {
        toast.show(e instanceof Error ? e.message : "Failed", "error");
      }
    });
  }

  async function ensurePortalUrl(): Promise<string> {
    return copyPortalLinkAction(projectId);
  }

  async function shareText(lines: string[]) {
    const text = lines.filter(Boolean).join("\n");
    await navigator.clipboard.writeText(text);
    toast.show("Copied to clipboard", "success");
    close();
  }

  const items = [
    {
      id: "email",
      label: "Email quote",
      hint: "Plain-text email via Resend (no image attachment)",
      disabled: !hasQuote,
      onClick: () => {
        run(async () => {
          let email = clientEmail?.trim() ?? "";
          if (!email) {
            email =
              window.prompt("Client email address")?.trim() ?? "";
          }
          if (!email) {
            toast.show("Email required", "error");
            return;
          }
          const fd = new FormData();
          fd.set("projectId", projectId);
          fd.set("to_email", email);
          if (clientName) fd.set("client_name", clientName);
          fd.set("include_portal", "1");
          const result = await syncQuotePackAction(fd);
          toast.show(
            result.email
              ? `Email sent to ${email}`
              : "Sync skipped — check Studio + Resend in Settings",
            result.ok ? "success" : "error",
            5000,
          );
          close();
        });
      },
    },
    {
      id: "pack",
      label: "Quote pack + portal",
      hint: "Email, CRM sync, portal link together",
      disabled: !hasQuote,
      onClick: () => {
        run(async () => {
          let email = clientEmail?.trim() ?? "";
          if (!email) {
            email =
              window.prompt("Client email for quote pack")?.trim() ?? "";
          }
          const fd = new FormData();
          fd.set("projectId", projectId);
          if (email) fd.set("to_email", email);
          if (clientName) fd.set("client_name", clientName);
          fd.set("include_portal", "1");
          const result = await syncQuotePackAction(fd);
          toast.show(
            `Email ${result.email ? "sent" : "off"} · CRM ${result.crm ? "synced" : "off"}`,
            result.ok ? "success" : "error",
            6000,
          );
          close();
        });
      },
    },
    {
      id: "whatsapp",
      label: "Share on WhatsApp",
      hint: "Opens WhatsApp with quote + portal text",
      disabled: !hasQuote,
      onClick: () => {
        run(async () => {
          const portal = await ensurePortalUrl();
          const url = buildWhatsAppShareUrl({
            address,
            quoteUrl: quoteUrl!,
            portalUrl: portal,
            clientName: clientName ?? undefined,
          });
          window.open(url, "_blank", "noopener,noreferrer");
          close();
        });
      },
    },
    {
      id: "copy-quote",
      label: "Copy quote link",
      hint: "Paste into any message",
      disabled: !quoteUrl,
      onClick: () => {
        run(async () => {
          await shareText([`Quote — ${address}`, quoteUrl!]);
        });
      },
    },
    {
      id: "copy-portal",
      label: "Copy portal link",
      hint: "Client view-only link",
      disabled: false,
      onClick: () => {
        run(async () => {
          const portal = await ensurePortalUrl();
          await shareText([`Portal — ${address}`, portal]);
        });
      },
    },
    {
      id: "filing",
      label: "Plans and images",
      hint: "Title card, uploads, and site photos",
      disabled: false,
      onClick: () => {
        close();
        router.push(`/projects/${projectId}/filing`);
      },
    },
  ];

  return (
    <div className={fab.wrap}>
      {open && (
        <button
          type="button"
          className={fab.backdrop}
          aria-label="Close share menu"
          onClick={close}
        />
      )}
      {open && (
        <ul className={fab.menu} role="menu">
          {items.map((item) => (
            <li key={item.id} role="none">
              <button
                type="button"
                role="menuitem"
                className={fab.menuItem}
                disabled={pending || item.disabled}
                onClick={item.onClick}
              >
                {item.label}
                <span className={fab.menuHint}>{item.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        className={fab.fab}
        aria-label="Share"
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={pending}
        onClick={() => setOpen((v) => !v)}
      >
        {pending ? (
          "…"
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
        )}
      </button>
    </div>
  );
}
