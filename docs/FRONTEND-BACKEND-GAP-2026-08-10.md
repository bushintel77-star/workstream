# Front-end ↔ Back-end gap analysis — 2026-08-10

**Method:** two parallel subagents inventoried (a) every backend HTTP route in `apps/api/src/routes/*.ts` and (b) every front-end consumer in `apps/web/src` (server actions, `lib/api.ts`, client fetches, Next.js route-handler proxies, contracts usage). The two inventories were then cross-referenced and **every suspected mismatch verified directly** against source — two subagent-reported mismatches (CAD document path, orchestration overlay path) turned out to be subagent errors and were dropped.

## Summary

| Category | Count |
|---|---|
| Backend endpoints (total) | ~150 |
| Front-end consumers (server actions + lib/api.ts methods + client fetches + proxies) | ~90 unique endpoint calls |
| **Backend endpoints with NO front-end consumer** | **~22** |
| **Front-end calls to non-existent backend endpoints** | **0** (seam is sound) |
| **Path/method mismatches** | **0** |
| Backend route files with no dedicated test | 42 / 52 |

The good news: **the seam is structurally sound** — every front-end call resolves to a real backend route with the correct method. The gaps are all one-directional: backend endpoints that nothing in the web app calls.

---

## A. Backend endpoints with no front-end consumer (orphaned surface)

These exist in the API but no `apps/web` code calls them. Grouped by likely intent.

### A1 — Likely dead / deferred features (candidates for deletion or wiring)

| Endpoint | File | Notes |
|---|---|---|
| `GET /readyz` | `health.ts` | Only `/healthz` is used (and even that isn't called from web — it's a deploy/ops probe). Acceptable. |
| `POST /projects/:id/dictation` | `dictation.ts` | Voice-to-design-intent pipeline. No web consumer; mobile may use it. |
| `POST /projects/:id/measurements/photo` | `measurements.ts` | AI photo measurement upload. Only `GET measurements` is consumed. |
| `POST /projects/:id/aerial/upload` | `aerial.ts` | Drone imagery upload. No web consumer. |
| `POST /projects/:id/files/scan-contact` | `project-files.ts` | OCR contact scan. No web consumer. |
| `DELETE /projects/:id/files/:fileId` | `project-files.ts` | File delete. No web consumer — `CLAUDE.md` punch list notes "soft delete silently" concern. |
| `POST /projects/:id/boundary/ingest` | `boundary.ts` | GeoJSON boundary ingest. `auto-trace` is used; `ingest` is not. |
| `POST /projects/:id/orchestration/refresh` | `orchestration.ts` | Manual world refresh. `accept-overlay` / `dismiss-overlay` are used. |
| ~~`GET /projects/:id/documentation-packages`~~ | `documentation-packages.ts` | **Wired 2026-08-10** — `OpsSchedulesDock` lists issued packs for re-download. |
| ~~`GET /projects/:id/documentation-packages/:packId/zip`~~ | `documentation-packages.ts` | **Analysis was wrong** — already consumed by `OpsSchedulesDock` (`window.open(.../zip)`) since before this audit. |
| `POST /projects/:id/design-branches/:branchId/commit` | `design-branches.ts` | Branch commit. `checkout`/`abandon`/`diff`/`merge` are used; `commit` is not. |

### A2 — Accounting integrations (MYOB / Xero) — only status is consumed

| Endpoint | File |
|---|---|
| `GET /myob/customers`, `GET /myob/items`, `GET /myob/sku-links` | `myob.ts` |
| `PUT /myob/sku-links`, `DELETE /myob/sku-links/:sku` | `myob.ts` |
| `POST /myob/projects/:id/customer`, `POST /myob/projects/:id/invoice` | `myob.ts` |
| `GET /xero/contacts`, `GET /xero/items` | `xero.ts` |
| `POST /xero/projects/:id/invoice` | `xero.ts` |

The web only calls `GET /myob/status` and `GET /xero/status` (for the settings integrations panel). The full accounting CRUD surface (customers, items, SKU links, invoice drafting) is backend-only. This is either deferred UI or intended for a future accounting workspace.

### A3 — Suppliers (partial consumption)

| Endpoint | File |
|---|---|
| `GET /suppliers/:supplier` | `suppliers.ts` |

`GET /suppliers` (list all) is consumed via `listSuppliers()`. The per-supplier fetch is not.

### A4 — Crew (consumed via lib/api.ts but verify UI wiring)

`listCrew`, `createCrewApi`, `deleteCrewApi` exist in `lib/api.ts` and the backend has the full CRUD. The web subagent didn't find direct client fetches, but these are likely called through server actions or settings pages. **Lower confidence this is a true gap** — worth a targeted check if crew management UI matters.

