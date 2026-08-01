"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "../components/ui";
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
    console.error("[global]", error.digest ?? error.message, error);
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
            <Button variant="secondary" size="sm" onClick={() => reset()}>
              Reload
            </Button>
            <Link href="/home" passHref>
              <Button as="a" variant="ghost" size="sm">Back to projects</Button>
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
