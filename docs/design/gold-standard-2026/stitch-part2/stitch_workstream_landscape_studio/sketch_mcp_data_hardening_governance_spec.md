# Sketch MCP Integration: Data Hardening & Governance Spec

## 1. Field Mapping: Design-to-Contract Bridge
To maintain the "Drawing is the Product" integrity, all data imported from Sketch must map into the Workstream `SpatialObject` schema before reaching the UI.

| Sketch Attribute | Workstream Contract Field | Data Type | Logic / Constraint |
|---|---|---|---|
| `Layer Name` | `metadata.label` | `string` | e.g., "Natural Gas Main" |
| `Symbol ID` | `type` | `enum` | Map to `SERVICE`, `ROOT_ZONE`, or `PLANTING` |
| `Y-Coordinate` | `coordinate.z` | `number` | Invert Sketch Y-axis for 3D depth logic |
| `Metadata: Depth` | `metadata.depth` | `string` | e.g., "-600mm" |
| `Metadata: Status` | `metadata.compliance` | `enum` | Map Sketch status to `SAFE`, `RISK`, or `CONFLICT` |

---

## 2. Post-Sync Validation Checklist
Execute these checks immediately following the first successful Sketch MCP sync (`disabled: false`):

### Desktop Validation (`HandoffDesignStudio`)
- [ ] **Hydration Check**: Verify `getDesignCanvas` still initializes the base coordinate system.
- [ ] **Occlusion Integrity**: Ensure Sketch-imported layers do not obscure the primary "Site Truth" (Easements/Boundaries).
- [ ] **Lens Toggle**: Confirm the `LensDial` correctly filters new Sketch-driven layers.

### Mobile Validation (AR Field Bridge)
- [ ] **Coordinate Lock**: Verify Sketch symbols align with physical GPS/RTK coordinates in the AR viewport.
- [ ] **Token Consistency**: Confirm Sketch "Planting" types use the `#fbbf24` Gold Standard highlight for compliance.

---

## 3. "Do Not Overwrite" Import Policy
To prevent design software from corrupting backend truth, the following "Lock" policy is enforced:

1. **Source of Truth**: The Workstream database remains the owner of `ProjectID`, `SiteBoundary`, and `LegalEasements`.
2. **One-Way Protection**: Sketch data can *append* metadata (e.g., specific plant species) but cannot *overwrite* the (0,0,0) Site Origin or Boundary coordinates defined during Step 0 (Site Truth Acquisition).
3. **Collision Strategy**: If a Sketch object conflicts with a Subsurface Utility Line found during survey, the `SpatialObject` status must be forced to `CONFLICT` regardless of the Sketch document state.

---

## 4. MCP Deployment Checklist (Mac Host)
1. **Sketch App**: Version 96+ required for stable MCP server.
2. **Localhost**: Confirm `http://localhost:31126/mcp` is reachable via browser.
3. **Repo Sync**: Ensure `.devin/mcp_config.json` is updated ONLY on the local machine to avoid polluting the Windows dev environment.