---

## B. Front-end calls with no backend — **none**

After verifying the two subagent-flagged mismatches (`getCadDocumentApi` → `/cad` ✓, orchestration overlays → `/accept-overlay` + `/dismiss-overlay` ✓), there are **no dangling front-end calls**. Every server action, `lib/api.ts` method, client fetch, and route-handler proxy resolves to a real backend route.

---

## C. Test coverage on the seam

| Status | Count | Route files |
|---|---|---|
| Has dedicated test | 10 | `contract.test.ts`, `share.test.ts`, `portal.tier1-fortune500.test.ts`, `quote-doc.test.ts`, `design-assist.test.ts`, `design-board-report.test.ts`, `design-branches.test.ts`, `design-findings-twin.test.ts`, `design-telemetry.test.ts`, `presentation-pack.test.ts` |
| No dedicated test | 42 | everything else, including `projects.ts`, `cad.ts`, `boundary.ts`, `orchestration.ts`, `design-canvas.ts`, `surveys.ts`, `designs.ts`, `costings.ts`, `pipeline.ts`, `settings.ts`, `integration-hub.ts`, `myob.ts`, `xero.ts`, `crew.ts`, `suppliers.ts`, `catalog.ts`, `project-files.ts`, `presentation-documents.ts`, `ops-schedules.ts`, `documentation-packages.ts`, `keyless.ts`, `measurements.ts`, `aerial.ts`, `carbon.ts`, `weather.ts`, `site-context.ts`, `cadastral-title.ts`, `activity.ts`, `tasks.ts`, `overrides.ts`, `outputs.ts`, `audits.ts`, `recordings.ts`, `dictation.ts`, `design-ghosts.ts`, `design-sketch-cad.ts`, `protected-files.ts`, `resource-pool.ts`, `stripe-webhook.ts`, `geocode.ts`, `health.ts` |

The **canvas-critical routes** (`design-canvas.ts`, `cad.ts`, `boundary.ts`, `orchestration.ts`) — the ones the `end-of-build` rule flags as regression-risk — are all untested at the route level. This is the highest-leverage gap if you want contract safety on the studio surface.

---

## D. Recommendations (priority order)

1. **Decide the fate of A1 orphans.** 11 endpoints have no consumer. Either wire them (aerial upload, file delete, doc-pack ZIP download are the most product-relevant) or delete them to reduce surface area. `POST /dictation` and `POST /measurements/photo` are likely mobile-app consumers — confirm before touching.
2. **Accounting UI (A2).** 10 MYOB/Xero endpoints are backend-only. If invoice drafting is in the product roadmap, the web UI needs wiring; if not, mark the routes experimental.
3. **Route tests on canvas-critical paths.** `design-canvas.ts`, `cad.ts`, `boundary.ts`, `orchestration.ts` carry the studio regression risk per `end-of-build.mdc` and have zero route-level tests. Adding contract tests here would catch the kind of silent seam break the `AGENTS.md` lint rule was written to prevent.
4. **`DELETE /projects/:id/files/:fileId`** specifically — `CLAUDE.md` already flags destructive-delete UX as a punch-list item. The backend exists; the web just doesn't call it.

---

## E. Disposition (2026-08-10)

Acting on the analysis in priority order:

- **Step 2 (canvas-critical route tests):** done — dedicated `*.test.ts` for
  `design-canvas.ts`, `cad.ts`, `boundary.ts`, `orchestration.ts` added and
  passing (26 tests).
- **Step 3 (wire file delete with confirm):** done — `DELETE /projects/:id/files/:fileId`
  consumed via a Next.js BFF proxy, `SitePackPanel` shows a "Remove" button per
  BYDA file with a destructive `Dialog` confirm, and success/failure toasts are
  shown via `useToast`. The delete is hard (backend unlinks the disk file), so
  the dialog explicitly says it cannot be undone.
- **A1 `GET /documentation-packages` (list):** wired. Issuing a pack used to
  mint a new one on every click and stream its zip once, so an already-issued
  deliverable was invisible and the only way to re-obtain the file was to issue a
  duplicate. `OpsSchedulesDock` now lists prior packs with issue date and a
  direct zip link. Kept probe: `e2e/ops-issued-packs.spec.ts`, verified red when
  the list load is stubbed out.
- **Correction to section A1:** this report listed
  `GET /documentation-packages/:packId/zip` as having no consumer. That was an
  error — `OpsSchedulesDock` already opened it after issuing, and the BFF
  catch-all proxies it binary-safe via `arrayBuffer()` with
  `content-disposition` forwarded. Counted orphans in A1 should therefore read
  10, not 11.
- **A1 remainder + A2 accounting surface:** deferred until product roadmap prioritises them.
