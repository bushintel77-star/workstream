# Technical analysis — 2026-08-22

Point-in-time analysis of the whole Workstream monorepo. Read-only survey: no
source file was modified, nothing was committed, nothing was deployed, and no
Railway or GitLab state was changed. This document is the only file written.

Method follows the house pattern of `docs/WIP-GAP-SURVEY-2026-08-19.md` and
`docs/agent-prompts/ui-root-cause-survey.md`: `file:line` evidence for every
factual claim, and three evidence buckets kept separate —

- **verified** — read in code, or measured by a command reproduced in Appendix A;
- **docs claim** — asserted only in documentation, not confirmed in code;
- **unverified** — needs a runtime probe this survey could not run.

Where a number appears, the command that produced it is named. Where a defect
is asserted, the code is quoted.

The survey was run as six parallel area sweeps — backend and packages, the web
canvas surface, the web app shell, infrastructure and mobile, tests and quality
gates, and docs-versus-reality — with every load-bearing claim re-verified
directly before it was written down. Where a sweep and a direct measurement
disagreed, the direct measurement is what appears here.

---

## Summary

The codebase itself is in good health. The test suite is real (1,976 passing
cases in 32 seconds), TypeScript is strict, the contracts boundary exists and is
used, and the code comments are unusually honest — several defects in this
document were found because a developer had already written down what was wrong.

Almost every serious finding is about the **machinery around** the code rather
than the code: what enforces it, what deploys it, and what describes it.

1. **Production is serving 827 records with authentication disabled**, and
   `/readyz` — the API's own Railway healthcheck — reports green because the
   check treats "auth not required" as a pass (§6.4).
2. **No merge request has ever been gated.** The `gate` job declares no `rules:`,
   which makes every MR pipeline structurally invalid, and lint runs in neither
   the pre-commit hook nor any executing pipeline (§4.1, §4.6).
3. **A background watcher deploys production from one workstation's working
   directory** on a 60-second timer, labelled with a commit it never checked out.
   The deployment record confirms two different image digests for the same
   commit (§6.3, §6.3.1).
4. **Three CI ratchets lost most of their scope** in the 2026-08-19 SVG
   retirement and all three still report green on committed `main` — the
   reachability gate inspects 9 components instead of 61, in the tree where the
   product lives. Two of the three are being fixed in the working tree as this
   was written, with scope floors, which is the right general fix (§4.2,
   §4.2.1).
5. **Today's autosave outage was a systemic defect, not a slip.** A bound
   declared once in contracts is hand-implemented in 25 files by 10 helpers, and
   the schema at the centre of it has no test asserting it rejects anything
   (§2.1.2, §4.5.1).
6. **The documents designated supreme and first-to-read are the most drifted.**
   The Gold Standard architecture doc still specifies a two-store model whose
   files were deleted the day after that section was audited (§7.7).

The pattern across findings 2, 4 and several others is worth naming on its own,
because it is the most useful thing in this document: **this repository's checks
tend to be satisfiable by the absence of the thing they check.** A gate scoped to
a deleted directory passes. A detector asserting "no chrome inside the canvas"
passes when the chrome component renders nothing (§3.4.1). A test asserting the
ESLint config *contains* a rule passes while flat-config resolution discards it
(§4.4). Each was correct when written; each now certifies its own subject's
disappearance. Adding minimum-scope floors to the existing gates is a small
change that addresses the whole class.

---

## 0. Baseline

**Commit analysed: `1be0960c` "fix(domain): clamp converted feature vertices to
the board", on branch `fix/clamp-feature-vertices`.** That is `origin/main`
(`06566c9c`, "Merge branch 'chore/railway-deploy-upload' into 'main'") plus one
commit — the hotfix for the autosave outage described in §2.1. Verified:
`git rev-parse --short HEAD` → `1be0960`, `git rev-parse --short origin/main` →
`06566c9`, `git log --oneline main..origin/main` → three commits.

Two things about the refs are worth stating because they mislead a reader who
checks out this repo:

- **Local `main` is stale at `65df811`**, three commits behind `origin/main`.
  Anyone reading `main` locally is reading yesterday's tree.
- **Two remotes are configured** (`git remote -v`): `origin` →
  `https://gitlab.com/77999-group1/77999-project.git` (3 remote branches) and
  `github` → `https://github.com/Boringuy7799/workstream.git` (132 remote
  branches, `github/main` frozen at `542831f`, 2026-08-19). `AGENTS.md` records
  the migration off GitHub on 2026-08-19 but the GitHub remote was never
  removed, so a bare `git push` resolves by branch tracking rather than by
  intent. **Verified.**

Working tree at the start of the survey: clean except two untracked files,
`apps/web/AGENTS.md` and `apps/web/CLAUDE.md`, which `next dev` regenerates on
every run (`node_modules/next/dist/server/lib/generate-agent-files.js`). They are
not in `.gitignore`, so they appear as untracked in every session — and, per
§6.3, they are uploaded to production by `railway up`.

