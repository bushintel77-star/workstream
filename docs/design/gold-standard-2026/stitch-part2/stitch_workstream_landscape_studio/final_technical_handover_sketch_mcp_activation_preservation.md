# Final Technical Handover: Sketch MCP Activation & Preservation

## 1. Status: Repository Prepared
The repository has been successfully prepared for a safe Sketch MCP link. All configurations are integration-first, ensuring that Workstream's core logic and backend "Source of Truth" remain intact.

## 2. Final Activation Checklist (Mac/Sketch Operator)
To activate the link on the machine running Sketch:
1.  **Open Sketch**: Launch the Sketch application on the host machine.
2.  **Open Document**: Load the target Workstream Sketch design file.
3.  **Start MCP**: Enable the Sketch MCP server from within the Sketch app.
4.  **Configure Config**: In `.devin/mcp_config.json`, set the `sketch.disabled` flag to `false`.
5.  **Restart Runtime**: Restart your MCP client (Cursor, Windsurf, or Devin) to initialize the handshake.
6.  **Confirm**: Verify that Sketch tools appear in the interface and respond to queries.

## 3. Preservation Boundaries (Critical)
The following surfaces must remain anchored to the Workstream backend and should **not** be replaced by Sketch-only logic:

### Desktop Runtime
- **Source**: `apps/web/src/app/projects/[id]/page.tsx`
- **Logic**: Must keep using `getProject` and `getDesignCanvas` for hydration. `HandoffDesignStudio` remains the primary consumer of resolved backend state.
- **Processing**: The `ProcessingScreen.tsx` flow must continue to own backend progress polling and polling-status redirects.

### Mobile AR Field Bridge
- **Source**: `apps/mobile/app/index.tsx` & `MobileSketchTopbar.tsx`
- **Logic**: Mobile remains a separate Expo app utilizing `useWorkstreamApi`.
- **Handoff**: The "Open in Studio" affordance remains the definitive bridge from the field to the desktop canvas.

## 4. MCP Configuration Reference
```json
{
  "mcpServers": {
    "sketch": {
      "url": "http://localhost:31126/mcp",
      "type": "http",
      "disabled": false 
    }
  }
}
```
*Note: Toggle `disabled` to `false` only on the Sketch host machine.*

## 5. Next Steps for Engineering
- [ ] **Evolve Contracts**: Update `packages/contracts` if Sketch introduces new metadata fields.
- [ ] **Asset Mapping**: Ensure Sketch-exported assets are mapped to the Workstream asset bucket.
- [ ] **Validation**: Run the `sketch:compare` tool (if available) to verify implementation against the design source.