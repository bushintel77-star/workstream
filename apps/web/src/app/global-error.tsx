"use client";

import Link from "next/link";
import { useEffect } from "react";
import { KitButton } from "../components/ui/kit";
import s from "../styles/app.module.css";
import "../styles/globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void import("../lib/sentry").then(({ captureWebError }) => {
      captureWebError(error, { boundary: "global", digest: error.digest });
    });
  }, [error]);

  return (
    <html lang="en-AU">
      <body className={s.globalErrorBody}>
        <main className={s.pageNarrow}>
          <header className={s.masthead}>
            <div className={s.brand}>
              Workstream
              <span className={s.brandSub}>Hard error</span>
            </div>
            <Link href="/home" className={s.crumb}>
              ← Projects
            </Link>
          </header>

          <h1 className={s.headline}>Workstream hit a hard error</h1>
          <p className={s.lede}>
            Something at the root of the app failed to render. Reload, or head
            back to projects if the problem persists.
          </p>

          {error.digest ? (
            <p className={`${s.mono} ${s.dim} ${s.tiny}`}>ref: {error.digest}</p>
          ) : null}

          <div className={s.actionBar}>
            <KitButton variant="secondary" size="sm" onClick={() => reset()}>
              Reload
            </KitButton>
            <Link href="/home" className={s.crumb}>
              Back to projects
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