**The tree moved mid-survey, and it does not affect the analysis.** MR !5 merged
during this session: `main` is now `39de52e` ("Merge branch
'fix/clamp-feature-vertices' into 'main'"), `git merge-base --is-ancestor
1be0960 39de52e` succeeds, and `git diff --stat 1be0960 39de52e` is **empty** —
the merge tree is byte-identical to the commit analysed here. Every finding below
therefore holds for `main` at `39de52e`.

For completeness, and because a reader re-running these commands will see it:
the working tree passed through a branch `scratch/verify-clamp-negative` carrying
a **staged revert of the clamp fix** (`git diff --cached`: `clampToBoard`
removed, 1 insertion / 15 deletions) — someone else's deliberate negative-case
verification, in flight concurrently with this survey. It was not produced by
this survey, was not touched by it, and is not a defect.

**Remediation began while this survey was being written, and §4.2 is already
partly out of date.** By the close of the survey the tree was back on `main` at
`39de52e` with five modified tracked files, none of them touched by this survey:

| File | Change |
|---|---|
| `scripts/check-feature-reachability.mjs` | +151/-40 — repointed at `canvas`, scope floors added |
| `scripts/check-css-scales.mjs` | +102/-13 — `.tsx` inline-style axes, scope floors added |
| `apps/web/src/components/canvas/handoff/CameraChrome.tsx` | -14 — deprecated `BoardChromePortal` alias deleted |
| `apps/web/src/components/canvas/webgl/WebGLStudioPreview.tsx` | +4 — unrelated: `VignetteOverlay` mount |
| `apps/web/src/styles/globals.css` | +19 — unrelated: `wsPanelIn` keyframes rescued from inline JSX |

The first two are a direct fix for §4.2 and are covered in §4.2.1 with their new
measured output. Read §4.2 as the state of committed `main`, and §4.2.1 as where
the work now stands. Everything else in this document was re-checked against the
committed tree and is unaffected.

Scale, measured with a Node walker that skips `node_modules`, `.next`, `dist`,
`.turbo`, `.git`, `coverage` (Appendix A.1):

| Area | Files | Lines | ts/tsx files | ts/tsx lines |
|---|---|---|---|---|
| `apps/api/src` | 174 | 25,460 | 174 | 25,460 |
| `apps/web/src` | 463 | 86,202 | 416 | 71,958 |
| — of which `components/canvas` | 255 | 61,169 | 243 | 55,963 |
| — of which `canvas/webgl` | 147 | 37,853 | 147 | 37,853 |
| — of which `canvas/handoff` | 89 | 18,079 | 82 | 15,374 |
| `apps/web/src/app` | 91 | 9,173 | 79 | 4,740 |
| `apps/web/e2e` | 34 | 4,646 | 34 | 4,646 |
| `apps/mobile` | 71 | 12,450 | 43 | 11,594 |
| `packages/cad` | 15 | 1,789 | 13 | 1,759 |
| `packages/client` | 3 | 873 | 1 | 849 |
| `packages/contracts` | 50 | 5,420 | 48 | 5,390 |
| `packages/db` | 12 | 3,824 | 10 | 3,792 |
| `packages/domain` | 263 | 45,208 | 250 | 42,629 |
| `packages/ui` | 9 | 565 | 7 | 535 |
| `scripts` | 13 | 1,209 | 0 | 0 |
| `docs` | 102 | 17,217 | 0 | 0 |

Non-test TypeScript source across `apps/` + `packages/`: **696 files,
129,221 lines**; 30 files over 600 lines, 15 over 1,000, 9 over 1,500.

Test suite, run by this survey (`pnpm exec vitest run --reporter=dot`, wall
clock 31.97 s): **270 test files (266 passed, 4 skipped), 1,996 cases (1,976
passed, 20 skipped), zero failures.** The four skipped files are the live-network
Vicmap suites, gated on an env flag (`apps/api/src/lib/vicmap.live.test.ts:28`
and siblings use `describe.skipIf`). **Verified.**

---

## 1. Repo shape and inventory

### 1.1 Workspace members

`pnpm-workspace.yaml:1-3` globs `apps/*` and `packages/*`. Eight members:

| Member | Role | Consumed by |
|---|---|---|
| `apps/api` | Fastify HTTP API, pipeline jobs, integrations | — |
| `apps/web` | Next.js 15 App Router; the operator product | — |
| `apps/mobile` | Expo / React Native field app | — |
| `packages/contracts` | Zod schema boundary — 300 exported schemas | 284 files reference it |
| `packages/domain` | Pure domain maths, catalogues, estimators | 126 files |
| `packages/db` | In-memory store + SQLite write-through journal | 51 files |
| `packages/ui` | Design tokens + 5 React Native components | 33 code importers, **all mobile, all `{ tokens }` only** |
| `packages/cad` | CAD op → entity → DXF/SVG engine | **1 code importer** |
| `packages/client` | Typed API client (`WorkstreamClient`) | **1 code importer** |

Reference counts from `git grep -l "@workstream/<name>"` over tracked files;
importer detail from `git grep -n`.

Three findings here:

1. **`packages/ui` is a token file with 535 lines of dead component code.**
   Every one of the 33 code references is `import { tokens } from
   "@workstream/ui"` and every one is in `apps/mobile` (e.g.
   `apps/mobile/app/_layout.tsx:5`, `apps/mobile/src/components/site/WeatherGlyph.tsx:13`).
   `Button`, `Card`, `Field`, `Flag`, `Metric` (`packages/ui/src/components/`)
   have zero importers. This confirms `docs/WIP-GAP-SURVEY-2026-08-19.md:154-155`
   and it has not changed since. Worse, `apps/web/src/styles/globals.css:4` says
   the web tokens are "Unified with @workstream/ui tokens
   (packages/ui/src/tokens.ts)" — but web does **not** import the package; it
   hand-mirrors the values. Two copies of one palette, reconciled by comment.
   **Verified.**
2. **`packages/cad` and `packages/client` are single-consumer packages that no
   architecture doc mentions.** `packages/cad` (1,759 lines) is imported once,
   at `apps/api/src/lib/cad-job.ts:14`. `packages/client` (849 lines) is imported
   once, at `apps/mobile/src/lib/api.ts:2`. Neither appears in the "Architecture
   facts (don't relitigate)" list in `CLAUDE.md` nor in the service table in
   `AGENTS.md`. A new engineer reading the onboarding docs does not learn these
   exist. **Verified.**
3. **`packages/cad` and `packages/client` declare `"lint": "echo ok"`**
   (`packages/cad/package.json:10`, `packages/client/package.json:9`). Turbo will
   happily report a green lint task for a package nothing lints. See §4.3.

### 1.2 Comment-marker census

**Zero real `TODO` / `FIXME` / `HACK` / `XXX` comment markers exist in the
TypeScript and `.mjs` source.** Measured case-sensitively with word boundaries
over 1,019 files under `apps/`, `packages/`, `scripts/` excluding
`node_modules`, `.next`, `dist`, `.turbo` (Appendix A.2): exactly one hit, and
it is a dollar-amount placeholder inside a prose comment —
`apps/web/e2e/floating-quotation-capsule.spec.ts:10` contains the string
`$X,XXX.XX`. **Verified.**

This is a genuine strength and worth naming as such: the codebase does not
accumulate silent inline debt. It is also the reason §5 matters so much — all
debt lives in `OUTSTANDING.md` and the `docs/` tree, which means the accuracy of
those documents *is* the accuracy of the project's self-knowledge. When a
tracker entry goes stale, nothing in the build notices.

A case-insensitive grep returns 47 hits and all 47 are false positives
(identifiers such as `syncDesignTodosAction`, CSS class `home.todoForm`, and a
test fixture `layerId: "hacker.layer"`). Anyone re-running this census must use
`-CaseSensitive` with `\b` anchors or they will conclude the opposite.

### 1.3 Encoding hygiene

`AGENTS.md:120-133` warns at length about Windows-1252 bytes and PowerShell
re-encoding producing mojibake, and `docs/WIP-GAP-SURVEY-2026-08-19.md:160-163`
recorded `apps/api/src/lib/material-orchestrator.ts` as carrying two lone `0x97`
bytes.

Scanned all 1,276 tracked text files byte-wise (Appendix A.3): **zero UTF-8
BOMs, zero files that fail a strict UTF-8 decode.** The three files containing a
`C3 A2` byte pair are `AGENTS.md:126`,
`docs/GS-2026-COMPLIANCE-SWEEP-2026-08-19.md:117` and
`apps/web/src/styles/globals.css` — the first two are documentation quoting
mojibake as an example, which is legitimate. The `material-orchestrator.ts`
defect is **fixed**; the survey doc that records it is stale in the
already-done direction. **Verified.**

---

## 2. Architecture and boundaries

### 2.1 `packages/contracts` — the Zod boundary

**300 schemas are exported from 40 non-test modules** under
`packages/contracts/src` (39 of them under `schemas/`, plus `index.ts`; counted
by parsing `^export const \w+Schema` across the tree, Appendix A.4).

The boundary is real and broadly honoured, but it has one systemic weakness that
caused a production outage on the day of this survey, and the weakness is a
design property rather than an accident.

#### 2.1.1 The confusable-name defect (live, verified)

Two schemas differ only by a transposed word and carry **opposite** bounds:

```215:218:packages/contracts/src/schemas/catalog.ts
export const CanvasPointPctSchema = z.object({
  x_pct: z.number(),
  y_pct: z.number(),
});
```

```31:34:packages/contracts/src/schemas/landscape-feature.ts
export const CanvasPctPointSchema = z.object({
  x_pct: z.number().min(0).max(100),
  y_pct: z.number().min(0).max(100),
});
```

`CanvasPointPct` is unbounded — deliberately, because ink drawn on the context
ground beyond the title board is legal. `CanvasPctPoint` is clamped to the board.
Consumers:

- `CanvasPointPctSchema` guards `IrrigationZone.points` (`catalog.ts:245`),
  `ConstructionTrench.points` (`catalog.ts:276`) and
  `outline_pct` (`catalog.ts:547`).
- `CanvasPctPointSchema` guards `FeatureVertex.pct`
  (`landscape-feature.ts:50`) and `FeatureGeometry.canvas_origin_pct`
  (`landscape-feature.ts:60`), i.e. all persisted `LandscapeFeature` geometry.

An automated search for word-permutation collisions across all 300 schema names
(Appendix A.4) returns exactly two, and the second is the same hazard:
`IrrigationZoneSchema` (`catalog.ts:241` — a canvas geometry path with emitter
spacing and hydraulics) versus `ZoneIrrigationSchema` (`design.ts:38` — a
bill-of-materials line with `item`/`qty`/`unit`/`sku`). Semantically unrelated,
names one transposition apart.

**This naming is a live design defect, not a stylistic quibble.** Neither
TypeScript nor ESLint nor any test can distinguish "the author meant the other
one"; both compile, both validate, and only one rejects out-of-board input.
Recommendation in §8.

#### 2.1.2 The real root cause: bounds are declared once and re-implemented everywhere

The contract states the bound. It does not export a way to satisfy it. Every
writer therefore hand-rolls the clamp:

- **53 occurrences of `Math.max(0, Math.min(100, …))` (or the transposed form)
  across 25 files** in `apps/api`, `apps/web`, `apps/mobile` and
  `packages/domain` (Appendix A.5).
- **10 separate definitions of a function named `clampPct`**, in
  `apps/web/src/components/canvas/webgl/AssetPlaceLayer.tsx:47`,
  `PlacementGizmo.tsx:43`, `siteTruthImport.ts:120`, `sketchCad.ts:60`,
  `stitchBridge.ts:30`, `handoff/geometry/cameraPointer.ts:24`,
  `handoff/geometry/snap.ts:35`, `handoff/state/canvasBridge.ts:293`, plus
  `packages/domain/src/sketch-to-cad.ts:113` and
  `packages/domain/src/structured-tools.ts:65`.

The same pattern repeats for array caps. `shape_points` is capped at 256 in the
contract (`catalog.ts:202`) and the drafting tool re-declares the number in a
comment-documented constant
(`apps/web/src/components/canvas/webgl/draftShape.ts:46`: "Vertex cap — matches
`CanvasStroke.shape_points` `.max(256)` in contracts"). `outline_pct` is capped
at 64 in the contract (`catalog.ts:547`) while the producer caps at 24
(`packages/domain/src/sketch-to-cad.ts:110`, `MAX_OUTLINE_POINTS = 24`). The two
numbers agree only because the producer's is smaller; nothing enforces the
relationship.

The honest read: **`packages/contracts` is a validation boundary but not an
input-normalisation boundary**, and the codebase has silently taken on the job
of matching it by hand in 25 files. Today's outage was the first writer to get
it wrong. It will not be the last unless the primitive moves into contracts.
**Verified.**

#### 2.1.3 What the fix looks like today

`packages/domain/src/structured-tools.ts:54-66` now carries both the clamp and,
unusually and to its credit, the whole explanation:

```54:66:packages/domain/src/structured-tools.ts
/**
 * Feature geometry is board-bounded by contract (`CanvasPctPointSchema` is
 * 0-100), while stroke points are not (`CanvasPointPctSchema` is unbounded —
 * ink drawn on the context ground beyond the board is legal). Ink converted
 * into a feature therefore clamps to the board edge, the same convention every
 * other feature writer uses (`draftShape.ts` toFeaturePoint, `sketchCad.ts`
 * clampPct). Without it the feature fails validation and every autosave of the
 * whole canvas is rejected.
 */
function clampToBoard(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, v));
}
```

`git show 06566c9c:packages/domain/src/structured-tools.ts` contains no clamp,
confirming the hotfix is what closed it. The diff `06566c9c..HEAD` is 80
insertions across three files, 47 of them new test cases. **Verified.**

Note also that `clampToBoard` guards `Number.isFinite` while the ten
`clampPct` variants do not — `Math.max(0, Math.min(100, NaN))` is `NaN`, which
`z.number()` rejects. So the fixed writer is now stricter than the nine others.

#### 2.1.4 The boundary is not applied uniformly at either edge

`CLAUDE.md` states that contracts is "the Zod schema boundary — change it before
changing the API or any client". In practice the boundary is enforced where the
payload is a canvas document and waived where it is not.

On the API side, several mutating routes parse no body schema at all. The
pipeline, survey, design, costing and audit `POST` handlers accept the request
body untyped, and two routes spread it straight into the persisted record:

- `apps/api/src/routes/quote-doc.ts:28-29` — `...(request.body as object)`
- `apps/api/src/routes/boundary.ts:46` — same shape

This is not a validation bypass in the security sense (tenancy is still checked,
§2.5), but it means the persisted store can hold fields no schema describes, and
a client can write shapes the contract does not admit. **Verified.**

On the web side, the BFF proxy routes under `apps/web/src/app/api/projects/[id]/`
forward bodies to the API without parsing them — with one exception,
`design-canvas/route.ts`, which does validate. So the one route where a
validation failure caused today's outage is the one route that validates, and
the others are pass-through. **Verified.**

The pattern is consistent and worth naming: **the boundary is strongest exactly
where it has already failed loudly, and weakest where it has not yet been
tested.** That is a description of a boundary maintained reactively.

### 2.2 `packages/db`

Covered in detail by the backend workstream; the headline shape from
`CLAUDE.md` — in-memory arrays keyed by `owner_id`, with a synchronous SQLite
WAL write-through journal in `packages/db/src/sqlite-persist.ts`, first-boot
import of a legacy `store.json` then archive — is confirmed by the test output
of this survey: `packages/db/src/sqlite-persist.test.ts` logs
`[db] imported JSON snapshot into SQLite and archived as …store.json.imported-…`
during the run. `packages/db/src/memory.ts` is **2,153 lines**, the fourth
largest non-test file in the repo.

`packages/db` is **not linted** — the root `lint` script covers only four source
roots and `packages/db/src` is not one of them (§4.3).

Two properties of the persistence layer are worth stating explicitly, because
both are fine at current scale and both have a defined breaking point:

**There is no schema version and no migration path.**
`packages/db/src/sqlite-persist.ts:128-136` creates tables if absent and
otherwise proceeds. There is no `user_version`, no migration table and no
startup reconciliation between the columns the code expects and the columns the
file has. Today this is harmless because the SQLite file is a serialisation of
in-memory arrays and a shape change simply writes new JSON into the same
columns. It stops being harmless the moment a column is added or renamed against
an existing production volume — the failure mode is a silent read of missing
data rather than a refusal to boot. **Verified.**

**Every flush rewrites whole collections.** The write-through path deletes all
rows for a collection and reinserts them inside a single transaction, rather than
writing the delta. Correct and crash-safe under WAL, and inexpensive at 827
records (§6.4); it is O(store) per mutation, so cost grows with total data rather
than with the size of the change. Combined with the single-replica constraint
(§6.5) this is the clearest scaling limit in the stack, and it is a deliberate,
documented trade rather than an oversight.

### 2.3 `apps/api`

Route/job detail in the backend workstream section. Two things belong here
because they are cross-cutting:

**The version stamp is structurally impossible to populate.**
`apps/api/src/routes/health.ts:26-34`:

```26:34:apps/api/src/routes/health.ts
function buildSha(): string {
  return (
    process.env.RAILWAY_GIT_COMMIT_SHA ??
    process.env.RAILWAY_GIT_COMMIT_SHA_SHORT ??
    process.env.BUILD_SHA ??
    process.env.GIT_COMMIT_SHA ??
    "unknown"
  );
}
```

Railway injects `RAILWAY_GIT_COMMIT_SHA` only for git-connected builds. Both
deploy paths in this project are CLI uploads (`railway up` — §6.3), and neither
passes `BUILD_SHA`: `.gitlab-ci.yml:174-175` passes only `-m`, and
`scripts/auto-deploy-watcher.mjs:50` passes only `-m`. So `/healthz` and
`/readyz` both report `buildSha: "unknown"` by construction, and
`apps/api/src/routes/contract.test.ts:38` only asserts
`typeof body.buildSha === "string"`, which `"unknown"` satisfies. The web side
has the same hole from the other direction: `apps/web/Dockerfile:10` declares
`ARG NEXT_PUBLIC_BUILD_SHA=unknown`, and neither `package.json:26`
(`build:docker:web`) nor `.gitlab-ci.yml:136` (`build-web-image`) passes it.
**Verified.** Consequence: a running service cannot tell you what it is running,
which is exactly the capability needed to investigate §6.3.

**Env var naming carries an unretired migration.** `health.ts:9-12` reads
`WORKSTREAM_SQLITE_PATH ?? CONSTRUCT_SQLITE_PATH ?? WORKSTREAM_PERSIST_PATH ??
CONSTRUCT_PERSIST_PATH`. `CLAUDE.md` and `AGENTS.md` document only the
`CONSTRUCT_*` names. Two prefixes for one setting, four env vars for one path.

### 2.4 `apps/mobile` is a real app being governed as a prototype

The Expo app is **43 non-test ts/tsx files, 11,594 lines**, of which
`apps/mobile/app/` alone is 16 screens and 8,180 lines:

| Screen | Lines | Screen | Lines |
|---|---|---|---|
| `(app)/project/[id].tsx` | 2,499 | `(app)/measure-photo.tsx` | 523 |
| `(app)/design-studio/[id].tsx` | 1,076 | `(app)/index.tsx` | 433 |
| `(app)/recording.tsx` | 864 | `(app)/new-project.tsx` | 334 |
| `(app)/grid-soil.tsx` | 636 | `(app)/processing/[id].tsx` | 320 |
| `index.tsx` | 281 | `(auth)/sign-up.tsx` | 220 |
| `(app)/confirm-pin.tsx` | 204 | `(app)/filing/[id].tsx` | 159 |
| `(auth)/sign-in.tsx` | 155 | 3 layouts | 176 |

It is not a skeleton. Twelve files import the real typed API client
(`apps/mobile/src/lib/api.ts` → `@workstream/client`), and a grep for
`MOCK|mockData|FAKE|sampleData` across `apps/mobile/app` and `apps/mobile/src`
returns **zero hits** — the zero-mock-data law is being honoured here.

What is a prototype is the governance around it:

- **ESLint hard-ignores `apps/mobile/**`** (`eslint.config.mjs:15`).
- **vitest excludes `apps/mobile/app/**`** (`vitest.config.ts:14`) and only
  includes `apps/mobile/src/components/**/*.{test,spec}.ts`
  (`vitest.config.ts:12`). So all 8,180 lines of screens have no unit coverage
  and no lint.
- The CI gate's mobile check is 13 lines and asserts one string
  (`scripts/check-mobile-placeholders.mjs:7-8`: fail if
  `apps/mobile/app.json` still contains `REPLACE_AFTER_eas_init`). Its docstring
  is honest about that; the gate's *name* in `package.json:14`
  (`mobile:check-placeholders`) reads as though it audits the app.

A 2,499-line screen outside both gates is the largest un-guarded surface in the
repository. **Verified.**

### 2.5 `apps/api` shape and tenancy

`apps/api/src` is 174 files / 25,460 lines: **54 route files** (17 route tests),
**64 lib files** (31 lib tests), 4 plugins (**0 tests**), and **13 pipeline
jobs** (`audit`, `boundary`, `cad`, `cad-qs`, `cost`, `design`, `envelope`,
`keyless`, `output`, `pipeline`, `sketch-cost`, `survey`, `transcription`).

Tenancy scoping looks sound at the file level: **44 of the 54 route files
reference `getOwnedProject`**. The ten that do not are `catalog.ts`, `crew.ts`,
`geo-hero.ts`, `geocode.ts`, `health.ts`, `protected-files.ts`,
`resource-pool.ts`, `settings.ts`, `stripe-webhook.ts`, `suppliers.ts` — reference
data, health, a webhook, and owner-scoped rather than project-scoped resources.
That is the expected set. Whether the owner-scoped ones (`settings`, `crew`,
`resource-pool`) enforce owner identity by a different mechanism is a per-route
question and is **not verified here** at file-grep level.

`apps/api/src/plugins` having zero test files is the one clear coverage hole in
this layer: plugins are where auth, rate limiting and error handling live, and
they are the code most likely to fail in a way every route inherits.

One measurement qualifies "TypeScript strict" as it applies to this app.
`apps/api/src` contains **853 non-null assertions (`!`) across 138 of its 174
files** — overwhelmingly `request.userId!`, where the auth plugin has in fact
guaranteed the value but the type does not say so. This is not 853 latent
crashes; it is one missing type-level fact asserted 853 times. It is worth
recording because it is the single highest-leverage typing change available in
the API: narrowing the authenticated request type once would delete most of
them, and would convert an assertion the compiler cannot check into an invariant
it can. **Verified** (count via `git grep`, Appendix A.9).

### 2.6 `turbo.json` and the stale-`dist` hazard

`turbo.json:4-23` declares five tasks: `build`, `dev`, `lint`, `typecheck`,
`clean`. `dev`, `lint` and `typecheck` all `dependsOn: ["^build"]`.

**There is no `test` task.** The root `test` script (`package.json:10`) is a bare
`vitest run`, so vitest never triggers a dependency build. `AGENTS.md:23-28`
documents the consequence — `apps/api` tests resolve `@workstream/domain` from
its built `dist`, not `src` — and `docs/WIP-GAP-SURVEY-2026-08-19.md:34` records
it actually biting: four `stitchStore` failures that were a stale
`packages/domain/dist` because turbo served `typecheck` from cache and therefore
skipped the domain build.

Inside `pnpm run ci` this is masked, because `web:check-bundle-size`
(`package.json:22`) runs `turbo run build --filter=@workstream/web...` before
`typecheck`, `lint` and `test`. The hazard is real for anyone running
`pnpm test` on its own — which is what a developer does. **Verified.**

---

## 3. The canvas surface

The canvas is the product. It is also, by a wide margin, the largest and most
coupled thing in the repository: **255 files and 61,169 lines** under
`apps/web/src/components/canvas`, of which `webgl/` is 147 files / 37,853 lines
and `handoff/` is 89 files / 18,079 lines (§0).

### 3.1 There are three R3F studios, not one

`AGENTS.md` states plainly: "`WebGLStudio` (R3F `<Canvas>` + DOM Paper Card
overlay) **is the only canvas surface**". The tree has three, each with its own
route, its own chrome dialect and its own client component:

| Route | Client | Lines | Reachable from the UI? |
|---|---|---|---|
| `/projects/[id]` | `webgl/WebGLStudioPreview.tsx` | 2,808 | yes — the product |
| `/subsurface-studio/[id]` | `subsurfaceStudio/SubsurfaceStudioClient.tsx` | 533 | yes — Cmd+K (`StudioCommandPalette.tsx:250-254`) and a link (`WebGLStudioPreview.tsx:2058-2059`) |
| `/growth-studio/[id]` | `growthStudio/GrowthStudioClient.tsx` | 649 | **no** |

**`/growth-studio/[id]` is an orphaned route.** `git grep "growth-studio"` over
the whole repository returns only its own two files plus two documentation
mentions (`docs/GOLD-STANDARD-STUDIO-HANDOVER.md:19`,
`docs/FRONTEND-WIP-AND-GAP-2026-08-19.md:51`). Nothing in `apps/web/src` links to
it, and no Cmd+K command opens it. It is a complete, working 3D studio — the
route does `requireSignedIn()`, `getProject()`, `getDesignCanvas()` and
`buildGrowthPlantInstances()` against real data
(`apps/web/src/app/growth-studio/[id]/page.tsx:1-5`) — that an operator cannot
get to except by typing the URL.

This is precisely the "shipped inert" bug class that
`scripts/check-feature-reachability.mjs` exists to catch, and the gate cannot see
it because `growthStudio/` is outside the one directory it scans (§4.2). The two
defects are the same defect. **Verified.**

Its route comment is worth quoting because it shows the divergence was
deliberate: "Growth Studio — a new, standalone 3D surface (dark glass-HUD
chrome, **not the operator canvas's design system**). Deliberately lives outside
`/projects/[id]` so it isn't wrapped by `ProjectChrome`". A second design
language, on a route with no door.

Also present: five 9-line legacy redirect pages
(`projects/[id]/survey`, `design`, `design/studio`, `design/cad`,
`design/develop`), each a single `redirect()` into `?mode=`. Those are clean.

### 3.2 `studioStore` and the two access paths

`webgl/studioStore.ts` is **1,893 lines**, the third-largest non-test file in the
repo, with a **1,168-line** colocated test (`studioStore.test.ts`) — a good
ratio, and the largest single test file in the tree.

The store is accessed two ways, as the architecture intends: `getState()` for the
imperative `useFrame` path, selectors for the React path. The imperative path
dominates. `git grep -c "getState()"` over `webgl/` (Appendix A.11) finds
**20 non-test files** carrying source call sites, concentrated in:

| File | `getState()` call sites |
|---|---|
| `StudioControls.tsx` | 29 |
| `WebGLStudioPreview.tsx` | 28 |
| `StudioCommandPalette.tsx` | 12 |
| `FusedSketchLayer.tsx` | 11 |
| `studioStore.ts` (self) | 11 |
| `PhotoTracePlane.tsx` | 7 |
| `sceneItems.tsx` | 6 |
| `FusedCamera.tsx` | 4 |
| 12 further files | 1–3 each |

`studioStore.test.ts` alone uses it 163 times, which is why a naive
grep total misleads; the source figure is the one above.

Two observations. First, `StudioCommandPalette.tsx` and `WebGLStudioPreview.tsx`
are DOM components, not `useFrame` participants, and between them account for 40
imperative reads — a DOM component reading through `getState()` does not
re-render when that value changes, so any of those 40 is a potential stale-read
site. Whether any is actually stale is **unverified** — it needs a runtime probe
per call site, which is exactly the sort of thing the disabled
`react-hooks/refs` and `immutability` rules would have flagged statically (§4.4).
Second, this is the concrete cost of the ESLint canvas override: the override is
defensible, but it removes the only mechanical check on the pattern that the
architecture most depends on.

### 3.3 Layer stack

Fourteen `*Layer.tsx` components, 3,610 lines total:

| Layer | Lines | Layer | Lines |
|---|---|---|---|
| `FusedSketchLayer` | 813 | `PlantSpacingGuideLayer` | 230 |
| `IrrigationZoneLayer` | 399 | `AssetPlaceLayer` | 205 |
| `DraftShapeLayer` | 313 | `FeatureLayer` | 191 |
| `FloraRingLayer` | 309 | `MeasureTapeLayer` | 188 |
| `TrenchLayer` | 289 | `EarthworksLayer` | 176 |
| `DimensionLayer` | 174 | `DrainageFlowLayer` | 138 |
| `CadProposalLayer` | 112 | `StitchSnapLayer` | 73 |

`FusedSketchLayer` at 813 lines is doing too much for one scene child: it owns
freehand ink capture, the extrude-to-mass drag gesture, snap visuals, and the
terrain drape, and it carries 11 `getState()` reads. It is the file most likely
to resist a change safely.

The co-planarity strategy across these layers is an ad-hoc y-lift ladder
(0 → 0.008 → 0.01 → … → 0.08) rather than `polygonOffset`, catalogued
exhaustively in `docs/agent-prompts/ui-root-cause-survey.md:293-330`, which also
records six pairs of layers sharing a y value with both sides writing depth.
That analysis is four days old and this survey found no reason to doubt it;
treated here as **docs claim, previously verified**, not re-derived.

### 3.4 `CameraChrome`: the binding rule describes a retired architecture

`.cursor/rules/end-of-build.mdc` — an always-applied workspace rule, injected
into every session — states:

> **Camera chrome (gates B+C):** frosted / dock / HUD UI MUST render through
> `CameraChrome` (portals to `camera-chrome-root` sibling of `.zoomWorld`,
> stamps `data-camera-chrome`).

`CameraChrome` lives at `apps/web/src/components/canvas/handoff/CameraChrome.tsx`
and its only live consumer in the tree is
`handoff/features/present/PresentSurface.tsx:39,890-935`. In `webgl/` the string
appears **once, in a comment** (`webgl/DimensionLayer.tsx:14`). The WebGL studio
uses drei `<Html>` for in-scene labels and a sibling
`[data-testid="webgl-chrome-overlay"]` div for DOM chrome — see
`apps/web/e2e/webgl-chrome-detector.spec.ts:8-12`, which states the WebGL
equivalent rule explicitly.

And `docs/agent-prompts/ui-root-cause-survey.md:245-253` says the opposite of the
rule, in capitals: "**Do NOT introduce `camera-chrome-root`/`data-camera-chrome`
into WebGL** — the chrome detector gate C is SVG-scoped".

So the mandatory rule instructs an engineer to do the thing a binding survey
document forbids, on the surface that is the entire product. Together with the
four non-existent spec files in the same rule (§7.2), this makes
`.cursor/rules/end-of-build.mdc` the most actively misleading artefact in the
repository — and it is the one artefact guaranteed to be read. **Verified.**

#### 3.4.1 `CameraChrome`'s portal host is never rendered

The mechanism is not merely misapplied; it is inert. `CameraChrome` resolves its
portal target by querying, in order, `[data-testid="studio-frame-root"]`,
`[data-testid="studio-board"]` and `[data-testid="camera-chrome-root"]`
(`handoff/CameraChrome.tsx:58-70`). A search for all three test ids across the
whole of `apps/web` returns **matches only inside `CameraChrome.tsx` itself** —
its own selector strings and doc comments. Nothing in the tree renders any of the
three hosts.

```
git grep -n "camera-chrome-root\|studio-frame-root\|studio-board" -- apps/web
# -> 9 hits, all in canvas/handoff/CameraChrome.tsx
```

The host elements were part of the deleted SVG studio's DOM. With no host, the
lookup returns null and `CameraChrome` renders nothing.

The consequence is concrete: `handoff/features/present/PresentSurface.tsx:890-935`
wraps the deck inspector dock in `CameraChrome`, so in present mode that dock
should be absent from the DOM entirely. This survey did **not** run present mode
in a browser, so treat the user-visible outcome as **unverified pending a runtime
probe** — but the static path is unambiguous and there is no test that would
catch it: `webgl-chrome-detector.spec.ts` asserts that `data-camera-chrome` does
**not** appear inside the WebGL canvas, which an element that never renders
satisfies perfectly.

This is the sharpest illustration of the theme running through §4: **a gate that
asserts an absence will pass when the feature is deleted.** The rule mandates the
mechanism, the doc forbids it in WebGL, the host does not exist, and the test is
satisfied by its non-existence. All four artefacts are mutually consistent and
the feature is gone.

### 3.5 `handoff/` is not vestigial

The instinct after an SVG retirement is that the leftover folder is dead. It is
not. `handoff/geometry/` is **43 files / 5,243 lines** and the WebGL
`DimensionLayer` depends on it directly for edge segmentation and label
declutter (`handoff/geometry/polygon.ts`, `handoff/geometry/outsideDims.ts`, per
`docs/agent-prompts/ui-root-cause-survey.md:426-433`). `handoff/state/` is
2,660 lines including a 501-line `canvasBridge.ts` with a 584-line test.
`handoff/features/present/PresentSurface.tsx` is 2,340 lines and is the second
largest file in the repo.

The nine components still exported from `handoff/features/` are the nine the
reachability gate scans, and it reports all nine reachable — so the surviving
`handoff/` surface is genuinely wired. The problem is not that `handoff/` is
dead; it is that the folder name and every path-scoped gate still say "the
retired studio" while the code inside is load-bearing. Any future decision to
delete `handoff/` must start from that 5,243-line geometry library, not from the
folder name.

### 3.6 Autosave presents a deterministic rejection as a transient failure

This belongs in the canvas section because it is the reason today's outage was an
outage rather than an incident: **the studio cannot tell the operator why a save
failed, and it treats an unfixable failure as retryable.**

`useStudioAutosave.ts` classifies every save error into `stale_client`,
`unreachable`, or an unnamed default (`classifySaveError`, imported from
`handoff/features/save/saveDesignCanvasClient`). The debounced path
(`useStudioAutosave.ts:291-304`) short-circuits only on `stale_client`:

- `stale_client` → terminal error, "Refresh" affordance. Correct.
- anything else → `setSaveStatus("retrying")` and walk the whole `BACKOFF_MS`
  ladder, then settle on `error`.

A Zod rejection from the `PUT` is deterministic: the same document will be
rejected on every attempt. So the failure mode is that the studio retries a
guaranteed-failing request several times, shows "Retrying…" throughout, and ends
on a chip reading **"Save failed"** with a **"Retry save"** action that cannot
work. `SaveStatusChip.tsx:38-79` carries explanatory hint text for exactly two
kinds — `stale_client` ("Refresh") and `unreachable` — so a validation rejection
renders with no hint at all.

The actual reason is written to `console.error` (`useStudioAutosave.ts:243`) and
nowhere else. An operator loses work silently; a developer has to open devtools
and know to look. **Verified** (static; the browser presentation was not probed).

Two changes would have turned today's outage into a five-minute fix: classify
HTTP 400 as its own terminal, non-retryable kind, and surface the response's
issue path in the chip. Both are local to these two files.

---

## 4. Quality gates — what is actually enforced

This is the section where the repo's self-image and its reality diverge most.

### 4.1 What blocks a merge: nothing

`.gitlab-ci.yml` declares six jobs. `gate` (`:37-48`) runs `pnpm run ci` and is
the only substantive one. **`gate` declares no `rules:`.** A GitLab job without
`rules`, `only` or `except` inherits the implicit `only: [branches, tags]`, which
excludes `merge_request_event` pipelines. Five jobs then declare
`needs: ["gate"]` in an MR pipeline — `e2e` (`:72`, `parallel: 3`, so three
jobs), `build-api-image` (`:112`) and `build-web-image` (`:130`), each of whose
`rules` do match `merge_request_event` (`:102`, `:121`, `:137`). GitLab validates
`needs` at pipeline creation, so an MR pipeline references a job that is not in
it and the configuration is rejected outright.

**Consequence: merge-request pipelines have never run in this project.** Not the
gate, not `secret-scan`, not the sharded `e2e`, not either docker image build.
`OUTSTANDING.md:15` lists "CI live-verify on GitLab — push to `main` and confirm
the `.gitlab-ci.yml` pipeline is green" as ranked priority #1, still unticked,
which is consistent. **Verified from configuration**; the "never once ran"
observation was established independently today from the GitLab pipeline list
and is not re-derived here.

Even if `gate` ran, browser Playwright would not block: `e2e` is
`allow_failure: true` (`.gitlab-ci.yml:73`) by explicit design, and
`canvas-first-z-stack.spec.ts` was removed from the blocking gate on 2026-08-21
(`.gitlab-ci.yml:32-36`, commit `79ccbde`). So **no browser test has ever gated
a change**, and the entire WebGL studio — the product — has no blocking
end-to-end coverage.

### 4.2 What `pnpm run ci` actually checks

`package.json:24` chains, in order: frozen install → 2 mobile checks →
portal-edge → handoff-colors → studio-dialect → tier1-spec-gap → reachability →
css-scales → bundle-size (with a full web build) → traceability → typecheck →
lint → vitest.

This survey ran the eight cheap script gates directly (Appendix A.6). All eight
exit 0. Their output is the finding:

| Gate | Exit | Reported scope | Scope previously recorded |
|---|---|---|---|
| `check-mobile-placeholders` | 0 | one string in `apps/mobile/app.json` | — |
| `check-mobile-distribution` | 0 | EAS profiles present | — |
| `check-portal-edge` | 0 | silent | — |
| `check-handoff-chrome-colors` | 0 | **372** files | 637 (`WIP-GAP-SURVEY:38`) |
| `check-studio-dialect` | 0 | `[data-frame-rail]` rules | — |
| `check-tier1-2026-spec-gap` | 0 | 23 rows, 20 shipped, 3 nongoal | 23 rows (`WIP-GAP-SURVEY:37`) |
| `check-feature-reachability` | 0 | **9** components, 0 allowlisted | 135 (`WIP-GAP-SURVEY:36`); 121 (`OUTSTANDING:500`) |
| `check-css-scales` | 0 | **23** files, **132** declarations | 78 files / 289 (`OUTSTANDING:520-524`) |

**Three ratchets lost most of their scope in the 2026-08-19 SVG retirement and
all three still report green.** The mechanism is the same in each case: they are
scoped by directory path to the *retired* studio.

The reachability gate is the clearest and the most damaging.
`scripts/check-feature-reachability.mjs:32`:

```32:33:scripts/check-feature-reachability.mjs
const FEATURES = "apps/web/src/components/canvas/handoff/features";
const SRC = "apps/web/src";
```

That is the SVG studio's feature folder. Its `walk()` returns `[]` for a missing
directory (`:47`), so the gate degrades to a silent no-op rather than failing.
Replicating the script's own export-detection logic against other roots
(Appendix A.7):

| Root | `.tsx` files | PascalCase component exports |
|---|---|---|
| `canvas/handoff/features` (**the scanned root**) | 9 | **9** |
| `canvas/webgl` (the product) | 58 | **61** |
| `canvas` (all) | 70 | 75 |
| `components` (all) | 111 | 123 |

The gate exists specifically to catch a finished component that nothing mounts —
its own docstring (`:6-11`) cites `PointerMarkSettings`, a complete 91-line
component with passing unit tests that shipped inert. **It now inspects 9
components and ignores the 61 in the surface where every new component lands.**
The bug class it was written for can recur freely, with CI green. **Verified.**

#### 4.2.1 Two of the three are being fixed in the working tree

Per §0, uncommitted work on `main` addresses the reachability and CSS-scale
gates, and it addresses them the right way — by adding **scope floors**, which is
the general fix for this whole class rather than a one-off repoint. Both were run
during this survey in their in-flight form:

| Gate | Before (committed) | After (working tree) |
|---|---|---|
| `check-feature-reachability` | 9 components | **71 components**, `scope canvas 71/60` |
| `check-css-scales` | 23 `.css` files | **46 `.css` + 171 `.tsx`**, baseline held at 23 files / 132 declarations |

Both exit 0. Three details are worth recording because they show the fix reaches
further than the headline:

- `check-feature-reachability.mjs` now declares `ROOTS` with a `min` per root and
  fails loudly below it — "Repoint ROOTS at the real location. Do not lower the
  floor to pass." Widening the scope also surfaced a latent bug in the script's
  own export detection: `SCREAMING_SNAKE_CASE` names matched the PascalCase
  patterns, so `CAMERA_CHROME_ATTR` was reported as an inert component. The
  docstring had always claimed constants were skipped; the regex never did.
- `check-css-scales.mjs` now scans `.tsx` inline styles for raw `zIndex` and raw
  drei `zIndexRange`, which is **the fix for §4.4** from the other direction: with
  the ESLint selectors shadowed off for `canvas/**`, this script becomes the only
  guard on the studio's z-ladder, and its comment says so explicitly. It
  deliberately does not scan radius or opacity in `.tsx`, on the grounds that
  Three.js material properties are textually indistinguishable from chrome paint
  — a correct call, and the same material-versus-chrome line the handoff-colour
  gate already draws.
- The new docstring records the remaining hole rather than papering over it:
  "Routes are not components: Next.js reaches `page.tsx` by filesystem, so an
  entire route with no inbound link in the product passes. `/growth-studio/[id]`
  is exactly that today." That is §3.1 and §7.9, acknowledged in the gate that
  cannot catch them.

So finding 7 in §8 is substantially delivered for two of the three gates, and the
minimum-scope floor — the recommendation that generalises — is in place. What
remains is the third ratchet (`check-handoff-chrome-colors`, 372 files against a
recorded 637) and the route-reachability gate the new docstring calls for.
**Verified by running both scripts against the working tree.**

`check-css-scales.mjs` has the mirror-image problem, and it compounds with §4.3.
It walks `apps/web/src` for `.css` files only (`:34`, `:63`). But the WebGL
studio imports **zero** CSS modules — all its chrome is inline `style={{}}`
objects, verified in `docs/agent-prompts/ui-root-cause-survey.md:17-21` and
consistent with the tree. So the CSS ratchet is structurally blind to the
product surface. Its own failure message (`:131`) tells the developer to use
`var(--ws-z-*)`, "the 15-step scale in handoffStudio.module.css" — a scale that
same survey records as SVG-only. **Advice pointing at a retired system.**

Both `check-css-scales.mjs` and `check-feature-reachability.mjs` are honest about
being ratchets and both fail on a *stale* baseline as well as a grown one, which
is good design. But `check-css-scales.mjs --update` (`:90-99`) rewrites the
baseline in place, so the ratchet is defeatable by a single command in the same
commit. It is a speed bump, not a gate.

`check-bundle-size.mjs` measures **uncompressed on-disk bytes** of
`apps/web/.next/static/chunks` against `scripts/bundle-size-budget.json`:
8,000,000 bytes total and 7,000,000 bytes JavaScript. There is no per-chunk cap
and no per-route first-load measurement, so a single enormous chunk passes as
long as the directory total is under budget, and nothing measures what a client
actually downloads for `/projects/[id]`. For a Three.js application this is the
budget that matters and it is not the one being enforced. **Verified.**

`check:traceability` is `vitest run packages/domain/src/traceability.test.ts`
(`package.json:23`) — a unit test promoted to a named gate.

### 4.3 Lint scope

`package.json:8`:

```8:8:package.json
"lint": "eslint apps/api/src apps/web/src packages/domain/src packages/contracts/src --max-warnings 0",
```

Unlinted, with non-test ts/tsx counts from §0: `packages/db` (10 files),
`packages/cad` (13), `packages/client` (1), `packages/ui` (7), `apps/mobile`
(43 files / 11,594 lines), `apps/web/e2e` (34), `scripts/` (13 `.mjs`), and every
root config file. `eslint.config.mjs:9-17` additionally hard-ignores
`apps/mobile/**` and `packages/ui/**`, and `packages/cad` and `packages/client`
declare `"lint": "echo ok"`. **Roughly 12,000 lines of shipped TypeScript,
including the entire mobile app, are outside the zero-tolerance lint gate that
`CLAUDE.md` describes as a zero-tolerance gate.** **Verified.**

### 4.4 A rule-shadowing bug in `eslint.config.mjs`

`eslint.config.mjs` configures `no-restricted-syntax` twice:

- `:98-136` for `apps/web/src/**/*.{ts,tsx}` — four selectors enforcing the SDS
  z-token ladder: raw numeric `zIndex`, Tailwind `z-N` classes, the `cfZPair()`
  kind allowlist, and raw drei `<Html zIndexRange={[N, M]}>` pairs.
- `:170-202` for `apps/web/src/components/canvas/**` — four different selectors
  enforcing the UI scales: raw `borderRadius`, raw `fontSize`, raw `gap`, raw
  `rgba()`.

In ESLint flat config a later config object **replaces** a rule's options for
matching files rather than merging them. Confirmed empirically with
`pnpm exec eslint --print-config` (Appendix A.8):

- for `apps/web/src/components/canvas/webgl/WebGLStudio.tsx`, the resolved
  `no-restricted-syntax` contains exactly the four UI-scale selectors;
- for `apps/web/src/app/actions.ts`, it contains exactly the four z-token
  selectors.

**The z-token ladder rules do not apply inside the canvas tree.** That is the
only place they can apply: `cfZPair()` appears in **14 files and every one is
under `apps/web/src/components/canvas/`** — `cfz.ts`, `CanvasFirstLayout.tsx`,
ten `*Layer.tsx`/`MetaChipSet.tsx` components, and two `cfz.*.test.ts` files —
and drei `<Html zIndexRange>` exists only in the R3F scene. So all four
selectors are silently disabled precisely where they were written to bite.

Honest qualification: **there is no live violation today.** A grep of the canvas
tree finds zero raw `zIndex: <digit>` (the single match,
`StudioCommandPalette.tsx:292`, is a comment) and zero raw `zIndexRange={[`.
The defect is a lost guard, not a present breach — combined with §4.2 it means
the WebGL studio's z-index discipline has **no** automated enforcement of any
kind: the CSS ratchet cannot see it because it has no CSS, and the ESLint rule is
shadowed off. **Verified.**

**The documented backstop does not cover the shadowed rules.** The config's own
comment presents the `ui.scan` and `cfz.lint` tests as defence in depth. They are
not, for the z-axis:

- `apps/web/src/components/canvas/ui.scan.test.ts` scans source for the
  *UI-scale* patterns only: `fontSize` (`:139-155`), `borderRadius`
  (`:139-165`) and raw `rgba()`/`rgb()` (`:189-211`). It does not scan for raw
  `zIndex`, `z-N` classes, `cfZPair()` kinds or `zIndexRange`.
- `apps/web/src/components/canvas/cfz.lint.test.ts` does not scan source at all.
  It reads `eslint.config.mjs` **as text** (`:22,26`) and asserts the selector
  strings are present in it — `expect(config).toContain("JSXAttribute[name.name='zIndexRange']")`
  (`:33`) and `expect(config).toContain("cfZPair(")` (`:48`). Its own docstring
  states the intent: "A future refactor could silently" drop the rule (`:6`).

So the one test named as the backstop for the z-ladder verifies the existence of
the config, not its effect. This is the same failure shape as §3.4.1: the check
is satisfied by the artefact rather than the behaviour. **Verified.**

The same config block also disables the five React Compiler correctness rules
(`set-state-in-effect`, `refs`, `preserve-manual-memoization`, `immutability`,
`purity`) for `apps/web/src/components/canvas/**` (`:80-89`). That override is
deliberate, documented at length (`:21-39`), tracked in `OUTSTANDING.md:282-288`,
and its stated cost is 71 additional errors in the canvas components. Unlike the
`no-restricted-syntax` shadowing, this one is a decision. It is worth noting
that the two live in adjacent config objects and one is intended while the other
is a side effect nobody noticed.

### 4.5 Fixture representativeness — the highest-value question

Today's outage is a fixture failure as much as a code failure: 19 of 19 tests
for `buildLandscapeFeatureFromStroke` passed because every fixture used
coordinates comfortably inside the board. No fixture placed a vertex outside
0–100, so no test could distinguish a writer that clamps from one that does not.

Looking for the same pattern elsewhere, the structural picture from §2.1.2 is
what matters: **there are 53 clamp sites and 10 clamp helpers, and the bound they
implement is declared in a different package.** Any test that exercises a writer
with in-range fixtures is, by construction, blind to whether that writer clamps.
The population of at-risk writers is therefore the population of writers, and
the mitigation is not "more boundary tests" but moving the primitive (§8).

Two specific paths were traced end-to-end during this survey and both are
**correctly defended**, which is worth recording so effort is not wasted there:

- `packages/domain/src/sketch-to-cad.ts:117-128` (`decimateOutline`) both caps at
  `MAX_OUTLINE_POINTS` and calls `clampPct` on every point, so the
  `outline_pct` path (`catalog.ts:547`, `.max(64)`) cannot overflow or escape the
  board.
- `apps/web/src/components/canvas/webgl/draftShape.ts:46,223-224` caps vertices
  at the contract's 256 and clamps each point — the precision drafting tools
  shipped today got this right.

#### 4.5.1 The schema at the centre of the outage has no rejection test

The contracts package tests happy paths and skips boundaries. Two measurements
make this concrete:

- **Eight test files cover 39 schema modules.** `schemas/` contains
  `assembly-recipe`, `canvas-annotation`, `catalog`, `contracts`,
  `landscape-feature`, `quote-doc`, `share-revision` and `voice-intent` tests —
  so 31 schema modules have no direct test.
- `packages/contracts/src/schemas/landscape-feature.test.ts` — the schema whose
  `.min(0).max(100)` caused the outage — is **68 lines and contains no assertion
  that any input is rejected**. No `safeParse(...).success === false`, no
  `toThrow`, no vertex at `-1` or `101`. Every fixture is in range. The bound is
  declared in the schema and never exercised in either direction. **Verified.**
- `packages/contracts/src/schemas/cad.ts` is 298 lines carrying **29
  `.min()`/`.max()`/`z.enum()` constraints, and has no `cad.test.ts` at all.**

This is the same blind spot as the producer-side fixtures (above), on the other
side of the boundary. Neither side tests the bound, so the bound's only proof of
existence is a production failure.

The cheapest durable fix is a single generic property test over the exported
schema table: for every schema with a `.min`/`.max` on a numeric field, assert
that `min - 1` and `max + 1` are rejected. That is one test file that grows
automatically as contracts grow, and it would have caught today's defect from the
contracts side without anyone thinking about `LandscapeFeature` specifically.

#### 4.5.2 Where the next one comes from

Ranking by the same shape as today's failure — a contract bound that a writer in
another package must satisfy by hand, with in-range fixtures — the exposed paths
are:

1. `outline_pct` (`catalog.ts:547`, `.max(64)`) versus the producer's
   `MAX_OUTLINE_POINTS = 24`. Defended today (§4.5) but the two numbers are
   independent constants in different packages with nothing asserting the
   relation. A future producer raising its cap to 128 would pass every test.
2. `shape_points` (`catalog.ts:202`, `.max(256)`) versus `draftShape.ts:46`'s
   re-declared 256. Same structure, currently correct, comment-enforced.
3. The nine `clampPct` variants that do not guard `Number.isFinite` (§2.1.3) —
   any of them fed a `NaN` from a degenerate pointer event produces a value
   `z.number()` rejects, reproducing today's outage exactly.
4. The unvalidated API bodies (§2.1.4) — these fail later and more quietly,
   as malformed persisted records rather than a rejected write.

**Unverified** as predictions; the structural exposure behind each is verified.

### 4.6 The only gate that actually runs is the local pre-commit hook

Given §4.1, the git hooks are not a supplement to CI — for merge requests they
are the entire quality gate. Both are worth reading closely.

**`pre-commit`** is `pnpm exec lint-staged`, and `lint-staged.config.cjs:8` is:

```7:9:lint-staged.config.cjs
module.exports = {
  "**/*.{ts,tsx}": () => "pnpm -w typecheck",
};
```

So committing any TypeScript file runs a **whole-monorepo typecheck** — slow,
and deliberately so (the comment at `:2-6` explains that `tsc -p` cannot take
file arguments, which is correct). But note what is absent: **no ESLint, no
tests, no formatter.** The zero-tolerance lint gate that `CLAUDE.md` describes as
the project's defining discipline does not run on commit, and with MR pipelines
broken it does not run in CI either. It runs only when someone types
`pnpm lint`. **Verified.**

**`post-checkout` auto-commits.** The hook snapshots `git diff` to
`.pipeline/dock/patches/working-directory.patch`, updates a manifest, and then:

```
git add .pipeline/dock/manifest.json .pipeline/dock/patches/working-directory.patch
git commit -m "chore(pipeline): auto-snapshot at checkout to $BRANCH" --no-verify
```

Every branch checkout with uncommitted changes creates an unrequested commit on
the branch just entered, bypassing hooks via `--no-verify`, with all errors
suppressed by `2>/dev/null`. The intent is documented and sympathetic — the
comment explains it is a guard against losing carried-over work. The mechanism
mutates history as a side effect of navigation, which makes commit provenance
unreliable and is a plausible contributor to the scratch-branch state observed in
§0. **Verified.**

The hook's own comments also contain mojibake (`hook �?" fires after`), the same
encoding damage catalogued in §1.3.

