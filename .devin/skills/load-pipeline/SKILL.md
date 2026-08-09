---
name: load-pipeline
description: Read the pipeline dock at session start. Know what's in flight, where it sits, and what to do next. Invoke this BEFORE any other work.
---

# Load pipeline dock

Invoke this skill at the **start of every session**, before any other work.

## What it does

Reads the pipeline dock and presents the current state of all in-flight work. Runs the transition function's `status` command to detect relevance drift. This is the relay baton — the state that persists between agents.

## Steps

1. **Run the status command:**
   ```sh
   node .pipeline/dock/transition.mjs status
   ```
   This reads `.pipeline/dock/manifest.json`, computes current relevance consistency, and prints a table sorted by relevance (critical first).

2. **Read the manifest for saddle details:**
   Read `.pipeline/dock/manifest.json`. For each item at `critical` or `high` relevance, note:
   - Its `saddle.direction` and `saddle.next_action` — what to do with it
   - Its `depends_on` and `blocks` — what it's connected to
   - Its `location` and `patch` — where the work physically is

3. **Check for relevance drift:**
   The `status` command reports items whose relevance is inconsistent with the dependency graph. If drift is detected, apply the suggested corrections:
   ```sh
   node .pipeline/dock/transition.mjs item-advanced --item <id> --stage <stage>
   ```
   for any items that have advanced since the last session.

4. **Check for new specs:**
   If the user mentions a new design spec or document, compute which items it affects:
   ```sh
   node .pipeline/dock/transition.mjs new-spec --spec <path> --affects <item-id,item-id,...>
   ```
   This propagates relevance through the dependency graph.

5. **Present the state to the user:**
   Show the table from step 1. Highlight items at `critical` relevance. Summarize what's at risk and what's ready to proceed.

6. **Follow the saddles:**
   The saddle tells you what to do. Follow it. Don't guess. The saddle is the craftsman's notes left open on the workbench.

## Rules

- Run `node .pipeline/dock/transition.mjs status` FIRST, before exploring the codebase
- The manifest is the single source of truth for in-flight work
- Patches in `.pipeline/dock/patches/` are immutable redundant copies
- If work needs to be recovered, apply the patch: `git apply .pipeline/dock/patches/<name>.patch`
- Never delete patches — they are the temporal redundancy
- The saddle tells you what to do. Follow it.
- Do NOT flag problems. The system prevents loss through redundancy, not detection.
- If a stash is gone, the patch is the redundant copy. Use it.
- The transition function computes relevance through the dependency graph. Trust it.
