"use client";

import { useCallback, useEffect, useState } from "react";
import { CameraChrome } from "../../CameraChrome";
import { readDesignBranchId } from "../designBranch/designBranchPrefs";
import css from "./opsSchedules.module.css";

type Kind = "planting" | "trench" | "lighting" | "material";

type Props = {
  projectId: string;
  open: boolean;
  onClose: () => void;
  initialKind?: Kind;
  /** Propose planting/trench callouts as ghosts on the board. */
  onProposeCallouts?: () => void;
};

type SchedulePayload = {
  schedule: {
    rows: Array<Record<string, unknown>>;
    honesty: string;
  };
};

/** Subset of DocumentationPackage the dock renders. */
type IssuedPack = {
  id: string;
  title: string;
  status: "draft" | "issued";
  created_at: string;
  issued_at?: string | null;
};

const PACK_DATE = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const LABELS: Record<Kind, string> = {
  planting: "Planting",
  trench: "Trench dig",
  lighting: "Lighting VA",
  material: "Material",
};

export function OpsSchedulesDock({
  projectId,
  open,
  onClose,
  initialKind = "planting",
  onProposeCallouts,
}: Props) {
  const [kind, setKind] = useState<Kind>(initialKind);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [honesty, setHonesty] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [packs, setPacks] = useState<IssuedPack[]>([]);

  /**
   * Previously issued packs. Without this the dock could only ever mint a new
   * pack, so an already-issued deliverable was invisible and un-redownloadable
   * even though the API had been listing them all along.
   */
  const loadPacks = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/projects/${projectId}/documentation-packages`,
        { cache: "no-store" },
      );
      if (!res.ok) return;
      const json = (await res.json()) as { packages?: IssuedPack[] };
      setPacks(json.packages ?? []);
    } catch {
      // Non-fatal — the schedule table and Issue action still work.
    }
  }, [projectId]);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const branch = readDesignBranchId(projectId);
      const q = new URLSearchParams();
      if (branch) q.set("branch_id", branch);
      const res = await fetch(
        `/api/projects/${projectId}/schedules/${kind}?${q}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error("Could not load schedule");
      const json = (await res.json()) as SchedulePayload;
      setRows(json.schedule.rows);
      setHonesty(json.schedule.honesty);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setBusy(false);
    }
  }, [projectId, kind]);

  useEffect(() => {
    if (!open) return;
    void load();
    void loadPacks();
  }, [open, load, loadPacks]);

  useEffect(() => {
    setKind(initialKind);
  }, [initialKind]);

  if (!open) return null;

  async function downloadCsv() {
    const branch = readDesignBranchId(projectId);
    const q = new URLSearchParams({ format: "csv" });
    if (branch) q.set("branch_id", branch);
    window.open(
      `/api/projects/${projectId}/schedules/${kind}?${q}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  async function issuePack() {
    setBusy(true);
    setError(null);
    try {
      const create = await fetch(
        `/api/projects/${projectId}/documentation-packages`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title: "Issued documentation pack",
            schedule_kinds: ["planting", "trench", "lighting", "material"],
          }),
        },
      );
      if (!create.ok) throw new Error("Could not create pack");
      const created = (await create.json()) as {
        package: { id: string };
      };
      const issue = await fetch(
        `/api/projects/${projectId}/documentation-packages/${created.package.id}/issue`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      if (!issue.ok) throw new Error("Could not issue pack");
      window.open(
        `/api/projects/${projectId}/documentation-packages/${created.package.id}/zip`,
        "_blank",
        "noopener,noreferrer",
      );
      await loadPacks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Issue failed");
    } finally {
      setBusy(false);
    }
  }

  const columns =
    rows[0] != null
      ? Object.keys(rows[0]).filter((k) => k !== "id")
      : [];

  return (
    <CameraChrome>
      <aside
        className={css.dock}
        data-testid="ops-schedules-dock"
        data-camera-chrome
      >
        <header className={css.head}>
          <h2 className={css.title}>Ops schedules</h2>
          <button type="button" className={css.close} onClick={onClose}>
            Close
          </button>
        </header>
        <div className={css.tabs} role="tablist">
          {(Object.keys(LABELS) as Kind[]).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={kind === k}
              className={kind === k ? css.tabOn : css.tab}
              onClick={() => setKind(k)}
              data-testid={`ops-schedule-tab-${k}`}
            >
              {LABELS[k]}
            </button>
          ))}
        </div>
        {error ? <p className={css.error}>{error}</p> : null}
        <p className={css.honesty}>{honesty}</p>
        <div className={css.tableWrap}>
          {busy ? (
            <p className={css.meta}>Loading…</p>
          ) : rows.length === 0 ? (
            <p className={css.meta}>No rows on this branch tip yet.</p>
          ) : (
            <table className={css.table}>
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th key={c}>{c.replace(/_/g, " ")}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    {columns.map((c) => (
                      <td key={c}>{String(row[c] ?? "")}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {packs.length > 0 ? (
          <div className={css.packs} data-testid="ops-issued-packs">
            <p className={css.packsHead}>Issued packs</p>
            <ul className={css.packList}>
              {packs.map((pack) => (
                <li key={pack.id} className={css.packRow}>
                  <span className={css.packTitle}>{pack.title}</span>
                  <span className={css.packMeta}>
                    {pack.status === "issued" && pack.issued_at
                      ? `Issued ${PACK_DATE.format(new Date(pack.issued_at))}`
                      : "Draft"}
                  </span>
                  <a
                    className={css.packDownload}
                    href={`/api/projects/${projectId}/documentation-packages/${pack.id}/zip`}
                    target="_blank"
                    rel="noreferrer"
                    data-testid={`ops-pack-zip-${pack.id}`}
                  >
                    Download
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className={css.actions}>
          <button
            type="button"
            className={css.btn}
            onClick={() => void downloadCsv()}
            data-testid="ops-schedule-csv"
          >
            Download CSV
          </button>
          <button
            type="button"
            className={css.btn}
            onClick={() => window.print()}
            data-testid="ops-schedule-print"
          >
            Print
          </button>
          {onProposeCallouts ? (
            <button
              type="button"
              className={css.btn}
              onClick={onProposeCallouts}
              data-testid="ops-schedule-callouts"
            >
              Propose callouts
            </button>
          ) : null}
          <button
            type="button"
            className={css.btn}
            disabled={busy}
            onClick={() => void issuePack()}
            data-testid="ops-schedule-issue-pack"
          >
            Issue documentation pack
          </button>
        </div>
      </aside>
    </CameraChrome>
  );
}
