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
    const url = `${window.location.origin}${base}?mode=sketch`;
    await navigator.clipboard.writeText(url);
    toast.show("Canvas link copied — share with the team.", "success");
  }

  return (
    <header className={tb.topbar} data-testid="studio-topbar">
      <div className={tb.left}>
        <Link
          href={`${base}?mode=cad`}
          className={tb.back}
          aria-label="Back to canvas"
        >
          ←
        </Link>
        <p className={tb.title} title={projectAddress}>
          {projectAddress}
        </p>
        {extras ? <span className={tb.saveHint}>{extras}</span> : null}
      </div>

      <nav className={tb.jumps} aria-label="Canvas mode jumps">
        <Link
          href={`${base}?mode=sketch`}
          className={`${tb.jump} ${tb.jumpActive}`}
        >
          Sketch
        </Link>
        <Link href={`${base}?mode=quote`} className={tb.jump}>
          Quote
        </Link>
        <Link href={`${base}?mode=cad`} className={tb.jump}>
          CAD
        </Link>
        <Link href={`${base}?mode=share`} className={tb.jump}>
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
          title="Copy canvas link"
          aria-label="Copy canvas link"
          onClick={() => void copyStudioLink()}
        >
          ↗
        </button>
      </div>
    </header>
  );
}
