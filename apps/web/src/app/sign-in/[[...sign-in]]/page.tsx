import Link from "next/link";
import { redirect } from "next/navigation";
import { SignIn } from "@clerk/nextjs";
import { clerkEnabled } from "../../../lib/auth";
import { authAppearance } from "../../../components/auth/authAppearance";
import auth from "../../auth.module.css";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  if (!clerkEnabled) {
    redirect("/home");
  }
  return (
    <main className={auth.shell}>
      <div className={auth.frame}>
        <header className={auth.brand}>
          <span className={auth.brandMark} aria-hidden />
          <span className={auth.brandText}>Workstream</span>
        </header>
        <SignIn appearance={authAppearance} />
        <p className={auth.note}>
          Site truth, sketch, CAD and quote — Melbourne.{" "}
          <Link href="/home">Back to projects</Link>
        </p>
      </div>
    </main>
  );
}
