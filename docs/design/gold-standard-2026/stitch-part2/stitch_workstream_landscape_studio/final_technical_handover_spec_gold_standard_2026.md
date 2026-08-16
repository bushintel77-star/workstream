# Final Technical Handover: Gold Standard 2026 Rollout

## 1. Zero-Chrome Architecture Guidelines
- **Infinite Canvas**: `overflow: hidden` on the viewport. The 3D scene (Three.js/WebGL) must occupy 100% of the screen width and height.
- **Glass HUD Foundation**: All UI elements must be floating 'Glass Cards' using the following Tailwind profile:
  - `bg-surface-dim/70` (Deep Charcoal at 70% opacity)
  - `backdrop-blur-md` (Medium intensity)
  - `rounded-2xl` (Geometric precision)
  - No borders or visible structural frames.

## 2. Spatial Data Schema (TypeScript)
Developers should use this interface for all canvas-based objects to ensure "Spatial Truth":

```typescript
interface SpatialObject {
  id: string;
  type: 'SERVICE' | 'ROOT_ZONE' | 'STAKING_CHIP' | 'BOUNDARY';
  coordinate: { x: number; y: number; z: number };
  metadata: {
    label: string;
    depth?: string; // e.g., "-600mm"
    material?: string;
    compliance: 'SAFE' | 'CONFLICT' | 'RISK';
  };
  renderStyle: 'SOLID' | 'GHOST' | 'GLOW';
}
```

## 3. Token Authority: "Gold Standard" Palette
| Logic | Semantic Token | Hex Code |
|---|---|---|
| **Primary Highlight** | `primary` / `gold-standard` | **#fbbf24** |
| **Canvas Base** | `surface-dim` | **#13171B** |
| **Site Truth** | `signal-blue` | **#0030CF** |
| **Typography** | `on-surface` | **#f8f9ff** |

## 4. Implementation Checklist for Cursor/Windsurf Agents
- [ ] Migrate all legacy CSS `fixed` sidebars to floating `GlassCard` components.
- [ ] Implement the `LensDial` logic to filter `SpatialObject` sets by `type`.
- [ ] Inject `Space Grotesk` as the global technical font.
- [ ] Ensure the 3D 'Tilt' logic uses billboarded labels that always face the viewport camera.