---

## 5. Debt, risk and known placeholders

`OUTSTANDING.md` is 900 lines and is the project's only debt register (§1.2 —
there are no inline markers). It is well written and unusually candid. It is also
stale **in both directions**, which matters more than usual precisely because it
is the only register.

### 5.1 The documented production placeholders, re-checked

`OUTSTANDING.md:588-640` lists seven "production placeholders — hardcoded data
shipping in live paths". Verified one by one against the code:

| Entry | Reality at `1be0960c` | Verdict |
|---|---|---|
| Plant biogenic carbon (`carbon.ts`) | `packages/domain/src/carbon.ts:42-48` — **7** SKUs with `source: "stub"` and negative `kg_co2e_per_unit` (biogenic uptake shown to clients), `"stub"` is a first-class member of the source union at `:15` | **STILL OPEN, accurate** |
| Survey utilities (`preemptive-risk.ts`) | `packages/domain/src/preemptive-risk.ts:145-146` — `// Utility stub - reserved when survey utilities land.` then an early return | **STILL OPEN, accurate** |
| MYOB token refresh | `apps/api/src/lib/myob.ts:7` — "The token-refresh flow itself isn't implemented" | **STILL OPEN, accurate** |
| Supplier price feeds (`suppliers.ts`) | Entry says "the `SUPPLIERS_LIVE` flag is checked but **no real adapters exist**". A real adapter now exists: `suppliers.ts:114` reads the flag, `:209` refuses to flip mode on the flag alone ("that lied when adapters were stubs"), `:253-256` require `SUPPLIERS_RATE_SHEET_DIR` with valid per-supplier JSON, and `:97` carries an explicit honesty string on the canned path | **PARTLY STALE** — canned by default is right, "no adapters" is wrong |
| Melbourne trade catalog | Entry says static array only. `apps/api/src/lib/melbourne-trade-catalog.ts:58-113` adds an ops override via `MELBOURNE_TRADE_CATALOG_PATH` with a distinct honesty string for each failure mode; the bundled array is `packages/domain/src/live-trade-sourcing.ts:81` | **PARTLY STALE** — same shape as above |
| `subtractPolygon` not clipping | `packages/domain/src/geometry.ts:165-170` is exactly `return outer;`. But `git grep "subtractPolygon"` over the whole repo finds **no caller in any source file** — only `OUTSTANDING.md`, four docs, and the definition. `docs/CANVAS-REMAINING-FEATURES-HANDOVER.md:196` says "Never use … it is a stub" | **MISCLASSIFIED** — this is dead exported code, not a placeholder in a live path. The entry's claim that "survey-job works around this" is not supported by any call site |
| Print line-weight scaling | ticked `[x]` | done |

