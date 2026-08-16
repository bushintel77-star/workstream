# Final Technical Handover: Developer Connectivity & MCP Activation

## 1. Environment Variable Configuration
To activate the Workstream Design System and Stitch MCP server, you must populate the following `.env` files with your `STITCH_API_KEY`.

### API (Backend)
**File**: `apps/api/.env`
```env
STITCH_KEY=sk_test_... # Your API Key
```

### Web (Frontend)
**File**: `apps/web/.env`
```env
VITE_STITCH_KEY=sk_test_... # Your API Key
```

### Mobile (Companion)
**File**: `apps/mobile/.env`
```env
VITE_STITCH_KEY=sk_test_... # Your API Key
```

## 2. MCP Configuration (Repository-Side)
The handoff bridge is configured but currently inactive. You must modify the config file to enable the server.

**File**: `.devin/mcp_config.json`
**Action**: Set `"disabled": false` within the Stitch block.

```json
{
  "mcpServers": {
    "stitch": {
      "command": "npx",
      "args": ["@stitch/mcp-server"],
      "disabled": false,
      "env": {
        "STITCH_API_KEY": "..."
      }
    }
  }
}
```

## 3. Runtime Activation
After the environment variables are set and the config is updated, restart your MCP client (Cursor, Windsurf, or Devin) to initialize the connection.

1. **Kill current session**: `Ctrl+C` or 'Disconnect'
2. **Restart Runtime**: Re-open the project in your IDE.
3. **Verify Connection**: Look for the 'Stitch MCP' green status indicator in the sidebar.

## 4. Design Intent: Zero-Chrome Architecture
All generated components follow the **Gold Standard 2026** spec:
- **Font**: `Space Grotesk` (Technical/Data), `Inter` (UI).
- **Highlights**: `#fbbf24` (Gold Standard) for active/compliant states.
- **Glass Card**: `bg-surface-dim/70` with `backdrop-blur-md` for all HUD elements.
- **Canvas**: Infinite full-bleed background with `overflow: hidden`.
