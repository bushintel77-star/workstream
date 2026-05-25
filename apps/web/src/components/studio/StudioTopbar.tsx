"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { usePWAInstall } from "../../hooks/usePWAInstall";
import { useToast } from "../ToastHost";
import { useStudioChromeOptional } from "./StudioChromeContext";
import tb from "./studioTopbar.module.css";

type Props = {
  projectId: string;
  projectAddress: string;
  extras?: ReactNode;
};

export function StudioTopbar({ projectId, projectAddress, extras }: Props) {
  const chrome = useStudioChromeOptional();
  const toast = useToast();
  const { canInstall, promptInstall } = usePWAInstall();

  async function copyStudioLink() {
    const url = `${window.location.origin}/projects/${projectId}/design?studio=desktop`;
    await navigator.clipboard.writeText(url);
    toast.show("Studio link copied.", "success");
  }
  return (
    <header className={tb.topbar} data-testid="studio-topbar">
      <div className={tb.left}>
        <Link
          href={`/projects/${projectId}/overview`}
          className={tb.back}
          aria-label="Back to project"
        >
          ←
        </Link>
        <p className={tb.title} title={projectAddress}>
          {projectAddress}
        </p>
        {extras ? <span className={tb.saveHint}>{extras}</span> : null}
      </div>
      <div className={tb.centre}>
        <p className={tb.workflow} data-testid="studio-workflow-badge">
          Professional sketch · Indicative geometry — not survey CAD
        </p>
      </div>
      <div className={tb.right}>
        <button
          type="button"
          className={tb.iconBtn}
          title="Command palette (Ctrl+K)"
          onClick={() => chrome?.onOpenCommandPalette?.()}
        >
          ⌘
        </button>
        {canInstall ? (
          <button
            type="button"
            className={tb.installBtn}
            data-testid="studio-pwa-install"
            onClick={() => void promptInstall()}
          >
            Install app
          </button>
        ) : null}
        <button
          type="button"
          className={tb.iconBtn}
          title="Copy studio link"
          aria-label="Copy studio link"
          onClick={() => void copyStudioLink()}
        >
          ↗
        </button>
      </div>
    </header>
  );
}
