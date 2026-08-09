---
name: save-pipeline
description: Snapshot all in-flight work to the dock before context switch or session end. This is the relay handoff — the baton is caught before the runner lets go. Invoke this BEFORE branch switch, reset, or session end.
---

# Save pipeline dock

Invoke this skill **before any context switch**: branch checkout, git reset, session end, or when the user changes direction.

## What it does

Snapshots all uncommitted work and stashes into `.pipeline/dock/patches/` as git-tracked patch files with SHA-256 hashes. Updates the manifest with current state. Records any stage transitions. Commits the dock.

This is the moment the relay baton is caught. The work is copied into the dock before the runner lets go. Loss becomes structurally impossible because the dock is git-tracked.

## Steps

1. **Snapshot working directory:**
   ```sh
   git diff > .pipeline/dock/patches/working-directory.patch
   ```
   Compute SHA-256 hash:
   ```sh
   node -e "const c=require('crypto');const h=c.createHash('sha256');h.update(require('fs').readFileSync('.pipeline/dock/patches/working-directory.patch'));console.log(h.digest('hex'))"
   ```

2. **Snapshot all stashes:**
   For each stash in `git stash list`:
   ```sh
   git stash show -p stash@{N} > .pipeline/dock/patches/stash-N.patch
   ```
   Compute SHA-256 hash of each.

3. **Update manifest:**
   Update `.pipeline/dock/manifest.json`:
   - `updated` timestamp
   - `current_branch` (from `git branch --show-current`)
   - `main_sha` (from `git rev-parse --short main`)
   - For each item: update `stage`, `location`, `patch`, `hash`
   - Update `saddle.direction` and `saddle.next_action` based on what was done this session

4. **Record transitions:**
   If any item's stage changed during this session, record it:
   ```sh
   node .pipeline/dock/transition.mjs item-advanced --item <id> --stage <new-stage>
   ```
   The transition function will propagate relevance through the dependency graph automatically.

5. **Commit the dock:**
   ```sh
   git add .pipeline/
   git commit -m "chore(pipeline): snapshot dock state"
   ```
   This gives the dock state a git hash — temporal redundancy.

## When to invoke

- **Before branch switch** — the most common loss event. Snapshot, then switch.
- **Before git reset** — the second most common loss event. Snapshot, then reset.
- **Before session end** — so the next agent has state.
- **When user changes direction** — if the user says "let's do X instead", snapshot the current work first.

## Rules

- Patches are immutable. If work changes, write a new patch. Don't edit existing ones.
- The saddle is for the next agent. Write it as if the next agent has zero context.
- Hash every patch. The hash proves the patch hasn't been tampered with.
- Never delete patches. Even stale ones. They're the history of what was tried.
- The dock is a protected lane. Other workflows never write here. Only this skill writes here.
- Do NOT flag problems. If a stash was dropped between sessions, the patch is the redundant copy. Apply it. No detection needed — the redundancy IS the safety.
- The transition function computes relevance. Use it. Don't manually edit relevance in the manifest.
