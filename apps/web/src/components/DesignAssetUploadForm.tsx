"use client";

import { useActionState } from "react";
import {
  createCatalogSymbolAction,
} from "../app/actions";
import type { CatalogSymbol } from "../lib/api";
import { SubmitButton } from "./SubmitButton";
import { DesignAssetGlyph } from "./studio";
import { CatalogSymbolRemoveButton } from "./CatalogSymbolRemoveButton";
import s from "./designAssetUpload.module.css";

const CATEGORIES = [
  { value: "planting", label: "Planting" },
  { value: "paving", label: "Hardscape" },
  { value: "structure", label: "Structures" },
  { value: "water", label: "Water" },
  { value: "furniture", label: "Site furniture" },
  { value: "annotation", label: "Markup" },
] as const;

type Props = {
  customSymbols: CatalogSymbol[];
};

export function DesignAssetUploadForm({ customSymbols }: Props) {
  const [uploadState, uploadAction] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => {
      try {
        await createCatalogSymbolAction(formData);
        return null;
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Upload failed" };
      }
    },
    null,
  );

  return (
    <div className={s.wrap}>
      <form action={uploadAction} className={s.form}>
        <h2 className={s.formTitle}>Upload SVG asset</h2>
        <p className={s.formHint}>
          Paste an SVG path (<code>d</code> attribute, viewBox 0 0 24 24 or 48
          48). Open-source — stored per operator, merged into the design studio
          library.
        </p>

        <label className={s.label}>
          Label
          <input name="label" required className={s.input} placeholder="e.g. Travertine pool coping" />
        </label>

        <label className={s.label}>
          Category
          <select name="category" className={s.input} defaultValue="paving">
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className={s.label}>
          SVG path <span className={s.req}>(required)</span>
          <textarea
            name="path_d"
            required
            className={s.textarea}
            rows={4}
            placeholder="M4 20V8l4-4 4 4v12..."
            spellCheck={false}
          />
        </label>

        <label className={s.label}>
          Description
          <input name="description" className={s.input} placeholder="Optional" />
        </label>

        <label className={s.label}>
          Rate card SKU
          <input name="rate_card_sku" className={s.input} placeholder="e.g. PAV-BLUE" />
        </label>

        <div className={s.row}>
          <label className={s.label}>
            Preview bg
            <input
              name="preview_bg"
              type="color"
              className={s.color}
              defaultValue="#f0f2ee"
            />
          </label>
          <label className={s.label}>
            Accent
            <input
              name="accent"
              type="color"
              className={s.color}
              defaultValue="#4a6741"
            />
          </label>
        </div>

        {uploadState?.error && (
          <p className={s.error} role="alert">
            {uploadState.error}
          </p>
        )}

        <SubmitButton pendingLabel="Uploading…">Add to library</SubmitButton>
      </form>

      <section className={s.list}>
        <h2 className={s.formTitle}>Your uploads ({customSymbols.length})</h2>
        {customSymbols.length === 0 ? (
          <p className={s.formHint}>No custom assets yet — built-in Curtis library still applies.</p>
        ) : (
          <ul className={s.uploadList}>
            {customSymbols.map((sym) => (
              <li key={sym.id} className={s.uploadItem}>
                <DesignAssetGlyph symbol={sym} size="md" />
                <div className={s.uploadMeta}>
                  <span className={s.uploadLabel}>{sym.label}</span>
                  <span className={s.uploadCat}>{sym.category}</span>
                  {sym.rate_card_sku && (
                    <span className={s.uploadSku}>{sym.rate_card_sku}</span>
                  )}
                </div>
                <CatalogSymbolRemoveButton id={sym.id} label={sym.label} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
