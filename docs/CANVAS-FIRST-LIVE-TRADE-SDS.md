# System design specification — Live Trade Sourcing & Cost Estimation

**Status:** Binding product + engineering SDS  
**Date:** 2026-07-19  
**Companions:** [CANVAS-FIRST-UX.md](./CANVAS-FIRST-UX.md) · [CANVAS-FIRST-VOLUMETRIC-ISOLITH-SDS.md](./CANVAS-FIRST-VOLUMETRIC-ISOLITH-SDS.md) · [CANVAS-FIRST-AI-FLORA-ENGINE-SDS.md](./CANVAS-FIRST-AI-FLORA-ENGINE-SDS.md)

---

## Phase firewall

| Capability | Workflow 1 (now) | Stage 2 |
|------------|------------------|---------|
| Supplier inventory | Cached Melbourne trade hub catalog (hourly-shaped constants) | Live Plantmark / Dinsan / Warners / turf APIs |
| Quantity source | `%` board → `estimateStudioDrawing` lines | PostGIS spatial qty tokens |
| Pricing mode | Deterministic trade match + historical index fallback | Account-tier live quotes |
| Canvas HUD | Ambient budget margin line + selection SKU tag | 60 FPS worker telemetry stream |
| Stock checks | Catalog `inStock` flags (async-shaped, sync in UI) | Parallel mouse-up availability fetch |

Do **not** scrape trade portals or invent live credentials for Workflow 1.  
API note: `apps/api/src/lib/suppliers.ts` already documents that AU trade hubs lack public price APIs — Stage 2 needs signed accounts or rate-sheet ingestion.

---

## 1. Pipeline

```text
[ Canvas mutation → estimateStudioDrawing ]
        │
        ▼
 Trade integration router (cached hub catalog)
        │
        ▼
 Deterministic commercial solver
   Qty × wholesale × M_tier + F_radial freight
        │
        ▼
 Ambient margin line + selection SKU tag
   (amber when unverified / OOS)
```

---

## 2. Canvas UI

### Ambient budget margin line

- 1 px rule along the viewport base (`COLOR_VECTOR_MUTED`)
- Right edge: live project total AUD + “Live Trade Matched” or “AI Estimated — Wholesale Unverified”
- Soft budget gate: if `budgetLimitAud` set and total exceeds → line / total use `COLOR_COMPLIANCE_AMBER`
- No modal pop-ups

### Contextual SKU tags

On selection: typographic tag beside the asset — botanical / material · container · unit price · hub.  
Click → alternatives from other hubs sorted by unit price (proximity Stage 2).

---

## 3. Commercial math (Workflow 1)

$$\text{Total} = \sum_i (Q_i \times P_i \times M_{\text{tier}}) + F_{\text{radial}} + \text{GST}$$

| Symbol | Workflow 1 source |
|--------|-------------------|
| \(Q_i\) | Primary estimate line qty (m² / ea / m³) |
| \(P_i\) | Cached hub wholesale (ex GST) |
| \(M_{\text{tier}}\) | Default contractor multiplier `1.0` (profile Stage 2) |
| \(F_{\text{radial}}\) | Hub→site km band × $/km freight table |

Fallback: catalog miss or `forceUnverified` → historical Melbourne SE index on `BY_TYPE` / estimate rates, amber label.

---

## 4. Named hubs (catalog, not live)

Greenlife: Plantmark Wantirna · Plantmark Thomastown · Dinsan (Dingley) · Warners Nurseries  
Bulk / turf: Lilydale Instant Lawn · Anco · Soilco · ANL

---

## Implementation status

| Item | Status |
|------|--------|
| SDS documented | **Done** |
| Melbourne trade catalog + solver | **Done** (this pass) |
| Ambient budget margin line | **Done** (this pass) |
| Selection SKU tag + alternatives | **Done** (this pass) |
| Live supplier APIs / hourly sync job | Stage 2 |
| Account trade-tier profiles | Stage 2 |
