"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  QuoteDoc,
  QuoteOverride,
  QuoteCustomLine,
  QuoteMargin,
} from "@workstream/contracts";
import {
  calculateLineTotal,
  engineLinesFromStudioEstimate,
  emptyQuoteDoc,
  resolveQuote,
  type ResolveQuoteResult,
  type StudioEstimateReport,
} from "@workstream/domain";
import {
  getQuoteDocAction,
  upsertQuoteDocAction,
} from "../../../../../app/actions";

type Args = {
  projectId: string | null | undefined;
  estimate: StudioEstimateReport;
};

export function useQuoteDoc({ projectId, estimate }: Args) {
  const [doc, setDoc] = useState<QuoteDoc>(() =>
    emptyQuoteDoc(projectId ?? "00000000-0000-4000-8000-000000000000"),
  );
  const [loaded, setLoaded] = useState(!projectId);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!projectId) {
      setLoaded(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const remote = await getQuoteDocAction(projectId);
        if (cancelled) return;
        if (remote) setDoc(remote);
        else setDoc(emptyQuoteDoc(projectId));
      } catch {
        if (!cancelled) setDoc(emptyQuoteDoc(projectId));
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const resolved: ResolveQuoteResult = useMemo(() => {
    const engine = engineLinesFromStudioEstimate(estimate.lines);
    return resolveQuote(engine, doc);
  }, [estimate.lines, doc]);

  const persist = useCallback(
    async (next: QuoteDoc) => {
      if (!projectId) return;
      setSaving(true);
      try {
        const saved = await upsertQuoteDocAction(projectId, {
          project_id: projectId,
          design_id: next.design_id,
          overrides: next.overrides,
          custom_lines: next.custom_lines,
          margin: next.margin,
        });
        setDoc(saved);
        setDirty(false);
      } catch {
        /* keep local dirty state */
      } finally {
        setSaving(false);
      }
    },
    [projectId],
  );

  const patchDoc = useCallback(
    (patch: Partial<QuoteDoc>) => {
      setDoc((prev) => {
        const next = {
          ...prev,
          ...patch,
          updated_at: new Date().toISOString(),
        };
        setDirty(true);
        window.setTimeout(() => void persist(next), 0);
        return next;
      });
    },
    [persist],
  );

  const setOverride = useCallback(
    (lineId: string, patch: Partial<QuoteOverride>) => {
      setDoc((prev) => {
        const customIdx = prev.custom_lines.findIndex((c) => c.id === lineId);
        if (customIdx >= 0) {
          const custom = prev.custom_lines[customIdx]!;
          // Exclude / alternate stay on the override layer; qty/rate on the custom row.
          if (
            patch.excluded != null ||
            patch.alternate_of != null ||
            patch.alternate_selected != null
          ) {
            const rest = prev.overrides.filter((o) => o.line_id !== lineId);
            const existing = prev.overrides.find((o) => o.line_id === lineId);
            const nextOv: QuoteOverride = {
              ...existing,
              ...patch,
              line_id: lineId,
              sku: patch.sku ?? existing?.sku ?? custom.sku,
            };
            const nextCustom = [...prev.custom_lines];
            if (patch.qty != null || patch.rate != null || patch.notes != null) {
              nextCustom[customIdx] = {
                ...custom,
                qty: patch.qty ?? custom.qty,
                rate: patch.rate ?? custom.rate,
                notes: patch.notes ?? custom.notes,
                is_provisional: patch.is_provisional ?? custom.is_provisional,
                section: patch.section ?? custom.section,
                total: calculateLineTotal(
                  patch.qty ?? custom.qty,
                  patch.rate ?? custom.rate,
                ),
              };
            }
            const next = {
              ...prev,
              custom_lines: nextCustom,
              overrides: [...rest, nextOv],
              updated_at: new Date().toISOString(),
            };
            setDirty(true);
            window.setTimeout(() => void persist(next), 0);
            return next;
          }
          const nextCustom = [...prev.custom_lines];
          nextCustom[customIdx] = {
            ...custom,
            qty: patch.qty ?? custom.qty,
            rate: patch.rate ?? custom.rate,
            notes: patch.notes ?? custom.notes,
            is_provisional: patch.is_provisional ?? custom.is_provisional,
            section: patch.section ?? custom.section,
            total: calculateLineTotal(
              patch.qty ?? custom.qty,
              patch.rate ?? custom.rate,
            ),
          };
          const next = {
            ...prev,
            custom_lines: nextCustom,
            updated_at: new Date().toISOString(),
          };
          setDirty(true);
          window.setTimeout(() => void persist(next), 0);
          return next;
        }
        const engine = engineLinesFromStudioEstimate(estimate.lines);
        const eng = engine.find((l) => l.id === lineId);
        const rest = prev.overrides.filter((o) => o.line_id !== lineId);
        const existing = prev.overrides.find((o) => o.line_id === lineId);
        const nextOv: QuoteOverride = {
          ...existing,
          ...patch,
          line_id: lineId,
          sku: patch.sku ?? existing?.sku ?? eng?.sku,
        };
        const next = {
          ...prev,
          overrides: [...rest, nextOv],
          updated_at: new Date().toISOString(),
        };
        setDirty(true);
        window.setTimeout(() => void persist(next), 0);
        return next;
      });
    },
    [estimate.lines, persist],
  );

  const resetLine = useCallback(
    (lineId: string) => {
      setDoc((prev) => {
        const next = {
          ...prev,
          overrides: prev.overrides.filter((o) => o.line_id !== lineId),
          updated_at: new Date().toISOString(),
        };
        setDirty(true);
        window.setTimeout(() => void persist(next), 0);
        return next;
      });
    },
    [persist],
  );

  const resetAll = useCallback(() => {
    setDoc((prev) => {
      const next = {
        ...prev,
        overrides: [],
        custom_lines: [],
        margin: { global_pct: 0, by_section: {} } satisfies QuoteMargin,
        updated_at: new Date().toISOString(),
      };
      setDirty(true);
      window.setTimeout(() => void persist(next), 0);
      return next;
    });
  }, [persist]);

  const addCustomLine = useCallback(() => {
    const line: QuoteCustomLine = {
      id: crypto.randomUUID(),
      sku: "CUSTOM",
      label: "Custom line",
      unit: "ea",
      qty: 1,
      rate: 0,
      total: 0,
      is_provisional: false,
      section: "custom",
    };
    setDoc((prev) => {
      const next = {
        ...prev,
        custom_lines: [...prev.custom_lines, line],
        updated_at: new Date().toISOString(),
      };
      setDirty(true);
      window.setTimeout(() => void persist(next), 0);
      return next;
    });
  }, [persist]);

  const setMarginPct = useCallback(
    (global_pct: number) => {
      patchDoc({
        margin: { ...doc.margin, global_pct },
      });
    },
    [doc.margin, patchDoc],
  );

  return {
    doc,
    loaded,
    saving,
    dirty,
    resolved,
    setOverride,
    resetLine,
    resetAll,
    addCustomLine,
    setMarginPct,
  };
}