The `subtractPolygon` row is the interesting one. The tracker frames it as a
correctness risk in the survey pipeline needing a polygon-clipping library; the
code says it is an unreferenced export. The correct action is deletion (the house
rule at `CLAUDE.md` is "Don't add backwards-compatibility shims for removed code.
Delete it"), not a clipping algorithm. **Verified.**

Two placeholders recorded in `docs/WIP-GAP-SURVEY-2026-08-19.md:129-148` are
already fixed and the doc has not been updated: `mapbox.ts:272`'s
`placeholder.aerial` fake URL no longer exists in any source file (the string
survives only in `apps/web/src/lib/mapView.test.ts:35,88` as a negative-case
fixture), and the `material-orchestrator.ts` encoding defect is gone (§1.3).

Minor numeric drift worth noting because it shows how these documents decay:
the carbon stub count is **7** (`carbon.ts:42-48`); `OUTSTANDING.md:618` says 7,
`docs/WIP-GAP-SURVEY-2026-08-19.md:134` says 8,
`docs/FRONTEND-WIP-AND-GAP-2026-08-19.md:98` says 7.

### 5.2 Tracker entries that reality has overtaken

Verified stale in the **already-done** direction:

- `OUTSTANDING.md:601-617` — supplier and trade adapters, per §5.1.
- `OUTSTANDING.md:624-630` — `subtractPolygon`, per §5.1.
- `OUTSTANDING.md:767-774` — describes the landing page at
  `apps/web/src/app/page.tsx` from the pre-removal era; it was removed and has
  now been rebuilt (§7.1), so the entry is accidentally correct again by a
  different route.
- `docs/WIP-GAP-SURVEY-2026-08-19.md:35-56` — records `pnpm run ci` as **RED** at
  the css-scales step with 6 files / 11 deltas. It is green today
  (§4.2); the baseline was re-recorded. The doc still reads as a live red gate.
- `docs/WIP-GAP-SURVEY-2026-08-19.md:36` and `OUTSTANDING.md:500` — reachability
  gate scope, 135 and 121 components respectively. It is 9 today (§4.2). Both
  numbers are now wrong in a way that hides a regression rather than a fix.

Verified stale in the **still-open-but-understated** direction:

- `OUTSTANDING.md:15` — "CI live-verify on GitLab" is listed as ranked priority
  #1 with no detail. §4.1 shows the configuration cannot produce an MR pipeline
  at all. The entry reads like an unticked verification task; it is a defect.
- `OUTSTANDING.md:48-49` — "Single API instance" is a **P0 that is still open**,
  which is accurate, but it is an operating constraint enforced only by a human
  remembering it.
- `OUTSTANDING.md:92-93` — branch protection on `main` still unticked. Combined
  with §6.3 that means neither the branch nor the deploy path is gated.
- `OUTSTANDING.md:306-314` — `webgl-asset-fanout.spec.ts` positional flake,
  tracked and not fixed. Still relevant, and now with §4.1 it can never fail a
  pipeline anyway.

### 5.3 Placeholders and inert code this survey found that no tracker lists

- **`/growth-studio/[id]` is unreachable** — 759 lines of working 3D studio with
  no inbound link (§3.1). Not in `OUTSTANDING.md`.
- **`packages/ui`'s five React Native components have zero importers** (§1.1).
  Recorded in `docs/WIP-GAP-SURVEY-2026-08-19.md:154-155` but absent from
  `OUTSTANDING.md`, which is the live tracker.
- **`apps/web/src/styles/globals.css:4` claims token unification with
  `@workstream/ui` that does not exist in code** (§1.1) — a comment asserting an
  invariant nothing enforces.
- **`packages/cad` and `packages/client` declare `"lint": "echo ok"`** (§1.1).
- **The reachability, css-scales and handoff-colour gates lost 60–93% of their
  scope on 2026-08-19 and all still report green** (§4.2). This is the largest
  single piece of undocumented debt found by this survey.
- **`apps/web/e2e/webgl-chrome-detector.spec.ts:14-16`** describes itself as "not
  yet wired into CI" and as skipping when the studio is absent. Neither is true
  (§7.2).
- **`apps/api/src/lib/boundary-job.ts:120`** — "Survey job prefers Vicmap WFS;
  mock rectangle is the offline fallback." A mock rectangle that can become the
  recorded boundary is flagged in
  `docs/WIP-GAP-SURVEY-2026-08-19.md:142-143` but not in `OUTSTANDING.md`.
- **`apps/api/src/lib/sketch-cost-job.ts:31`** persists the literal string
  "Sketch-stage placeholder…" as a design rationale. Same status.

---

## 6. Infrastructure and deployment reality

### 6.1 The declared path

`.gitlab-ci.yml:156-178` defines `deploy-railway`: on `main`, with
`$RAILWAY_TOKEN` set, install the Railway CLI and run `railway up` twice —
`--service web` and `--service api`, both `--detach`, both with
`-m "GitLab CI $CI_COMMIT_SHORT_SHA: $CI_COMMIT_TITLE"`. Railway project
`e2c12b66-af3a-4a51-a285-874c7a6de7d4` is hardcoded (`:177`). This job carries
`needs: ["gate"]` (`:158`), so on `main` it is downstream of the gate; per §4.1
it can never appear in an MR pipeline.

### 6.2 `.railwayignore` and what `railway up` uploads

`.railwayignore` (root, 47 lines) exists because `railway up` uploads the entire
working directory and a CI cache restore once pushed the archive to 867,494,894
bytes and an HTTP 413. Its own header states the mechanism: "`railway up`
already honours `.gitignore` and skips `.git` and `node_modules` on its own".

The load-bearing consequence: **files that are untracked but not ignored are
uploaded.** `apps/web/AGENTS.md` and `apps/web/CLAUDE.md` are exactly that (§0),
as is any uncommitted edit in the tree at the moment of upload. **Verified.**

### 6.3 The second deploy mechanism, identified

The unexplained `auto-deploy-<sha>-<subject>` deployment records carrying
`cliCaller: agent_unknown:node` are produced by **`scripts/auto-deploy-watcher.mjs`,
a 97-line script committed to this repository and registered to run at Windows
logon.**

Registry, read from `HKCU:\Software\Microsoft\Windows\CurrentVersion\Run`:

```
WorkstreamAutoDeploy : powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass
                       -Command "node \"C:\Users\Tim\Downloads\CURTIS-CO\workstream\scripts\auto-deploy-watcher.mjs\""
```

Its state file `%USERPROFILE%\.workstream-auto-deploy.json` is present. No
`node.exe` process referencing it was running at the time of this survey
(`Get-CimInstance Win32_Process`), so it is armed for next logon rather than
live this minute. **Verified.**

What it does (`scripts/auto-deploy-watcher.mjs`):

- polls `https://gitlab.com/api/v4/projects/77999-group1%2F77999-project/repository/commits/main`
  every 60 s (`:21-24`, `:65-80`);
- when the head SHA changes, runs the local Railway CLI:
  `railway up --project <id> --service web|api --environment production --detach
  -m auto-deploy-<sha8>-<slugged-title>` (`:45-63`, `:84-85`);
- reads a GitLab personal access token from the state file and sends it as
  `PRIVATE-TOKEN` (`:20`, `:67`, `:73`);
- authenticates to Railway from `~/.railway/config.json` (`:6`) — a full account
  credential, not a project-scoped CI token;
- advances its stored SHA only when both services exit 0 (`:86-97`).

**The defect is that it never checks out the commit it names.** It reads the SHA
only to decide *whether* to fire; `railway up` then uploads whatever is on that
machine's disk. So the deployment record asserts a commit while the artefact is
"the developer's working directory at that instant" — a different branch,
uncommitted edits, untracked files, all included per §6.2. The label is
inaccurate by construction, not by accident.

This is live right now in a way worth spelling out: HEAD in this working tree is
`fix/clamp-feature-vertices`, not `main`. If `main` advances while the tree sits
on this branch, the watcher will upload the hotfix branch's tree to production
and stamp it with `main`'s SHA.

It also explains §2.3 completely: both deploy paths are CLI uploads, so Railway
never has git metadata to inject, so `buildSha` is `"unknown"` on every
deployment, so **no running service can be asked which of the two mechanisms
produced it.** The one diagnostic that would resolve provenance is the one the
provenance problem removed.

Assessment, plainly: this is a supply-chain and reproducibility defect of the
first order. Production is deployable from one developer's unvalidated working
directory, on a 60-second timer, with account-scoped credentials and a plaintext
PAT, bypassing the CI gate entirely — and given §4.1 (MR pipelines never run)
and the `$RAILWAY_TOKEN` precondition on `deploy-railway`, it may in practice be
the *only* mechanism that deploys. Two independent uploaders racing five minutes
apart on the same commit, as observed today, is the benign symptom of that
arrangement; the malign one is a deploy nobody can reproduce.

#### 6.3.1 The race is confirmed in the deployment record

The Railway deployment list for commit `06566c9c` shows both mechanisms firing
five minutes apart, and — decisively — **producing different image digests for
the same commit**:

| Time (UTC) | Service | Origin | `cliCaller` |
|---|---|---|---|
| 06:42:00 | web | `auto-deploy-06566c9c-…` | `agent_unknown:node` |
| 06:42:05 | api | `auto-deploy-06566c9c-…` | `agent_unknown:node` |
| 06:47:34 | web | GitLab CI `deploy-railway` | CI token |
| 06:47:36 | api | GitLab CI `deploy-railway` | CI token |

Two artefacts, one commit label, different digests. That is the reproducibility
defect made visible: the commit does not determine the artefact. A third
`cliCaller` value, `agent_unknown:vscode:devin`, also appears in the history, so
at least three distinct upload origins have written to production.

Neither Railway service has a git source connected (`source: null` on both), so
the platform has no independent record of what was deployed — consistent with
§2.3's `buildSha: "unknown"`. Production at the time of this survey is a GitLab CI
deploy of a later commit (`39de52ed`, 07:08 UTC). **Verified from the Railway
deployment records.**

#### 6.3.2 Three `railway.toml` files, and the API uses the wrong one

There are three config files: root `railway.toml`, `apps/api/railway.toml` and
`apps/web/railway.toml`. The API service resolves the **root** config, whose
watch paths are scoped to `apps/web/**`. So API deploy triggers key off web file
changes.

Healthcheck paths also drift from their documentation: `RAILWAY.md` states the
API healthcheck is `/healthz`, while the Railway service is configured for
`/readyz`; the web service's healthcheck is `/` rather than `/readyz`, so it
verifies that the marketing landing renders rather than that the app can reach
its dependencies. All three are individually minor and collectively mean the
deploy configuration is not described accurately anywhere. **Verified from
service config.**

### 6.4 Production is running with authentication disabled

This is the most consequential single finding in the survey and it is verifiable
from outside the network. Probed during this survey:

```
GET https://api-production-a8ff1.up.railway.app/healthz
{"status":"ok","ok":true,"buildSha":"unknown","dbWritable":true,
 "records":827,"timestamp":"2026-08-22T07:32:50.749Z"}

GET https://api-production-a8ff1.up.railway.app/readyz
{"status":"ok","checks":{"store":true,"persist_dir":true,"db_writable":true,
 "clerk":true,"public_api_url":true,"cors_origin":true,"portal_secret":true},
 "buildSha":"unknown","records":827,…}
```

`/readyz` reports `clerk: true`. Read `health.ts`'s definition of that check:

```60:60:apps/api/src/routes/health.ts
      clerk: !isAuthRequired() || !!process.env.CLERK_SECRET_KEY,
```

Railway has **no
`CLERK_SECRET_KEY` set on either service**. A true result with no secret present
therefore has exactly one explanation: **`AUTH_REQUIRED` is false in
production.** Per `CLAUDE.md` and `apps/api/.env.example`, that path resolves
every request to a single shared `dev-user`.

So: **827 live records sit behind an owner identity that any caller receives,**
and the readiness probe reports green because the check is written to permit
precisely this configuration. The green tick is not a bug in the check — it is
the check faithfully reporting "auth is not required, so a missing Clerk key is
fine". It is the *configuration* that is wrong, and the check is designed not to
complain about it.

Two things make this sharper than a missing environment variable:

1. `/readyz` is the API's Railway healthcheck (§6.3.2). The one automated signal
   watching production is satisfied by the unauthenticated state.
2. It interacts with §7 in the worst way. `apps/web/src/middleware.clerk.ts:4-9`
   lists `"/"` in `isProtectedRoute` and calls `auth.protect()`. Enabling Clerk
   to close this hole would, with no other change, put the **public marketing
   landing page behind a login wall** — because `/` is a landing page, not the
   redirect to `/home` that `AGENTS.md` claims (§7.1). The remediation is
   blocked by the drift.

**Verified** (live probe plus code reading). Whether 827 records contain real
client data or accumulated test projects was not determined and is the first
question to answer.

### 6.5 Platform observations

Railway `railway.toml` config-as-code is deprecated by the platform; existing
files continue to work until 2026-12-01. **Established today, not re-derived.**

Single-replica constraint: `OUTSTANDING.md:48-49` records "Single API instance —
keep one API replica on Railway while SQLite is single-writer (the journal lives
on `api-volume`)" as a **P0 that is still open**, i.e. it is a documented
operating constraint rather than an enforced one. Two replicas would give two
processes a single WAL journal on one volume with no coordination.

Local `.turbo` is ~12.6 GB. A developer-experience observation, not a repo
defect; `.gitignore` covers it and `.railwayignore` excludes it from uploads.

#### 6.5.1 Tracked artefacts that contradict the canonical deploy

Root-level `git ls-files` returns 42 entries. Several should not be there, and
one is actively misleading:

- **`netlify.toml`** declares a full Netlify build for `apps/web` with
  `@netlify/plugin-nextjs` and `NODE_VERSION = "20"`. Railway is the canonical
  and only production target (`CLAUDE.md`, `AGENTS.md`), and the repo requires
  Node 22. A tracked deploy config naming a different platform and the wrong
  Node major is a live trap for anyone who finds it before the docs.
- **`fieldloop-buildpack.zip` plus 30 tracked `fieldloop-*` paths** — a
  specification pack for a different product, committed into this repository.
- **Four UUID-named PNGs at the repository root**
  (`65049ca3-…png`, `78a5d9c8-…png`, `7c53d282-…png`, `86992f58-…png`),
  roughly 1.3 MB in total, with no referencing code or document.
- **`# Walkthrough — Workstream.txt`** and `.git-commit-msg.txt`, both scratch
  files.

None of these is a defect in running code. They matter for two reasons: they are
uploaded to production on every `railway up` (§6.2), and root-level clutter is
where a reader forms their first judgement of what the project is. **Verified.**

---

## 7. Docs-versus-reality drift

The `docs/` tree is **101 markdown files / 14,505 lines** (102 files / 17,217
lines counting every extension), plus 20 markdown files at the repository root.
That is roughly one line of documentation for every 9 lines of non-test source.
The volume is not the problem; the problem is that several of
these documents are *binding* — `AGENTS.md`, `CLAUDE.md` and
`.cursor/rules/end-of-build.mdc` are injected into every AI session and are the
first thing a new engineer reads — and the binding ones contain the drift.

Every finding below was verified on both sides — the claim in the document and
the state of the code.

### 7.1 `/` does not redirect to `/home`

`AGENTS.md` states: "Home: `/` redirects to `/home` — operator dashboard
(address composer + sites list). The old marketing landing with mock telemetry
was removed (zero-mock-data law; `docs/UI-PARITY-AUDIT-2026.md` §4)".

`apps/web/src/app/page.tsx:21-35` renders a landing page directly — no
`redirect()`, no `next/navigation` import at all. It is a `force-dynamic` server
component that renders `<LandingCanvas>` with a real ArcGIS aerial URL from
`buildHeroAerialUrl()`. `/home` still exists and is the operator dashboard
(`apps/web/src/app/home/page.tsx:65-161`, `requireSignedIn()` then
`listProjects()`).

So the doc is wrong twice over: there is no redirect, and there *is* a landing
page again — the live site-analysis hero that shipped today (`d0dd1ec`). Note
that `OUTSTANDING.md:767-774` still describes a landing page at
`apps/web/src/app/page.tsx` from the pre-removal era and is now accidentally
correct again. Two trackers, opposite claims, one of them right by coincidence.
**Verified both sides.**

### 7.2 The binding end-of-build rule names four e2e specs that do not exist

`.cursor/rules/end-of-build.mdc` is an always-applied workspace rule. Its
canvas-specific section names four "kept detector" specs as mandatory:

| Named in the rule | Exists at `apps/web/e2e/`? |
|---|---|
| `canvas-cream-zoom.spec.ts` | **no** |
| `canvas-chrome-detector.spec.ts` | **no** |
| `elevation-callout-hit.spec.ts` | **no** |
| `canvas-contrast-aa.spec.ts` | **no** |

It also cites `docs/STUDIO-STYLING-AND-UX.md` § Camera parenting, which
**does not exist** — `AGENTS.md` itself records that document as removed in the
2026-08-19 legacy prune, alongside `docs/CAD-AI-2026-UX.md`,
`docs/OPERATOR-STUDIO-GOLD-WALKTHROUGH.md` and
`docs/ENV-AND-SITE-META-STICKY.md` (all three confirmed absent).

Being fair to the tree: two of the four have renamed successors with equivalent
intent. `apps/web/e2e/webgl-contrast-aa.spec.ts:8-42` genuinely walks all five
modes and asserts zero AA failures, and
`apps/web/e2e/webgl-chrome-detector.spec.ts:19-42` is the stated "gate C
successor". The other two covered SVG-only behaviour (parchment outside the CSS
camera; a `FrameDrawer` double-portal) and are legitimately gone with the
surface. `canvas-first-z-stack.spec.ts` survives but was removed from the
blocking gate (§4.1).

