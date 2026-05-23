import Link from "next/link";
import { redirect } from "next/navigation";
import { SignIn } from "@clerk/nextjs";
import { clerkEnabled } from "../../../lib/auth";
import s from "../../../styles/app.module.css";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  if (!clerkEnabled) {
    redirect("/");
  }
  return (
    <main className={s.pageNarrow}>
      <header className={s.masthead}>
        <div className={s.brand}>
          Curtis &amp; Co
          <span className={s.brandSub}>Workstream · Sign in</span>
        </div>
      </header>
      <SignIn />
      <p className={s.meta}>
        <Link href="/">← Back to projects</Link>
      </p>
    </main>
  );
}
