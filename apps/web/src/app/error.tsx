"use client";

import Link from "next/link";
import s from "../styles/app.module.css";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className={s.pageNarrow}>
      <header className={s.masthead}>
        <div className={s.brand}>
          Something went wrong
          <span className={s.brandSub}>Workstream</span>
        </div>
        <Link href="/" className={s.crumb}>
          ← Projects
        </Link>
      </header>

      <h1 className={s.headline}>That didn&apos;t land.</h1>
      <p className={s.lede}>
        The page hit an error. Most often that&apos;s the API briefly waking up
        — wait a beat and try again. If it persists, screenshot this and send it
        through.
      </p>

      {error.digest && (
        <p className={`${s.mono} ${s.dim} ${s.tiny}`}>ref: {error.digest}</p>
      )}

      <div className={s.actionBar}>
        <button type="button" className={s.btn} onClick={() => reset()}>
          Try again
        </button>
        <Link href="/" className={`${s.btn} ${s.btnGhost}`}>
          Back to projects
        </Link>
      </div>
    </main>
  );
}