The defect is still real and it is a governance defect, not a testing one: the
mandatory completion gate for canvas work instructs every engineer and every AI
session to run four files that were deleted three days ago, and to consult a
deleted document. A gate that cannot be satisfied as written is a gate that gets
waived, and nothing records the waiver. **Verified.**

One further stale claim inside a surviving spec:
`apps/web/e2e/webgl-chrome-detector.spec.ts:14-16` says "This probe is authored
but not yet wired into CI — it activates when the WebGLStudio is mounted on the
project page (Phase 1 completion). Until then it skips if the WebGL studio is not
found." The WebGL studio has been the only surface since 2026-08-19, and the
spec does not skip — `:30` is `await expect(canvas).toBeVisible()`, which fails.
The comment describes neither the product nor the code.

### 7.3 The same rule mandates an architecture the code forbids

`.cursor/rules/end-of-build.mdc` requires all frosted/dock/HUD chrome to render
through `CameraChrome`; the WebGL studio does not use `CameraChrome` at all, and
`docs/agent-prompts/ui-root-cause-survey.md:245-253` explicitly forbids
introducing it. Full evidence in §3.4. This is the most consequential drift in
the repository because the rule is auto-injected and the survey document is not.

### 7.4 "The only canvas surface" is three canvas surfaces

`AGENTS.md` states `WebGLStudio` "is the only canvas surface". Three R3F studios
exist on three routes, one of which is unreachable. Full evidence in §3.1.
**Verified both sides.**

