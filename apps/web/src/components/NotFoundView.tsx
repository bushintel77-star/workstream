import Link from "next/link";
import { AppNav } from "./AppNav";
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
      <AppNav summary={null} />
      <div className={s.empty}>
        <h1 className={s.headline}>{title}</h1>
        <p className={s.lede}>{message}</p>
        <Link href="/" className={s.btn}>
          Go to dashboard
        </Link>
      </div>
    </main>
  );
}
