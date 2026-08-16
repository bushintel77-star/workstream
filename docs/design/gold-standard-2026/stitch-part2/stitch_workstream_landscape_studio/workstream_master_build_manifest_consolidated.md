# 📦 MASTER BUNDLE: WORKSTREAM GOLD STANDARD 2026 (FINAL)

This document serves as the absolute "Visual & Technical Law" for the 2026 release. It links the signed-off wireframes to their high-resolution visual benchmarks and the implementation-ready React logic.

---

## 1. THE PRODUCTION MODULES (DESKTOP)

| Phase | Module Name | Wireframe (Code Link) | 4K Visual Benchmark |
|---|---|---|---|
| **Step 0** | [Site Truth: Acquisition]({{DATA:SCREEN:SCREEN_86}}) | {{DATA:SCREEN:SCREEN_86}} | {{DATA:IMAGE:IMAGE_122}} |
| **Phase 1** | [Sketch Studio: Creative]({{DATA:SCREEN:SCREEN_85}}) | {{DATA:SCREEN:SCREEN_85}} | {{DATA:IMAGE:IMAGE_121}} |
| **Phase 2** | [CAD Operator: Technical]({{DATA:SCREEN:SCREEN_84}}) | {{DATA:SCREEN:SCREEN_84}} | {{DATA:IMAGE:IMAGE_119}} |
| **Phase 3** | [Client Proposal: Financial]({{DATA:SCREEN:SCREEN_83}}) | {{DATA:SCREEN:SCREEN_83}} | {{DATA:IMAGE:IMAGE_11}} |
| **Phase 4** | [Build Pack: Handoff]({{DATA:SCREEN:SCREEN_82}}) | {{DATA:SCREEN:SCREEN_82}} | {{DATA:IMAGE:IMAGE_254}} |

## 2. MOBILE COMPANION (ON-SITE)

| Module | Wireframe (Code Link) | 4K Visual Benchmark |
|---|---|---|
| [Mobile Field Bridge AR]({{DATA:SCREEN:SCREEN_81}}) | {{DATA:SCREEN:SCREEN_81}} | {{DATA:IMAGE:IMAGE_120}} |

---

## 3. TECHNICAL SPECIFICATIONS (MCP PULL)

*   **Design System**: {{DATA:DESIGN_SYSTEM:DESIGN_SYSTEM_1}} (Studio Dark)
*   **Implementation Spec**: {{DATA:DOCUMENT:DOCUMENT_113}} (React/Tailwind)
*   **Data Schema**: {{DATA:DOCUMENT:DOCUMENT_191}} (SpatialObject TypeScript Interface)
*   **MCP Config**: Ensure `disabled: false` in `.devin/mcp_config.json` to pull these states directly into VS Code.

---

## 4. ARCHITECTURAL MANDATES
1.  **Zero-Chrome**: Absolute full-bleed. No fixed sidebars or structural headers.
2.  **Instruments**: UI must be floating "Glass Cards" (bg-surface-dim/70, backdrop-blur-md).
3.  **Typography**: Space Grotesk (Technical Data), Inter (UI Labels).
4.  **Spatial Truth**: (0,0,0) Site Origin is a Signal Blue (#0030CF) constant.

*Directive: Use this manifest as the singular source of truth for the engineering build.*