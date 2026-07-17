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
  const base = `/projects/${projectId}`;

  async function copyStudioLink() {
    const url = `${window.location.origin}${base}/design?studio=desktop`;
    await navigator.clipboard.writeText(url);
    toast.show("Studio link copied — share with the team.", "success");
  }

  return (
    <header className={tb.topbar} data-testid="studio-topbar">
      <div className={tb.left}>
        <Link
          href={`${base}/overview`}
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

      <nav className={tb.jumps} aria-label="One-click studio jumps">
        <Link href={`${base}/design`} className={`${tb.jump} ${tb.jumpActive}`}>
          Design
        </Link>
        <Link href={`${base}/costing`} className={tb.jump}>
          Quote
        </Link>
        <Link href={`${base}/design/cad`} className={tb.jump}>
          CAD
        </Link>
        <Link href={`${base}/outputs`} className={tb.jump}>
          Share
        </Link>
      </nav>

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
            Install
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