### 7.5 The lint gate is narrower than `CLAUDE.md` describes

`CLAUDE.md` calls lint "a zero-tolerance gate" running "over `apps/api/src`,
`apps/web/src`, `packages/domain/src` and `packages/contracts/src` at
`--max-warnings 0`". That description of the *command* is exactly right
(`package.json:8`). What it omits is the consequence: ~12,000 lines of shipped
TypeScript including the whole mobile app sit outside it (§4.3), and two
workspace packages declare a fake `lint` script. The doc's own framing — "five
features had shipped inert because nothing reported the unused variable that
proved it" — is the argument for closing that gap, made in a document that does
not mention the gap exists.

### 7.6 Documents that reference deleted documents

Confirmed absent from the tree while still being cited: `docs/STUDIO-STYLING-AND-UX.md`
(cited by `.cursor/rules/end-of-build.mdc` and `OUTSTANDING.md:327`),
`docs/CAD-AI-2026-UX.md`, `docs/OPERATOR-STUDIO-GOLD-WALKTHROUGH.md`,
`docs/ENV-AND-SITE-META-STICKY.md`. `AGENTS.md` correctly records these as
removed in the 2026-08-19 prune — and then `.cursor/rules/end-of-build.mdc`,
which `AGENTS.md` itself points to as the "binding detail", cites one of them
anyway.

