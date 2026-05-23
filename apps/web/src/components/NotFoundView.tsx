import Link from "next/link";
import s from "../styles/app.module.css";

type Props = {
  title?: string;
  message: string;
};

/** Shared not-found shell for route boundaries and inline fallbacks. */
export function NotFoundView({
  title = "Not found",
  message,
}: Props) {
  return (
    <main className={s.pageNarrow}>
      <header className={s.masthead}>
        <div className={s.brand}>
          {title}
          <span className={s.brandSub}>Workstream</span>
        </div>
        <Link href="/" className={s.crumb}>
          ← Projects
        </Link>
      </header>
      <div className={s.empty}>{message}</div>
    </main>
  );
}
