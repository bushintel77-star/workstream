# Tier-1 2026 full-spec gap checklist (honest)

Parsed by `scripts/check-tier1-2026-spec-gap.mjs`.  
Against the full *Architecting the 2026 Landscape Co-Pilot* prose + hybrid reconcile (no R3F/Zustand rewrite).

`status` ∈ `shipped` | `partial` | `missing` | `nongoal`  
`priority` ∈ `P0` | `P1` | `P2` | `nongoal`

When `--require` or `REQUIRE_TIER1_SPEC=1`, any **P0** row with `status=missing` fails.

| id | priority | status | clause | evidence | smoke |
|----|----------|--------|--------|----------|-------|
| one-canvas-mode | P0 | shipped | One canvas + ?mode= | studioCatalog MODE_TABS | design-studio.spec.ts |
| camera-chrome | P0 | shipped | CameraChrome outside zoom-world | CameraChrome.tsx | canvas-chrome-detector.spec.ts |
| idle-recession | P0 | shipped | Idle recession ~6s | useChromeIdle.ts | canvas-checklist-s6.spec.ts |
| ghost-until-accept | P0 | shipped | Ghost until Accept; no silent-write | itemsToPlacements filters ghosts; Accept via ghost-accept | canvas-sketch-ai.spec.ts |
| dual-dialects | P0 | shipped | Flat frame vs liquid-glass docks | dialect lint; docks use chromeKit glass | check-studio-dialect |
| cream-board | P0 | shipped | Cream parchment outside camera | parchment-bleed | canvas-cream-zoom.spec.ts |
| hex-purge | P0 | shipped | No raw hex in chrome | check-handoff-chrome-colors green on handoff tree | web:check-handoff-colors |
| frost-aa-floor | P0 | shipped | Glass min opacity + AA across 5 modes | --hc-glass* bumped; contrast AA green | canvas-contrast-aa.spec.ts |
| lock-copy | P0 | shipped | Progressive mode lock copy | modeLockCopy.ts | modeLockCopy.test.ts + mode-lock-copy.spec.ts |
| settings-404 | P0 | shipped | Web settings deleted | settings-pages.spec.ts | settings-pages.spec.ts |
| client-portals | P0 | shipped | Quote / deposit / share routes | app/portal app/share | portal-deposit-token.spec.ts |
| as4970-nrz-srz | P1 | shipped | AS 4970-2025 NRZ/SRZ/multi-stem/tiers | domain + rings + multi-stem inspector + compliance + preemptive tiers | as4970-nrz-srz.spec.ts |
| vicmap-hpu | P1 | shipped | Surface HPU when present | vicmap extract → title-block metaLine/notes when WFS carries it | vicmap.test.ts + architectural-title-block.test.ts |
| deposit-scenario | P1 | shipped | Deposit matches selected scenario | portal ?scenario= | portal.ts + QuotePortal |
| cmdk-palette | P1 | shipped | Full Cmd+K catalogue fidelity | Idle groups AI·Site·BYDA·Design·View·Place | cmdk-groups.spec.ts |
| board-ink-legend | P1 | shipped | Board ink legend (existing/proposed/planting/easement/BYDA) | BoardInkLegend.tsx | board-ink-legend.spec.ts |
| present-states | P2 | shipped | Present empty/locked/ghost | banner + empty/locked e2e; ghost when review open | present-surface-state.spec.ts |
| portal-sheet-tokens | P2 | shipped | Portal light sheet tokens | --portal-* globals | — |
| share-sun-scrubber | P2 | shipped | Share twin sun scrubber when shade armed | sun-shade-controls outside camera | premium-sun-client.spec.ts |
| designer-dock-kit | P2 | shipped | Unified summoned-docks visual kit | chromeKit/summonedDock — ink, compliance, trench, tree inspector, layers, share | board-ink-legend.spec.ts |
| nuqs-url-state | nongoal | nongoal | nuqs adapters | existing searchParams — hybrid | — |
| r3f-primary | nongoal | nongoal | R3F primary drafting | handoff board stays | — |
| zustand | nongoal | nongoal | Zustand studio state | refused | — |
