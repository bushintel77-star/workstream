import Link from "next/link";
import { redirect } from "next/navigation";
import { SignUp } from "@clerk/nextjs";
import { clerkEnabled } from "../../../lib/auth";
import s from "../../../styles/app.module.css";

export const dynamic = "force-dynamic";

export default function SignUpPage() {
  if (!clerkEnabled) {
    redirect("/home");
  }
  return (
    <main className={s.pageNarrow}>
      <header className={s.masthead}>
        <div className={s.brand}>
          Curtis &amp; Co
          <span className={s.brandSub}>Workstream · Sign up</span>
        </div>
      </header>
      <SignUp />
      <p className={s.meta}>
        <Link href="/home">← Back to projects</Link>
      </p>
    </main>
  );
}
