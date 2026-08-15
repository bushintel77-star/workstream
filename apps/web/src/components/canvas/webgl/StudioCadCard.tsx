"use client";

/**
 * Gold Standard 2026 — Studio CAD Card (native CAD mode hub).
 *
 * The AI-native drafter panel: ensure the CAD sheet, drive it in natural
 * language (editCadAction — ops applied server-side), stage + accept AI
 * ghosts, and promote a quote. "AI as a spatial collaborator, never a
 * silent writer" — every AI action reports what it did before anything is
 * accepted into the durable doc.
 */

import { useState } from "react";
import { GlassCard } from "./GlassCard";

type Status = { tone: "ok" | "err" | "busy"; text: string } | null;

const btn: React.CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontSize: 11,
  letterSpacing: "0.03em",
  padding: "5px 10px",
  borderRadius: "var(--gs-radius-chip)",
  border: "1px solid color-mix(in srgb, var(--gs-line) 60%, transparent)",
  background: "transparent",
  color: "var(--gs-ink)",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const btnPrimary: React.CSSProperties = {
  ...btn,
  border: "1px solid color-mix(in srgb, var(--gs-primary) 45%, transparent)",
  background: "color-mix(in srgb, var(--gs-primary) 14%, transparent)",
  color: "var(--gs-primary)",
};

const label: React.CSSProperties = {
  fontSize: 10.5,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--gs-ink-secondary)",
};

export function StudioCadCard({ projectId }: { projectId: string }) {
  const [status, setStatus] = useState<Status>(null);
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: string, label: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setStatus({ tone: "busy", text: `${label}…` });
    try {
      const res = (await fn()) as Record<string, unknown> | null;
      const detail =
        (typeof res === "object" &&
          res &&
          ((res.reply as string) ??
            (res.message as string) ??
            (res.summary as string) ??
            (Array.isArray(res.ops) ? `${res.ops.length} ops applied` : null))) ??
        "Done";
      setStatus({ tone: "ok", text: String(detail).slice(0, 140) });
    } catch (e) {
      setStatus({
        tone: "err",
        text: e instanceof Error ? e.message.slice(0, 140) : `${label} failed`,
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <GlassCard position={{ position: "relative" }} style={{ width: 300, padding: "10px 12px" }}>
      <div
        data-testid="studio-cad-card"
        style={{ fontFamily: "var(--font-ui)", color: "var(--gs-ink)", display: "flex", flexDirection: "column", gap: 8 }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={label}>CAD · AI drafter</span>
          <span style={{ ...label, color: "var(--gs-ink-muted)" }}>never silent-writes</span>
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button
            type="button"
            style={btn}
            disabled={busy != null}
            data-testid="cad-ensure"
            onClick={() =>
              run("ensure", "Opening CAD sheet", async () => {
                const { ensureCadAction } = await import("../../../app/actions");
                return ensureCadAction(projectId);
              })
            }
          >
            Open sheet
          </button>
          <button
            type="button"
            style={btn}
            disabled={busy != null}
            data-testid="cad-generate"
            title="AI generates ghost entities from the drawing — review, then accept"
            onClick={() =>
              run("generate", "AI drafting ghosts", async () => {
                const { generateCadAction } = await import("../../../app/actions");
                return generateCadAction(projectId);
              })
            }
          >
            AI draft
          </button>
          <button
            type="button"
            style={btn}
            disabled={busy != null}
            data-testid="cad-accept"
            title="Accept staged ghost entities into the durable CAD doc"
            onClick={() =>
              run("accept", "Accepting ghosts", async () => {
                const { acceptCadAction } = await import("../../../app/actions");
                return acceptCadAction(projectId);
              })
            }
          >
            Accept ghosts
          </button>
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          <input
            type="text"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="Tell the drafter what to change…"
            aria-label="AI CAD instruction"
            data-testid="cad-instruction"
            style={{
              flex: 1,
              minWidth: 0,
              fontFamily: "var(--font-ui)",
              fontSize: 11,
              color: "var(--gs-ink)",
              padding: "5px 8px",
              borderRadius: "var(--gs-radius-chip)",
              border: "1px solid color-mix(in srgb, var(--gs-line) 60%, transparent)",
              background: "color-mix(in srgb, var(--gs-glass-sunken) 70%, transparent)",
            }}
          />
          <button
            type="button"
            style={btnPrimary}
            disabled={busy != null || !instruction.trim()}
            data-testid="cad-apply"
            onClick={() =>
              run("edit", "AI edit", async () => {
                const { editCadAction } = await import("../../../app/actions");
                return editCadAction(projectId, instruction.trim());
              }).then(() => setInstruction(""))
            }
          >
            Apply
          </button>
        </div>

        <button
          type="button"
          style={btn}
          disabled={busy != null}
          data-testid="cad-quote"
          onClick={() =>
            run("quote", "Promoting CAD quote", async () => {
              const { cadQuoteAction } = await import("../../../app/actions");
              return cadQuoteAction(projectId, "standard");
            })
          }
        >
          Quote from CAD
        </button>

        {status ? (
          <p
            role="status"
            data-testid="cad-status"
            style={{
              margin: 0,
              fontSize: 11,
              lineHeight: 1.45,
              color:
                status.tone === "err"
                  ? "var(--gs-conflict-soft)"
                  : status.tone === "ok"
                    ? "var(--gs-ink)"
                    : "var(--gs-ink-secondary)",
            }}
          >
            {status.text}
          </p>
        ) : null}

        <div style={{ borderTop: "1px solid var(--gs-line-soft)", paddingTop: 8 }}>
          <span style={label}>Ask AI about this site</span>
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <input
              type="text"
              placeholder="e.g. where should screening go?"
              aria-label="Ask AI"
              data-testid="assist-input"
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.currentTarget.value.trim()) {
                  const msg = e.currentTarget.value.trim();
                  e.currentTarget.value = "";
                  void run("assist", "Thinking", async () => {
                    const { designAssistAction } = await import("../../../app/actions");
                    return designAssistAction(projectId, msg);
                  });
                }
              }}
              style={{
                flex: 1,
                minWidth: 0,
                fontFamily: "var(--font-ui)",
                fontSize: 11,
                color: "var(--gs-ink)",
                padding: "5px 8px",
                borderRadius: "var(--gs-radius-chip)",
                border: "1px solid color-mix(in srgb, var(--gs-line) 60%, transparent)",
                background: "color-mix(in srgb, var(--gs-glass-sunken) 70%, transparent)",
              }}
            />
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
