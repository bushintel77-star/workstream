"use client";

import Link from "next/link";
import s from "../styles/app.module.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en-AU">
      <body className={s.globalErrorBody}>
        <main className={s.pageNarrow}>
          <header className={s.masthead}>
            <div className={s.brand}>
              Workstream
              <span className={s.brandSub}>Hard error</span>
            </div>
            <Link href="/" className={s.crumb}>
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
            <button type="button" className={s.btn} onClick={() => reset()}>
              Reload
            </button>
            <Link href="/" className={`${s.btn} ${s.btnGhost}`}>
              Back to projects
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
