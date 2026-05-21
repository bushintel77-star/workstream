import { SignIn } from "@clerk/nextjs";
import s from "../../../styles/app.module.css";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  return (
    <main className={s.pageNarrow}>
      <header className={s.masthead}>
        <div className={s.brand}>
          Curtis &amp; Co
          <span className={s.brandSub}>Workstream · Sign in</span>
        </div>
      </header>
      <SignIn />
    </main>
  );
}
