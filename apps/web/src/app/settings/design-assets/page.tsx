import Link from "next/link";
import s from "../../../styles/app.module.css";
import { SettingsMasthead } from "../SettingsShell";

export const dynamic = "force-dynamic";

export default function DesignAssetsSettingsPage() {
  return (
    <main className={s.page}>
      <SettingsMasthead active="design-assets" subtitle="Design assets" />
      <h1 className={s.headline}>Design assets</h1>
      <p className={s.lede}>
        Asset library management moved into the canvas-first CAD workflow.
        Open a project from the home list to design on the site canvas.
      </p>
      <p>
        <Link href="/">Back to projects</Link>
      </p>
    </main>
  );
}
