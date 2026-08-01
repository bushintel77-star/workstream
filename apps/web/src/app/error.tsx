"use client";

import Link from "next/link";
import { useEffect } from "react";
import s from "../styles/app.module.css";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app]", error.digest ?? error.message, error);
  }, [error]);

  return (
    <main className={s.pageNarrow}>
      <header className={s.masthead}>
        <div className={s.brand}>
          Something went wrong
          <span className={s.brandSub}>Workstream</span>
        </div>
        <Link href="/home" className={s.crumb}>
          ← Projects
        </Link>
      </header>

      <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden style={{ opacity: 0.3, marginBottom: 16 }}>
        <circle cx="32" cy="32" r="28" stroke="var(--ink-tertiary)" strokeWidth="1.5" />
        <line x1="32" y1="32" x2="48" y2="16" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
        <line x1="32" y1="32" x2="20" y2="48" stroke="var(--ink-secondary)" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="32" cy="32" r="3" fill="var(--accent)" />
      </svg>

      <h1 className={s.headline}>That didn&apos;t land.</h1>
      <p className={s.lede}>
        The page hit an error. Most often that&apos;s the API briefly waking up
        — wait a beat and try again. If it persists, screenshot this and send it
        through.
      </p>

      {error.digest ? (
        <p className={`${s.mono} ${s.dim} ${s.tiny}`}>ref: {error.digest}</p>
      ) : null}

      <div className={s.actionBar}>
        <button type="button" className={s.btn} onClick={() => reset()}>
          Try again
        </button>
        <Link href="/home" className={`${s.btn} ${s.btnGhost}`}>
          Back to projects
        </Link>
      </div>
    </main>
  );
}
