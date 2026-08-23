# Devin prompt — commit, push, deploy

> Paste everything below the line into Devin.

---

## Mission

`workstream` (main, clean checkout) has a dirty working tree. Commit it properly, push to `main`, and deploy to production. You have explicit authorisation to deploy in this message — this satisfies the "no deploys without explicit authorisation in the same conversation" constraint in your own `docs/design/DEVIN-PRODUCTION-BRIEF.md`.

Run `git status` and `git diff` first — don't trust this summary blindly, confirm it. As of this writing the tree has two unrelated groups of changes. Keep them as separate commits — "one commit, one revertable concern" is already the standing rule here, don't bundle them.

## Group 1 — pre-existing uncommitted changes (not from this session)

Modified, uncommitted, already in the tree before this prompt:

- `apps/web/src/components/canvas/handoff/state/useStudioState.ts`
- `apps/web/src/components/canvas/handoff/HandoffDesignStudio.tsx`
- `apps/web/src/components/canvas/handoff/handoffStudio.module.css`
- `apps/web/src/components/AppNav.tsx`
- `apps/web/src/components/QuotePortal.tsx`
- `apps/web/src/app/home.module.css`
- `apps/web/src/app/projects/[id]/project.module.css`

`docs/design/DEVIN-PRODUCTION-BRIEF.md` ("Already done — do not redo") describes at least the `useStudioState.ts` change (studio address resolution fix) and says explicitly: **"Verify this typechecks and add a regression test — it was shipped without one because the toolchain was not runnable in the authoring environment."** Do that before committing it. Check whether the other files in this group match anything else described in that brief or are further work on top of it, and write commit message(s) that describe what actually changed — don't guess, read the diffs.

## Group 2 — this session's changes

- Deleted (confirmed dead by import-graph search, nothing in the app references them): `apps/web/src/components/studio/DesignCanvasPlacement.tsx`, `GhostCursor.tsx`, `SwatchPad.tsx`, and their three `.module.css` files. `DesignAssetGlyph.tsx` in the same folder is still live and was left alone.
- Corrected in place (stale tech specifics — fonts, colors, routes, component names — fixed against the live codebase, nothing deleted): `docs/design/UIUX-DESIGNER-HANDOFF-SPEC.md`, `docs/DESIGNER-HANDOVER.md`, `docs/EXTERNAL-DESIGNER-BRIEF.md`.

This group is docs + dead-code cleanup only, no runtime behaviour change. Two commits is enough: one `chore(web):` for the deletions, one `chore(docs):` for the doc corrections.

## Before every commit

- `pnpm typecheck` and `pnpm lint` (root — covers `apps/api/src`, `apps/web/src`, `packages/domain/src`, `packages/contracts/src` at `--max-warnings 0`) must be clean.
- `pnpm test` must pass. For Group 1, also run whatever e2e specs actually exercise `HandoffDesignStudio` / the studio address flow — check `apps/web/e2e/` for the closest match rather than assuming coverage exists.
- Conventional Commits, matching the existing log style (`feat(web):`, `fix(web):`, `chore(docs):` — no new prefixes). No emojis anywhere. pnpm only, from repo root.

## Push and deploy

Push to `main`. **Deploy target is Railway, not Fly** — `CLAUDE.md` is explicit that Railway is canonical production and Fly configs are legacy-only; `DEPLOY.md`'s Fly instructions are stale, ignore them. GitHub Actions deploys both services (`workstream-api`, `workstream-web`) on push to `main` after gate + secret-scan — confirm both services redeploy (or use `railway up` CLI).

After deploy, verify both are healthy:

```bash
curl https://api-production-a8ff1.up.railway.app/healthz
curl -I https://web-production-3c194.up.railway.app/
```

Both should return 200. If either doesn't, don't leave it — diagnose and report, don't just note it and move on.

## Report back

What you committed (SHAs + messages), what you pushed, what you deployed, and the healthcheck results. If Group 1's diffs turned out to be something other than what `DEVIN-PRODUCTION-BRIEF.md` describes, say so plainly — don't silently reconcile it.
