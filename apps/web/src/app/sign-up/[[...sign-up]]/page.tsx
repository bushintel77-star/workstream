import { SignUp } from "@clerk/nextjs";
import s from "../../../styles/app.module.css";

export const dynamic = "force-dynamic";

export default function SignUpPage() {
  return (
    <main className={s.pageNarrow}>
      <header className={s.masthead}>
        <div className={s.brand}>
          Curtis &amp; Co
          <span className={s.brandSub}>Construct · Sign up</span>
        </div>
      </header>
      <SignUp />
    </main>
  );
}
