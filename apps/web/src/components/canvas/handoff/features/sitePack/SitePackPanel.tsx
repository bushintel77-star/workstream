"use client";

import { digToolsUnlocked } from "@workstream/domain";
import css from "./sitePack.module.css";

export type ChaseItem = {
  id: string;
  label: string;
  done: boolean;
  href?: string;
};

export type BydaTrayFile = {
  id: string;
  title: string;
  uri: string;
};

type Props = {
  chase: ChaseItem[];
  bydaAssetCount: number;
  digOverrideAt: string | null;
  streetChips: string[];
  bydaFiles: BydaTrayFile[];
  councilRequestTemplate?: string | null;
  onToggleChase: (id: string) => void;
  onStampDigOverride: () => void;
  onIngestStormwaterFile: (file: File) => void;
  onUploadBydaFile: (file: File) => void;
};

/**
 * Prepare site pack — chase list, street context chips, BYDA dig gate.
 */
export function SitePackPanel({
  chase,
  bydaAssetCount,
  digOverrideAt,
  streetChips,
  bydaFiles,
  councilRequestTemplate,
  onToggleChase,
  onStampDigOverride,
  onIngestStormwaterFile,
  onUploadBydaFile,
}: Props) {
  const digOk = digToolsUnlocked({
    bydaAssetCount,
    digOverrideAt,
  });

  return (
    <section
      className={css.root}
      data-testid="site-pack-panel"
      aria-label="Site pack chase and dig gate"
    >
      <header className={css.header}>
        <h3 className={css.title}>Site pack</h3>
        <p className={css.lede}>
          Gov hydrate fills geometry. Chase list + BYDA unlock dig tools.
        </p>
      </header>

      {streetChips.length > 0 ? (
        <div className={css.chips} data-testid="street-context-chips">
          {streetChips.map((c) => (
            <span key={c} className={css.chip}>
              {c}
            </span>
          ))}
        </div>
      ) : null}

      <ul className={css.chase}>
        {chase.map((item) => (
          <li key={item.id} className={css.chaseItem}>
            <label className={css.chaseLabel}>
              <input
                type="checkbox"
                checked={item.done}
                onChange={() => onToggleChase(item.id)}
                data-testid={`chase-${item.id}`}
              />
              <span>{item.label}</span>
            </label>
            {item.href ? (
              <a
                className={css.link}
                href={item.href}
                target="_blank"
                rel="noreferrer"
              >
                Open
              </a>
            ) : null}
          </li>
        ))}
      </ul>

      {councilRequestTemplate ? (
        <p className={css.requestTpl} data-testid="council-drain-template">
          {councilRequestTemplate}
        </p>
      ) : null}

      <div className={css.bydaTray} data-testid="byda-pdf-tray">
        <p className={css.trayHead}>BYDA plans</p>
        {bydaFiles.length === 0 ? (
          <p className={css.trayEmpty}>No plans yet — lodge on BYDA then upload PDF here.</p>
        ) : (
          <ul className={css.fileList}>
            {bydaFiles.map((f) => (
              <li key={f.id}>
                <a href={f.uri} target="_blank" rel="noreferrer">
                  {f.title}
                </a>
              </li>
            ))}
          </ul>
        )}
        <label className={css.upload}>
          Upload BYDA PDF / plan
          <input
            type="file"
            accept=".pdf,image/jpeg,image/png,image/webp,application/pdf"
            data-testid="byda-file-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUploadBydaFile(file);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      <div
        className={css.digGate}
        data-testid="dig-gate"
        data-unlocked={digOk ? "true" : "false"}
      >
        <p className={css.digCopy}>
          {digOk
            ? bydaAssetCount > 0
              ? `${bydaAssetCount} BYDA asset${bydaAssetCount === 1 ? "" : "s"} — dig tools unlocked`
              : "Dig override stamped — still lodge BYDA before excavation"
            : "Dig gate locked — digitise BYDA assets (Servc) or stamp override"}
        </p>
        {!digOk ? (
          <button
            type="button"
            className={css.overrideBtn}
            onClick={onStampDigOverride}
            data-testid="dig-override-btn"
          >
            Stamp dig override
          </button>
        ) : null}
        <label className={css.upload}>
          Council drain GeoJSON
          <input
            type="file"
            accept=".json,.geojson,application/geo+json,application/json"
            data-testid="stormwater-geojson-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onIngestStormwaterFile(file);
              e.target.value = "";
            }}
          />
        </label>
      </div>
    </section>
  );
}
