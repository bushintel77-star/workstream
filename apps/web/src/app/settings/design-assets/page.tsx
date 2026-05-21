import { listCatalogSymbols } from "../../../lib/api";
import s from "../../../styles/app.module.css";
import { SettingsMasthead } from "../SettingsShell";
import { DesignAssetUploadForm } from "../../../components/DesignAssetUploadForm";

export const dynamic = "force-dynamic";

export default async function DesignAssetsSettingsPage() {
  let symbols: Awaited<ReturnType<typeof listCatalogSymbols>> = [];
  let loadError: string | null = null;
  try {
    symbols = await listCatalogSymbols();
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Could not reach the API.";
  }

  const customSymbols = symbols.filter((sym) => sym.id.startsWith("custom-"));
  const builtInCount = symbols.length - customSymbols.length;

  return (
    <main className={s.page}>
      <SettingsMasthead active="design-assets" subtitle="Design assets" />

      <h1 className={s.headline}>Design asset library</h1>
      <p className={s.lede}>
        Upload open SVG paths for plants and hardscape. Assets appear in the
        design studio palette and on quotes when placed on the site plan (
        {builtInCount} built-in Curtis widgets plus your uploads).
      </p>

      {loadError && (
        <div className={s.error}>
          Couldn&apos;t load library: {loadError}
        </div>
      )}

      {!loadError && <DesignAssetUploadForm customSymbols={customSymbols} />}
    </main>
  );
}
