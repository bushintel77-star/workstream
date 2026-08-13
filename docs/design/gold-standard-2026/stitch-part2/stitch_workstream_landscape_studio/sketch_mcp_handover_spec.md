# Workstream Sketch MCP Handover & Integration Spec

## 1. Integration Philosophy: "The Design as Input, The App as Truth"
The Sketch MCP connection is an **inspection and asset bridge**, not a state replacement. The Workstream backend remains the sole authority for project lifecycles, costings, and construction-ready spatial data.

### Core Architecture Rule
Sketch feeds the design; Workstream executes the product. 
- **Design Inspector**: Use MCP to pull component specs, layout coordinates, and assets.
- **State Owner**: All design data must be mapped into the existing `SpatialObject` and `Project` schemas within the `packages/contracts` and `packages/domain` layers before hitting the UI.

---

## 2. Desktop Preservation: `HandoffDesignStudio`
The primary web surface (`apps/web/src/app/projects/[id]/page.tsx`) must maintain its current hydration logic:
1. **Load**: `getProject` + `getDesignCanvas`.
2. **Resolve**: `resolveCanvasMode` (Survey, Sketch, CAD) and `resolveProjectNextAction`.
3. **Mount**: `HandoffDesignStudio` receives the fully resolved backend state.

**MCP Rule**: Any Sketch-driven synchronization must push data into the `ProjectCanvas` API. The desktop UI should never fetch directly from the Sketch MCP server; it should fetch from the Workstream API which has been updated via an MCP-assisted developer workflow.

---

## 3. Mobile Preservation: "AR Field Bridge"
The mobile Expo app (`apps/mobile`) remains a distinct product surface optimized for field execution.
- **State**: Continues using `useWorkstreamApi`.
- **Handoff**: The "Open in Studio" affordance in `MobileSketchTopbar.tsx` remains the definitive bridge to the desktop canvas.
- **Sketch Impact**: Sketch design changes (e.g., new planting types) must be reconciled in the `packages/ui/tokens.ts` so they render correctly in the mobile AR viewport.

---

## 4. MCP Configuration Checklist ([.devin/mcp_config.json](C:/Users/Tim/Downloads/CURTIS-CO/workstream.worktrees/app-review-desktop-mobile/.devin/mcp_config.json))
| Key | Value | Notes |
|---|---|---|
| **server name** | `sketch` | Dedicated design link. |
| **url** | `http://localhost:31126/mcp` | Localhost (Sketch App must be open). |
| **disabled** | `true` | **Default to true** for Windows/Non-Mac environments. |
| **Action** | Flip to `false` | Only on the Mac host running Sketch. |

---

## 5. Developer Action Items
- [ ] **Evolve Contracts**: Update `packages/contracts` to support any new Sketch-specific metadata fields.
- [ ] **Map Assets**: Ensure assets exported from Sketch are stored in the Workstream asset bucket and referenced via the standard API.
- [ ] **Audit Pipeline**: Use MCP to verify that the implementation in `HandoffDesignStudio.tsx` matches the Sketch source without breaking the `processing/` polling logic.
