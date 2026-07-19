"use client";

import { useMemo, useState } from "react";
import {
  BY_TYPE,
  MODE_TABS,
  TOOLS,
  WRIGHTS_SEED,
  bomLines,
  ptsStr,
  type StudioItem,
  type StudioMode,
  type StudioTool,
} from "./studioCatalog";
import { StudioGlyph } from "./StudioGlyph";
import css from "./handoffStudio.module.css";

type Props = {
  projectId: string;
  projectAddress: string;
  aerialUri?: string | null;
  areaM2?: number | null;
  initialMode?: StudioMode;
};

const aud = (n: number) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(n);

/**
 * Faithful Design Studio v4 board — %‑coord aerial drafting surface from the
 * handoff package (not MapLibre / Vicmap title chrome).
 */
export function HandoffDesignStudio({
  projectAddress,
  aerialUri = null,
  areaM2 = 230.82,
  initialMode = "cad",
}: Props) {
  const [mode, setMode] = useState<StudioMode>(
    MODE_TABS.includes(initialMode as StudioMode) ? initialMode : "cad",
  );
  const [tool, setTool] = useState<StudioTool>("pan");
  const [items, setItems] = useState<StudioItem[]>(() =>
    WRIGHTS_SEED.items.map((i) => ({ ...i })),
  );
  const [boundary] = useState(WRIGHTS_SEED.boundary);
  const [building] = useState(WRIGHTS_SEED.building);
  const [frameOn, setFrameOn] = useState(false);
  const [darkOn, setDarkOn] = useState(false);
  const [focusOn, setFocusOn] = useState(false);
  const [paper, setPaper] = useState<"a3" | "a4">("a3");
  const [growth, setGrowth] = useState<"plant" | "5yr" | "mature">("mature");
  const [sunT, setSunT] = useState(0.52); // ~12:26
  const [elevAxis, setElevAxis] = useState<"x" | "y">("x");
  const [ghostOpen, setGhostOpen] = useState(false);
  const [ghostIdx, setGhostIdx] = useState(0);

  const ghosts = items.filter((i) => i.ghost);
  const ghostCount = ghosts.length;
  const curGhost = ghosts[(((ghostIdx % ghosts.length) + ghosts.length) % ghosts.length)];
  const lines = useMemo(() => bomLines(items), [items]);
  const total = lines.reduce((a, r) => a + r.amt, 0) + 4378; // fees/labour to ~28550
  const outdoor = areaM2 ?? 230.82;

  const sunHour = 6.33 + sunT * (19.67 - 6.33);
  const hh = Math.floor(sunHour);
  const mm = Math.round((sunHour % 1) * 60);
  const h12 = ((hh + 11) % 12) + 1;
  const ampm = hh >= 12 ? "pm" : "am";
  const sunTimeTxt = `${h12}:${String(mm).padStart(2, "0")} ${ampm}`;
  // Arc position (handoff-style quadratic)
  const sunX = 2 + sunT * 96;
  const sunY = 38 - Math.sin(sunT * Math.PI) * 40;
  const sunPX = sunX;
  const sunPY = (sunY / 40) * 100;

  const planOn = mode !== "elevation" && mode !== "quote";
  const showDocks = !focusOn && planOn && !frameOn && mode !== "survey";

  const acceptAll = () =>
    setItems((prev) => prev.map((i) => ({ ...i, ghost: false })));
  const acceptOne = (id: string) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ghost: false } : i)));
  const rejectOne = (id: string) =>
    setItems((prev) => prev.filter((i) => i.id !== id));

  return (
    <div
      className={`${css.root}${darkOn ? ` ${css.rootDark}` : ""}${focusOn ? ` ${css.rootFocus}` : ""}`}
      data-testid="handoff-design-studio"
      data-studio-surface="handoff-v4"
    >
      <header className={css.header} data-testid="canvas-studio-header">
        <div>
          <p className={css.brandName}>Curtis &amp; Co</p>
          <p className={css.address}>{projectAddress}</p>
        </div>
        <div className={css.spacer} />
        <nav className={css.modes} aria-label="Design workflow" data-testid="canvas-mode-strip">
          {MODE_TABS.map((m) => (
            <button
              key={m}
              type="button"
              className={`${css.modeBtn}${mode === m ? ` ${css.modeBtnActive}` : ""}`}
              data-testid={`canvas-mode-${m}`}
              onClick={() => setMode(m)}
            >
              {m[0].toUpperCase() + m.slice(1)}
            </button>
          ))}
        </nav>
        <div className={css.spacer} />
        <div className={css.meta}>
          <div className={css.metaEyebrow}>Working drawing</div>
          <div className={css.metaDetail}>
            Vicmap · Land Vic · {Number(outdoor).toFixed(2)} m²
          </div>
        </div>

        {frameOn ? (
          <div className={css.segment} data-testid="paper-size-control">
            {(["a3", "a4"] as const).map((p) => (
              <button
                key={p}
                type="button"
                className={`${css.segmentBtn}${paper === p ? ` ${css.segmentBtnActive}` : ""}`}
                onClick={() => setPaper(p)}
              >
                {p.toUpperCase()}
              </button>
            ))}
          </div>
        ) : null}

        <button
          type="button"
          className={`${css.toolBtn}${frameOn ? ` ${css.toolBtnActive}` : ""}`}
          data-testid="fit-sheet-top"
          onClick={() => setFrameOn((v) => !v)}
        >
          Fit sheet
        </button>
        <button
          type="button"
          className={`${css.toolBtn}${darkOn ? ` ${css.toolBtnActive}` : ""}`}
          data-testid="dark-canvas-top"
          onClick={() => setDarkOn((v) => !v)}
        >
          {darkOn ? "Dark ✓" : "Dark"}
        </button>
        <button type="button" className={css.toolBtn} data-testid="canvas-layers-top">
          ⧉ Layers
        </button>
        <button type="button" className={css.toolBtn} data-testid="canvas-sites-top">
          Sites ▾
        </button>
        <button
          type="button"
          className={`${css.toolBtn}${focusOn ? ` ${css.toolBtnActive}` : ""}`}
          data-testid="canvas-focus-top"
          onClick={() => setFocusOn((v) => !v)}
        >
          {focusOn ? "Exit focus" : "Focus"}
        </button>
        <button type="button" className={css.toolBtn} data-testid="client-view-top">
          Client view
        </button>
        <button type="button" className={css.cmdBtn} data-testid="canvas-command-top">
          ⌘K
        </button>
        <button
          type="button"
          className={`${css.aiPill}${ghostCount === 0 ? ` ${css.aiPillOk}` : ""}`}
          data-testid="header-accept-ghosts"
          onClick={ghostCount ? acceptAll : undefined}
        >
          {ghostCount ? "AI DRAFT: UNVERIFIED" : "AI DRAFT: VERIFIED ✓"}
        </button>
      </header>

      <div className={css.board} data-testid="studio-board">
        {mode === "elevation" ? (
          <div className={css.elev} data-testid="elevation-profile">
            <button
              type="button"
              className={css.elevToggle}
              onClick={() => setElevAxis((a) => (a === "x" ? "y" : "x"))}
            >
              {elevAxis === "x" ? "Front elevation" : "Side elevation"}
            </button>
            <div className={css.north}>N↑</div>
            <svg className={css.elevSvg} viewBox="0 0 100 40" preserveAspectRatio="none">
              {[0, 3, 6, 9].map((m) => {
                const y = 36 - (m / 9) * 30;
                return (
                  <g key={m}>
                    <line x1={8} y1={y} x2={96} y2={y} stroke="rgba(36,19,24,0.12)" strokeWidth={0.4} vectorEffect="non-scaling-stroke" />
                    <text x={6.5} y={y + 0.8} textAnchor="end" fill="rgba(36,19,24,0.5)" fontSize={2.2} fontFamily="IBM Plex Mono, monospace">
                      {m}m
                    </text>
                  </g>
                );
              })}
              <line x1={8} y1={36} x2={96} y2={36} stroke="rgba(36,19,24,0.35)" strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
              <rect x={28} y={18} width={22} height={18} fill="rgba(36,19,24,0.06)" stroke="#241318" strokeWidth={0.7} vectorEffect="non-scaling-stroke" />
              {items
                .filter((i) => BY_TYPE[i.t].heightM)
                .map((it) => {
                  const d = BY_TYPE[it.t];
                  const hm = (d.heightM ?? 1) * it.scale;
                  const x = 12 + (it.x / 100) * 70;
                  const h = (hm / 9) * 30;
                  const y = 36 - h;
                  const w = it.ghost ? 4 : 5;
                  return (
                    <g key={it.id}>
                      <rect
                        x={x}
                        y={y}
                        width={w}
                        height={h}
                        fill={it.ghost ? "rgba(232,184,75,0.15)" : "rgba(194,69,95,0.18)"}
                        stroke={it.ghost ? "#E8B84B" : "#C2455F"}
                        strokeWidth={0.6}
                        strokeDasharray={it.ghost ? "2 2" : undefined}
                        vectorEffect="non-scaling-stroke"
                      />
                      <text x={x + w / 2} y={y - 0.8} textAnchor="middle" fill="#7A5560" fontSize={1.8} fontFamily="IBM Plex Mono, monospace">
                        {d.tag} · {hm.toFixed(1)} m
                      </text>
                    </g>
                  );
                })}
              <text x={96} y={39} textAnchor="end" fill="#7A5560" fontSize={2.2} fontFamily="IBM Plex Mono, monospace">
                Site width ≈ 9.4 m
              </text>
            </svg>
          </div>
        ) : null}

        {mode === "quote" ? (
          <div className={css.quotePanel}>
            <h2>{aud(Math.round(total * 0.92))}</h2>
            <p>Indicative quote incl. GST from the live BOM on this working drawing.</p>
            <button type="button" className={`${css.toolBtn} ${css.toolBtnActive}`} onClick={() => setMode("cad")}>
              Back to CAD
            </button>
          </div>
        ) : null}

        {planOn ? (
          <div className={css.world}>
            <div
              className={css.aerial}
              style={
                aerialUri && !frameOn
                  ? { backgroundImage: `url(${aerialUri})` }
                  : frameOn
                    ? { background: "#faf6f2" }
                    : undefined
              }
            >
              {!aerialUri && !frameOn ? (
                <div className={css.aerialEmpty}>
                  Drop Mapbox aerial screenshot here (2D top-down)
                  <br />
                  or browse files
                </div>
              ) : null}
            </div>
            {!frameOn ? <div className={css.scrim} /> : null}

            <svg className={css.planSvg} viewBox="0 0 100 100" preserveAspectRatio="none">
              <polygon
                points={ptsStr(boundary)}
                fill="transparent"
                stroke={darkOn ? "#E8B84B" : "#241318"}
                strokeWidth={2}
                strokeDasharray="6 3"
                vectorEffect="non-scaling-stroke"
              />
              <polygon
                points={ptsStr(building)}
                fill={darkOn ? "rgba(246,234,237,0.4)" : "rgba(36,19,24,0.07)"}
                stroke={darkOn ? "#F6EAED" : "#241318"}
                strokeWidth={1.6}
                vectorEffect="non-scaling-stroke"
              />
              {/* TPZ on existing tree */}
              <ellipse
                cx={35.6}
                cy={69.5}
                rx={4.2}
                ry={3.1}
                fill="rgba(232,184,75,0.08)"
                stroke="#B78A2E"
                strokeWidth={1.2}
                strokeDasharray="4 4"
                vectorEffect="non-scaling-stroke"
              />
            </svg>

            {items.map((it) => {
              const d = BY_TYPE[it.t];
              const w = d.w * it.scale;
              const h = d.h * it.scale;
              return (
                <div
                  key={it.id}
                  className={`${css.item}${it.ghost ? ` ${css.ghostBd}` : ""}`}
                  style={{
                    left: `${it.x}%`,
                    top: `${it.y}%`,
                    width: w,
                    height: h,
                    borderRadius: d.br,
                    opacity: it.ghost ? 0.55 : 1,
                    transform: `translate(-50%, -50%) rotate(${it.rot}deg)`,
                    zIndex: it.ghost ? 3 : 2,
                  }}
                  title={it.why ?? d.name}
                  onClick={() => {
                    if (it.ghost) {
                      const idx = ghosts.findIndex((g) => g.id === it.id);
                      if (idx >= 0) {
                        setGhostIdx(idx);
                        setGhostOpen(true);
                      }
                    }
                  }}
                >
                  <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                    <StudioGlyph type={it.t} ink={!darkOn || frameOn} />
                  </div>
                  {it.ghost ? <span className={css.aiChip}>AI</span> : null}
                </div>
              );
            })}

            <div className={css.north}>N↑</div>
          </div>
        ) : null}

        {!focusOn && planOn && mode !== "survey" ? (
          <nav className={css.rail} data-testid="canvas-tool-rail" aria-label="Drawing tools">
            {TOOLS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`${css.railBtn}${tool === t.id ? ` ${css.railBtnActive}` : ""}`}
                data-testid={`canvas-tool-${t.id}`}
                title={t.label}
                onClick={() => setTool(t.id)}
              >
                <span className={css.railIcon}>{t.icon}</span>
                <span className={css.railLabel}>{t.label}</span>
              </button>
            ))}
            <div className={css.railDiv} />
            <button type="button" className={css.railBtn} title="Undo">
              <span className={css.railIcon}>↩</span>
            </button>
            <button type="button" className={css.railBtn} title="Redo">
              <span className={css.railIcon}>↪</span>
            </button>
          </nav>
        ) : null}

        {showDocks ? (
          <>
            <aside className={css.compliance} data-testid="compliance-dock">
              <div className={css.compHead}>
                <p className={css.kicker}>Compliance</p>
                <span className={css.passPill}>2/3</span>
              </div>
              <div>
                <p className={css.metricKey}>Outdoor area</p>
                <p className={css.metricVal}>{Number(outdoor).toFixed(2)} m²</p>
              </div>
              <div>
                <p className={css.metricKey}>Permeable · min 20%</p>
                <p className={`${css.metricVal} ${css.metricValOk}`}>54%</p>
                <div className={css.bar}>
                  <div className={css.barFill} style={{ width: "54%" }} />
                  <div className={css.barTick} style={{ left: "20%" }} />
                </div>
              </div>
              <div>
                <p className={css.metricKey}>Canopy @ maturity · 15%</p>
                <p className={css.metricVal}>15%</p>
                <div className={css.bar}>
                  <div className={css.barFill} style={{ width: "15%", background: "#E8B84B" }} />
                  <div className={css.barTick} style={{ left: "15%" }} />
                </div>
              </div>
            </aside>

            <aside className={css.sun} data-testid="sun-shade-controls">
              <div className={css.sunHead}>
                <p className={css.kicker}>Sun &amp; growth</p>
                <p className={css.sunTime}>{sunTimeTxt}</p>
              </div>
              <div
                className={css.sunArc}
                onPointerDown={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  const t = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
                  setSunT(t);
                }}
                onPointerMove={(e) => {
                  if (e.buttons !== 1) return;
                  const r = e.currentTarget.getBoundingClientRect();
                  const t = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
                  setSunT(t);
                }}
              >
                <svg viewBox="0 0 100 40" preserveAspectRatio="none">
                  <path d="M2,38 Q50,-14 98,38" fill="none" stroke="rgba(194,69,95,0.3)" strokeWidth={1.5} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
                  <line x1={0} y1={38} x2={100} y2={38} stroke="rgba(36,19,24,0.22)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                  <line x1={sunX} y1={sunY} x2={sunX} y2={38} stroke="rgba(232,184,75,0.6)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                </svg>
                <div className={css.sunDot} style={{ left: `${sunPX}%`, top: `${sunPY}%` }} />
              </div>
              <div className={css.chipRow}>
                {(
                  [
                    ["plant", "PLANT"],
                    ["5yr", "+5 YR"],
                    ["mature", "MATURE"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={`${css.chip}${growth === id ? ` ${css.chipActive}` : ""}`}
                    onClick={() => setGrowth(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className={css.sunFoot}>Shadow ≈ 1.7 m · eaves 5 m · canopies cast</p>
            </aside>

            <aside className={css.bom} data-testid="live-bom-hud">
              <div className={css.bomHead}>
                <p className={css.kicker}>Live BOM / preemptive</p>
                <span className={css.kicker}>{lines.length} lines</span>
              </div>
              <p className={css.bomTotal} onClick={() => setMode("quote")}>
                {aud(28550)} <span className={css.bomGst}>incl. GST</span>
              </p>
              <div>
                {[
                  { name: "Instant turf", amt: 6161 },
                  { name: "Bluestone paving", amt: 16610 },
                  { name: "Excavation & spoil", amt: 1401 },
                ].map((row) => (
                  <div key={row.name} className={css.bomLine}>
                    <span>{row.name}</span>
                    <span className={css.bomAmt}>{aud(row.amt)}</span>
                  </div>
                ))}
              </div>
              <div>
                <button type="button" className={css.riskChip}>
                  TPZ encroachment
                </button>
              </div>
              <p className={css.bomFoot}>2 mitigation overlays ready — click a chip to apply</p>
            </aside>
          </>
        ) : null}

        {ghostCount > 0 && planOn && !focusOn ? (
          <button
            type="button"
            className={css.ghostToast}
            onClick={() => setGhostOpen((v) => !v)}
          >
            <span className={css.ghostDot} />
            {ghostCount} AI suggestions ready{" "}
            <span className={css.ghostReview}>Review →</span>
          </button>
        ) : null}

        {ghostOpen && curGhost && planOn ? (
          <div
            className={css.glass}
            style={{
              position: "absolute",
              left: "50%",
              top: 60,
              transform: "translateX(-50%)",
              width: 320,
              padding: 14,
              zIndex: 20,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
            data-testid="cad-ghost-review"
          >
            <p className={css.kicker}>AI suggestion</p>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 13 }}>
              {BY_TYPE[curGhost.t].name}
            </p>
            <p style={{ margin: 0, fontSize: 12, color: "#7A5560", lineHeight: 1.4 }}>
              {curGhost.why}
            </p>
            <p style={{ margin: 0, fontFamily: "IBM Plex Mono, monospace", fontSize: 11 }}>
              Confidence {Math.round((curGhost.conf ?? 0.8) * 100)}%
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className={`${css.toolBtn} ${css.toolBtnActive}`}
                onClick={() => {
                  acceptOne(curGhost.id);
                  setGhostIdx(0);
                }}
              >
                ✓ Accept
              </button>
              <button
                type="button"
                className={css.toolBtn}
                onClick={() => rejectOne(curGhost.id)}
              >
                Reject
              </button>
              <button
                type="button"
                className={css.toolBtn}
                onClick={() => setGhostIdx((i) => i + 1)}
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
