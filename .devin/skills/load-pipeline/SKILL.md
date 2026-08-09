---
name: load-pipeline
description: Read the pipeline dock at session start. Know what's in flight, where it sits, and what to do next. Invoke this BEFORE any other work.
---

# Load pipeline dock

Invoke this skill at the **start of every session**, before any other work.

## What it does

Reads `.pipeline/dock/manifest.yaml` and presents the current state of all in-flight work to the agent. This is the relay baton — the state that persists between agents.

## Steps

1. Read `.pipeline/dock/manifest.yaml`
2. For each item, note:
   - Its `id` and `title`
   - Its `stage` (spec → coded → committed → merged → pushed → deployed → verified)
   - Its `location` (working-directory, stash@{N}, main, branch)
   - Its `patch` and `hash` — the redundant copy in the dock
   - Its `saddle.direction` and `saddle.next_action` — what to do with it
   - Its `depends_on` and `blocks` — what it's connected to
   - Its `relevance` — computed priority
3. Check if any new specs or docs have arrived since the last `updated` timestamp
4. If new specs exist, compute relevance changes:
   - Does the new spec mention or affect any existing item?
   - Does it supersede any item?
   - Does it create new dependencies?
5. Present the state to the user as a summary table
6. Do NOT flag problems. If a stash is missing, the patch in the dock is the redundant copy — use it. If a patch hash doesn't match, re-generate from the source. The system prevents loss through redundancy, not through detection.

## Output format

Present a table:

```
| Item | Stage | Location | Relevance | Next action |
|------|-------|----------|-----------|-------------|
```

Then list any relevance changes from new specs.

## Rules

- Read the manifest FIRST, before exploring the codebase or doing any work
- The manifest is the single source of truth for in-flight work
- Patches in `.pipeline/dock/patches/` are immutable redundant copies
- If work needs to be recovered, apply the patch: `git apply .pipeline/dock/patches/<name>.patch`
- Never delete patches — they are the temporal redundancy
- The saddle tells you what to do. Follow it. Don't guess.
