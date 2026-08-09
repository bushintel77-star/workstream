---
name: save-pipeline
description: Snapshot all in-flight work to the dock before context switch or session end. This is the relay handoff — the baton is caught before the runner lets go. Invoke this BEFORE branch switch, reset, or session end.
---

# Save pipeline dock

Invoke this skill **before any context switch**: branch checkout, git reset, session end, or when the user changes direction.

## What it does

Snapshots all uncommitted work and stashes into `.pipeline/dock/patches/` as git-tracked patch files with SHA-256 hashes. Updates the manifest with current state and saddles. Commits the dock.

This is the moment the relay baton is caught. The work is copied into the dock before the runner lets go. Loss becomes structurally impossible because the dock is git-tracked.

## Steps

1. **Snapshot working directory**
   ```sh
   git diff > .pipeline/dock/patches/working-directory.patch
   ```
   Compute SHA-256 hash of the patch file.

2. **Snapshot all stashes**
   For each stash in `git stash list`:
   ```sh
   git stash show -p stash@{N} > .pipeline/dock/patches/stash-N.patch
   ```
   Compute SHA-256 hash of each.

3. **Update manifest**
   Update `.pipeline/dock/manifest.yaml`:
   - `updated` timestamp
   - `current_branch`
   - `main_sha`, `origin_main_sha`, `railway_api_sha` (if known)
   - For each item: update `stage`, `location`, `patch`, `hash`
   - Update `saddle.direction` and `saddle.next_action` based on what was done this session
   - Recompute `relevance` if new specs arrived

4. **Commit the dock**
   ```sh
   git add .pipeline/
   git commit -m "chore(pipeline): snapshot dock state"
   ```
   This gives the dock state a git hash — temporal redundancy. The dock's history is recoverable.

## When to invoke

- **Before branch switch** — the most common loss event. Snapshot, then switch.
- **Before git reset** — the second most common loss event. Snapshot, then reset.
- **Before session end** — so the next agent has state.
- **When user changes direction** — if the user says "let's do X instead", snapshot the current work first.

## Rules

- Patches are immutable. If work changes, write a new patch. Don't edit existing ones. That's temporal redundancy — you can always see what the work was at any point in time.
- The saddle is for the next agent. Write it as if the next agent has zero context. Because they don't.
- Hash every patch. The hash proves the patch hasn't been tampered with. If a patch is regenerated, it gets a new hash and the manifest is updated.
- Never delete patches. Even stale ones. They're the history of what was tried.
- The dock is a protected lane. Other workflows (main, feature branches) never write here. Only this skill writes here.
- Do NOT flag problems. If a stash was dropped between sessions, the patch is the redundant copy. Apply it. No detection needed — the redundancy IS the safety.