### 7.7 The supreme architecture doc still describes the two-store model

This is the most significant drift not yet covered, because of which document it
is in. `AGENTS.md` designates `docs/GOLD-STANDARD-2026.md` and its companions as
"SUPREME … If a change contradicts this doc, this doc wins".

`docs/GOLD-STANDARD-2026-ARCHITECTURE.md:209` is headed **"5. State layer — two
stores, one persisted canvas (corrected 2026-08-18)"**, and `:216-237` describes
both in detail: the SVG studio's `useStudioState` reducer hook at
`handoff/state/useStudioState.ts` ("~4,600 lines"), the 6,570-line
`HandoffDesignStudio.tsx` as "the `?svg=1` fallback", and the rule that the two
stores "meet only at the persisted canvas document".

**Neither file exists.** A repository-wide glob for `useStudioState.ts` returns
zero results, as does one for `HandoffDesignStudio.tsx`. Both were deleted in the
2026-08-19 prune.

The dating is the point. That section carries an explicit correction note — "an
earlier draft of this section claimed the WebGL studio consumes the classic
`useStudioState` hook. It does not" — stamped **2026-08-18**, the day before the
code it describes was removed. The section was carefully audited and then
invalidated within twenty-four hours, and has not been revisited in the three
days since.

`CLAUDE.md` repeats the claim ("The two canvas studios are deliberate
exceptions"), and `README.md:30` describes a "two-studio split (WebGL default /
`?svg=1` fallback)" to any first-time reader — `?svg=1` routing having been
removed in the same prune.

The consequence is not confusion about the past but a live instruction about the
future: an engineer reading the supreme architecture doc is told to preserve an
isolation boundary between two stores, one of which does not exist, and to treat
`DesignCanvas` as a meeting point rather than simply as persistence. **Verified
both sides.**

### 7.8 `ONBOARDING.md` points into a directory that does not exist

`ONBOARDING.md` — designated by `AGENTS.md` as "the single current-state entry
doc: … Read this first" — directs readers to
`docs/archive/pre-gold-standard-2026/` for the retired documents. **There is no
`docs/archive/` directory.** The pruned docs live in git history only, which
`AGENTS.md` states correctly. So the first document a new engineer is told to
read sends them to a path that does not exist, for context that `AGENTS.md`
already explains properly. **Verified.**

### 7.9 Two web-shell defects that the drift conceals

These are code defects rather than documentation drift, but they belong here
because in both cases the documentation is what makes them invisible.

**Project mutations revalidate the wrong route.**
`apps/web/src/app/actions.ts` calls `revalidatePath("/")` at five sites —
`:123`, `:137`, `:163`, `:214`, `:225` — covering project create and delete. But
`/` is the marketing landing (§7.1); the page that lists projects is `/home`. So
creating or deleting a project invalidates the cache for a page that does not
show projects, and leaves the dashboard's cache intact. An operator can create a
site and not see it appear. This is a direct, mechanical consequence of the
`AGENTS.md` claim that `/` *is* the dashboard: the code is correct for the
documented routing and wrong for the actual routing. **Verified statically**;
user-visible staleness depends on cache behaviour and was not probed.

**Finished pages have no route in.** `apps/web/src/app/projects/[id]/` contains
**16 `page.tsx` files** (audit, carbon, costing, design + three sub-routes,
filing, measurements, outputs, overview, processing, recordings, survey, tasks,
and the index). A search for `href=` across all of `apps/web/src` finds **no link
to `/audit` or `/measurements`** — the single near-match,
`ProjectUtilitySurface.tsx:493`, is `href={measurement.image_uri}`, an image
link. Both pages are reachable only by typing the URL. Separately,
`dashboard.module.css` has **zero importers**.

This is the exact bug class `check-feature-reachability` was written to prevent
(its docstring cites a complete component with passing tests that shipped
inert), sitting in the exact blind spot created when its scanned root was retired
(§4.2). The gate scans nine components in `handoff/features` and cannot see app
routes at all. **Verified.**

The in-flight rewrite of that script (§4.2.1) names this limitation in its own
docstring — "Routes are not components: Next.js reaches `page.tsx` by
filesystem, so an entire route with no inbound link in the product passes" — and
cites `/growth-studio/[id]` as the example. So the gap is now documented in the
gate; the pages above remain unlinked, and a route-level check is still
unwritten.

### 7.10 Structural observation

`AGENTS.md` and `CLAUDE.md` are maintained with real care and are mostly
accurate about architecture. The drift concentrates in three places, and the
pattern is consistent:

- **statements about routing and surfaces**, which change fastest (§7.1, §7.4);
- **the `.cursor/rules/` file**, which is the one document nobody re-reads
  because it arrives automatically (§7.2, §7.3);
- **the documents formally designated as supreme or first-to-read** (§7.7,
  §7.8), which acquire authority precisely by being stable, and are therefore
  the least likely to be revised when the code moves.

The third is the one to take seriously. A document's designated authority and
its probability of being updated are inversely related, and this repository has
institutionalised that inversion by naming its most static documents binding.

---

## 8. Findings ranked by leverage

Ranked by (blast radius × likelihood) ÷ effort. The first three are the ones
worth doing this week. The first is worth doing today.

### 1. Establish whether production should be serving 827 records without authentication

Evidence §6.4. `/readyz` reports every check green while `AUTH_REQUIRED` is
false and no `CLERK_SECRET_KEY` is set, so every request resolves to one shared
`dev-user`. This ranks first because it is the only finding here with a
confidentiality dimension, and because the readiness probe actively conceals it.

Three steps, in order. First, determine what those 827 records are — real client
sites or accumulated test projects. That answer changes the urgency by an order
of magnitude and nothing else should be decided before it. Second, change the
`clerk` check at `apps/api/src/routes/health.ts:60` so it cannot report green on
an unauthenticated production: gate the permissive branch on a non-production
`NODE_ENV`, or report the auth mode as an explicit field rather than a boolean
that conflates "configured" with "not required". Third, set the Clerk keys — but
note that this is blocked by finding 2 below, because `middleware.clerk.ts:4`
protects `/` and `/` is the public landing page. Enabling auth today puts the
marketing page behind a login wall.

That dependency is the reason this is not simply "set the environment variable".

### 2. Fix `/` versus `/home`, in code and in `AGENTS.md`

Evidence §7.1, §7.9, §6.4. One 40-year-old-style routing inconsistency is
currently causing three distinct problems: five `revalidatePath("/")` calls
invalidate the wrong route after project mutations, the Clerk matcher would wall
off the public landing, and the binding onboarding document tells every reader
and every AI session the opposite of what the code does.

Decide which `/` is — landing or dashboard — then make the middleware matcher,
the `revalidatePath` targets and `AGENTS.md` agree. This is a small change that
unblocks finding 1 and removes a whole class of "the docs said" confusion.

### 3. Retire `scripts/auto-deploy-watcher.mjs`; make the CI deploy the only deploy

Evidence §6.3. Production is currently deployable from one workstation's
unvalidated working directory, on a timer, labelled with a commit it did not
build. Nothing else in this document can be trusted about production until the
artefact provenance is single-valued. Concretely: delete the registry Run entry
and the script, revoke the plaintext GitLab PAT in
`%USERPROFILE%\.workstream-auto-deploy.json`, replace the account credential in
`~/.railway/config.json` with a project-scoped token held only as a GitLab CI
variable — and fix finding 4 below so the CI path can actually run.

### 4. Fix the merge-request pipeline: give `gate` a `rules:` block

Evidence §4.1. Add
`rules: [{ if: '$CI_PIPELINE_SOURCE == "merge_request_event"' }, { if: '$CI_COMMIT_BRANCH == "main"' }]`
to `gate` (matching what `secret-scan` already does at `:62-64`) and the five
`needs: ["gate"]` jobs become valid. This is a four-line change that turns an
entire CI configuration from decorative into enforcing. Everything else in §4 is
downstream of it: there is no point tightening ratchets that never execute.

### 5. Move the board-coordinate primitive into `packages/contracts`

Evidence §2.1.2, §4.5. Export the clamp and the caps from the package that owns
the bound, and have the 25 files and 10 helpers consume it — or better, make the
schemas normalise on parse (`.transform`/`.pipe`) so an out-of-range input is
corrected at the boundary rather than rejected after the fact. This converts
today's outage class from "every writer must remember" to "no writer can get it
wrong", and it is the single change that removes the largest number of latent
failures.

In the same change, rename the confusable pair. `CanvasPointPctSchema` →
`UnboundedCanvasPctPointSchema` (or `WorldPctPointSchema`) and
`CanvasPctPointSchema` → `BoardPctPointSchema`; likewise separate
`IrrigationZoneSchema` from `ZoneIrrigationSchema` (`ZoneIrrigationLineSchema`
reads correctly for the BOM line). Cost is a mechanical rename across a known
set of call sites; benefit is that the mistake becomes unspellable.

And add the generic boundary test from §4.5.1: one property test that walks the
exported schema table and asserts `min - 1` and `max + 1` are rejected for every
bounded numeric field. It is a single file, it grows automatically with
contracts, and it closes the gap that let a `.min(0).max(100)` ship with no test
in either direction.

### 6. Make a failed save say why

Evidence §3.6. Two small changes in two files: classify HTTP 400 as its own
terminal, non-retryable save-error kind, and render the response's issue path in
`SaveStatusChip`. Today a deterministic validation rejection is retried through
the full backoff ladder and then reported as an unexplained "Save failed" with a
"Retry save" button that cannot work, while the only diagnostic goes to
`console.error`.

This is ranked this high not for its blast radius but for its ratio. It is an
afternoon's work, and it converts the *entire* class of contract-validation
defects — including any that survive finding 5 — from silent operator data loss
into a self-describing error. It is the cheapest durable improvement in this
document.

### 7. Re-scope the three collapsed ratchets, and give each a floor

**Substantially delivered in the working tree during this survey — see §4.2.1.**
Reachability now scans 71 components against a floor of 60, and the CSS ratchet
now reads `.tsx` inline styles (171 files) including the z-index axis. What
remains of this finding is the third ratchet
(`check-handoff-chrome-colors`, 372 files against a recorded 637) and a
route-level gate. The original recommendation is kept below for the record.

Evidence §4.2. Point `check-feature-reachability.mjs:32` at
`apps/web/src/components/canvas` (75 components, not 9) or at
`apps/web/src/components` (123). Give `check-css-scales.mjs` an axis that can
see inline style objects, since the product surface has no CSS. And add a
**minimum-scope assertion** to each script — fail if fewer than N files or N
components are found — so the next directory rename cannot silently empty a gate
again. That single guard is what would have caught all three of these.

Add a fourth target while doing it: **app-route reachability**. The two orphaned
project pages in §7.9 are invisible to a component-export scanner, and a
route-level check (every `page.tsx` under `projects/[id]/` is linked from
somewhere, or is explicitly allowlisted) is the same shape of script.

### 8. Merge the two `no-restricted-syntax` blocks in `eslint.config.mjs`

Evidence §4.4. The canvas block at `:170-202` should extend the `apps/web/src`
selectors rather than replace them: put all eight selectors in the canvas block,
or move the four z-token selectors into a config object whose `files` glob the
canvas block does not overlap. Cheap, and it restores the ESLint-level z-index
guard on the WebGL studio.

Note that the in-flight `check-css-scales.mjs` work (§4.2.1) now covers this axis
from the ratchet side, scanning `.tsx` for raw `zIndex` and `zIndexRange`. That
reduces the urgency but not the value: a ratchet reports at commit time against a
baseline, whereas the ESLint rule fails in the editor as the line is typed. Both
are worth having, and the ratchet's own comment says it is standing in for the
shadowed rule rather than replacing it.

While there: `cfz.lint.test.ts` asserts that `eslint.config.mjs` *contains* the
selector strings (§4.4). Replace it with a scan of canvas source for the
patterns themselves, so the backstop tests the behaviour rather than the
config's text. As written it would have passed throughout the entire period the
rules were shadowed off — which is the period we are in.

### 9. Rewrite `.cursor/rules/end-of-build.mdc`

Evidence §3.4, §7.2, §7.3. This one file does three harmful things at once: it
names four e2e specs that do not exist, it cites a deleted document as the
binding reference, and it mandates `CameraChrome` — an architecture the product
surface does not use and that another binding document forbids introducing. It is
auto-injected into every session, so it is the highest-read, lowest-accuracy
artefact in the repo.

Replace the four spec names with `webgl-contrast-aa.spec.ts`,
`webgl-chrome-detector.spec.ts`, `webgl-chrome-collision.spec.ts` and
`canvas-first-z-stack.spec.ts`; replace the `CameraChrome` clause with the WebGL
rule the successor spec already encodes ("no DOM chrome inside the R3F
`<Canvas>`; chrome lives in the sibling `webgl-chrome-overlay`",
`apps/web/e2e/webgl-chrome-detector.spec.ts:8-12`); drop the
`docs/STUDIO-STYLING-AND-UX.md` reference. A mandatory gate that names deleted
files and forbidden patterns trains every reader to treat the rule as advisory,
which destroys the parts of it that are correct — and the parts that are correct
are the ones protecting the camera and contrast work.

And delete `CameraChrome.tsx`. Per §3.4.1 its portal host is never rendered, so
it returns nothing; the one consumer, `PresentSurface.tsx:890-935`, is silently
dropping the deck inspector dock. Deleting the component forces that consumer to
render its dock directly, which is both the fix and the house rule
(`CLAUDE.md`: "Don't add backwards-compatibility shims for removed code. Delete
it"). Confirm the present-mode dock in a browser first — that is the one runtime
check this survey did not run and it should gate the change.

### 10. Stamp the build

Evidence §2.3. Pass `-m` *and* a real SHA: add `BUILD_SHA=$CI_COMMIT_SHA` to the
`deploy-railway` job's variables and `--build-arg NEXT_PUBLIC_BUILD_SHA` to
`build-web-image`. Then make `apps/api/src/routes/contract.test.ts:38` assert the
value is not `"unknown"` in a deployed context. Small change; it is the
prerequisite for ever debugging a production report.

### 11. Delete or absorb `packages/ui`'s dead components; document `cad` and `client`

Evidence §1.1. Five React Native components with zero importers, and a comment in
`globals.css` claiming a unification that does not exist in code. Either make web
consume `@workstream/ui` tokens for real or delete the claim. Separately, add
`packages/cad` and `packages/client` to the architecture list in `CLAUDE.md` —
single-consumer packages that no onboarding document mentions are how a rewrite
gets proposed for code that is load-bearing.

### 12. Bring the mobile app inside the lint and test gates

Evidence §2.4, §4.3. `apps/mobile` is 43 non-test ts/tsx files and 11,594 lines,
including a 2,499-line screen (`apps/mobile/app/(app)/project/[id].tsx`), and it
is hard-ignored by ESLint (`eslint.config.mjs:15`) and excluded from vitest for
everything outside `src/components` (`vitest.config.ts:12,14`). It has no mock
data and calls the real API from 12 files — it is a real app being governed as a
prototype. Add `apps/mobile/src` to the lint roots first (the smaller half), then
the screens.

### 13. Give the bundle budget a meaningful shape

Evidence §4.2. Measure gzipped per-route first-load JavaScript, not the
uncompressed byte total of a chunk directory. For a Three.js product this is the
metric that decides whether a site visit is usable on a phone tether.

### 14. Housekeeping worth an hour

Evidence §4.6, §6.5.1. Remove the `post-checkout` hook's automatic
`git commit --no-verify` — a hook that mutates history as a side effect of
changing branches makes every other provenance question harder to answer, and it
sits directly upstream of the deploy problems in §6.3. Add ESLint to
`lint-staged.config.cjs`, which currently runs only a whole-monorepo typecheck,
so the "zero-tolerance lint gate" runs somewhere other than a developer's memory.
Delete `netlify.toml` (a tracked deploy config for the wrong platform on the
wrong Node major), `fieldloop-buildpack.zip` and its 30 tracked paths, and the
four UUID-named PNGs at the repository root.

---

## 9. What would bite next

Ordered by likelihood, not severity.

1. **Another writer producing out-of-contract geometry.** The clamp is now
   correct in 10 places and the bound is declared in 1; the arithmetic of that
   is not favourable. Finding 5 is the fix, and finding 6 is what makes the next
   occurrence a five-minute diagnosis instead of an outage.
2. **A component shipped inert in `webgl/`.** The gate written for exactly this
   bug now inspects 9 of 61 candidates (§4.2). The project has already found six
   instances of this bug class once (`OUTSTANDING.md:396-401`).
3. **A production deploy nobody can reproduce.** §6.3. The first time a
   customer-visible defect cannot be traced to a commit, this becomes the whole
   incident.
4. **A z-index regression on the canvas with no gate to catch it.** §4.4 plus
   §4.2 leaves that axis unguarded on the product surface in committed `main`.
   The in-flight ratchet work (§4.2.1) closes it at commit time; the ESLint
   shadowing (finding 8) is still open, so the editor stays silent.
5. **A stale `packages/domain/dist` producing a false test result locally.**
   §2.6. Already happened once (`WIP-GAP-SURVEY:34`); `pnpm test` alone still
   does not build dependencies.
6. **An operator losing canvas work with no recoverable explanation.** §3.6.
   Any future validation rejection reproduces today's experience exactly: a
   generic "Save failed", a retry that cannot succeed, and the reason in a
   console nobody has open.
7. **A lint failure landing on `main`.** §4.1 plus §4.6: lint runs in neither
   the pre-commit hook nor any pipeline that executes. The gate `CLAUDE.md`
   describes as zero-tolerance is currently manual.

## 10. Where this codebase is strong

Stated plainly, because an audit that only lists defects misrepresents the tree.

- **The test suite is real and fast.** 1,976 passing cases in 32 seconds, zero
  failures, and 4 deliberately env-gated live-network files. That is a genuinely
  good position.
- **Zero inline debt markers** across 1,019 source files (§1.2), and zero
  encoding defects across 1,276 tracked text files (§1.3).
- **The domain layer is honest about its placeholders.** The clamp fix at
  `packages/domain/src/structured-tools.ts:54-62` does not just fix the bug, it
  writes down why the bug was possible. `decimateOutline` caps *and* clamps
  without being told to. That standard of comment is rare and it is what made
  this analysis tractable.
- **The gate scripts are unusually self-aware.** `check-feature-reachability.mjs:20-25`
  documents its own two blind spots rather than pretending they do not exist;
  `check-css-scales.mjs:15-21` explains why it is a ratchet and not a ban. The
  problem with them is scope, not craft.
- **The contracts boundary is wide and actually used** — 300 schemas referenced
  from 284 files. The defect in §2.1 is a naming and normalisation problem
  *within* a boundary that exists and is honoured, which is a much better place
  to be than the alternative.

---

## Appendix A — measurement commands

All run from the repository root on Windows PowerShell 5.1 at commit
`1be0960c`. PowerShell 5.1 has no `&&`; sequences use `;`.

**A.1 — file and line counts by area.** Node walker skipping `node_modules`,
`.next`, `dist`, `.turbo`, `.git`, `coverage`, `.pnpm-store`, `.playwright`;
counts `.ts .tsx .js .jsx .mjs .cjs .css .md .json .yml .yaml`, line count =
`readFileSync(f,'utf8').split('\n').length`. A `Get-ChildItem` version of the
same walk fails on `apps/web/src/app/(auth)/[[...sign-in]]` because
`Get-Content` treats `[[...]]` as a wildcard; use `-LiteralPath` or Node.

**Method caveat, stated because it affects every figure in this document.**
`split('\n').length` is newline count **+ 1**, so for a newline-terminated file
it reports one more than `wc -l`. Per-file figures here are therefore 1 high, and
aggregates are high by roughly the file count (~696 across the repo, i.e. ~0.5%).
Two headline per-file numbers are given as true line counts rather than walker
output: `WebGLStudioPreview.tsx` is **2,807** and `studioStore.ts` is **1,892**.

A second caveat matters when comparing against other audit documents in this
repo. `Get-Content <file> | Measure-Object -Line` disagrees with the newline
count non-trivially — on `WebGLStudioPreview.tsx` it returns 2,720 against a true
2,807, an 87-line discrepancy — so any figure derived that way is not comparable
with any figure here. Where this document and an earlier one differ on a line
count, method is the likely cause before drift is.

**A.2 — comment-marker census.**
`Select-String -CaseSensitive -Pattern '\b(TODO|FIXME|HACK|XXX)\b'` over 1,019
`.ts/.tsx/.mjs` files under `apps`, `packages`, `scripts`, excluding
`node_modules|.next|dist|.turbo`. Case-insensitive search returns 47 false
positives; do not use it.

**A.3 — encoding scan.** Node over `git ls-files` filtered to text extensions
(1,276 files): BOM = leading `EF BB BF`; mojibake probe = any `C3 A2` byte pair;
validity = `new TextDecoder('utf-8',{fatal:true}).decode(bytes)`.

**A.4 — schema inventory and name-collision search.** Node parse of
`^export const (\w+Schema)` across `packages/contracts/src` (300 hits), then
group by the sorted lowercase word-split of each name; groups with more than one
distinct name are word-permutation collisions (2 found).

**A.5 — clamp-site census.**
`git grep -nE "Math\.max\(0,\s*Math\.min\(100|Math\.min\(100,\s*Math\.max\(0" -- apps packages`
→ 53 occurrences / 25 distinct files. `clampPct` definitions counted from
`git grep -nE "clampPct"` filtered to `(function|const)\s+clampPct` → 10.

**A.6 — the eight cheap CI gates**, each run as
`& cmd /c "node scripts/<name>.mjs 2>&1"` with `$LASTEXITCODE` captured.
`check-bundle-size` was not run — it requires a full Next.js production build.

**A.7 — reachability blind-spot measurement.** Node reimplementation of the
three `EXPORT_PATTERNS` regexes and comment-stripping from
`scripts/check-feature-reachability.mjs:60-85`, applied to four roots.

**A.8 — ESLint resolved config.**
`pnpm exec eslint --print-config <file>` for a canvas file and a non-canvas web
file, written with `[IO.File]::WriteAllText` (not `Out-File -Encoding utf8`,
which prepends a BOM on PowerShell 5.1 and breaks `JSON.parse`), then inspected
with Node.

**A.9 — vitest and API assertion census.** `pnpm exec vitest run --reporter=dot`.
Non-null assertion count from `git grep -c "!" -- apps/api/src` refined to the
postfix-`!` form and summed across files (853 / 138 files).

**A.12 — live production probe.** `Invoke-WebRequest -UseBasicParsing` against
`/healthz` and `/readyz` on `api-production-a8ff1.up.railway.app`, read-only
`GET`, no credentials sent. Responses quoted verbatim in §6.4. The inference that
`AUTH_REQUIRED` is false combines that output with
`apps/api/src/routes/health.ts:60` and the absence of `CLERK_SECRET_KEY` in the
Railway variable set.

**A.13 — git hooks and tracked-artefact hygiene.** `Get-ChildItem .husky -File`
read directly; root artefacts from
`git ls-files | Where-Object { $_ -notmatch '/' }` (42 entries).

**A.14 — route and link reachability.**
`Get-ChildItem apps/web/src/app/projects -Recurse -Filter page.tsx` (16 files);
link search from `git grep -n "href=" -- apps/web/src` filtered for `audit` and
`measurement`.

**A.10 — canvas measurements.** Per-file line counts and subdirectory rollups via
the A.1 walker scoped to `apps/web/src/components/canvas`. `getState()` call
sites from `git grep -c "getState()" -- apps/web/src/components/canvas/webgl`,
reading per-file counts and excluding `*.test.ts`/`*.test.tsx` rows by hand.
Layer line counts from `Get-ChildItem … -Filter *Layer.tsx`. Studio route
reachability from `git ls-files apps/web/src/app` plus
`git grep -n "growth-studio\|subsurface-studio"` over all tracked files.

**A.11 — deploy-watcher provenance.**
`Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'` for the
`WorkstreamAutoDeploy` entry; `Get-CimInstance Win32_Process -Filter
"Name='node.exe'"` filtered on command line for a live process;
`Test-Path` for the state file. No file contents were printed and no credential
value appears in this document.
