"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "../../../components/ui";
import s from "../../../styles/app.module.css";

/**
 * Studio-scoped boundary — keeps the operator on the project instead of a
 * full-app crash when CadPlan / Sketch / Fit sheet throw during render.
 */
export default function ProjectStudioError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[studio]", error.digest ?? error.message, error);
  }, [error]);

  return (
    <main className={s.pageNarrow}>
      <header className={s.masthead}>
        <div className={s.brand}>
          Studio interrupted
          <span className={s.brandSub}>Workstream</span>
        </div>
        <Link href="/home" className={s.crumb}>
          ← Projects
        </Link>
      </header>

      <h1 className={s.headline}>The drawing hit an error.</h1>
      <p className={s.lede}>
        Your last autosave may still be on the server. Try again to reopen the
        canvas, or go back to projects if it keeps failing.
      </p>

      {error.digest ? (
        <p className={`${s.mono} ${s.dim} ${s.tiny}`}>ref: {error.digest}</p>
      ) : null}

      <div className={s.actionBar}>
        <Button variant="secondary" size="sm" onClick={() => reset()}>
          Reopen studio
        </Button>
        <Link href="/home" className={s.crumb}>
          Back to projects
        </Link>
      </div>
    </main>
  );
}
