# The Pipeline Dock — Start to End

## The problem

A solo developer uses AI coding agents (Devin, Claude Code, Cursor) across multiple sessions on a single git repository. Work exists in three states: uncommitted in the working directory, stashed via `git stash`, or committed to branches. The core failure mode is loss of uncommitted work at context switches — branch checkout, reset, session end — because the agent has no memory between sessions and git's stash stack is fragile, unlabeled, and prone to drift.

The developer was losing updates. Not because git is broken, but because git's mechanisms for preserving uncommitted work (stash, branches) are manual, unlabeled, and depend on the developer remembering to use them. AI agents don't remember. Every session starts from zero. Every context switch is a potential loss event.

## The investigation

An audit of the repository revealed:
- 14 files with 623 insertions uncommitted in the working directory
- 9 stashes, 3 containing significant unique work not on main
- 28 branches, most stale
- Railway live deploy 5 commits behind main
- Work for §4.7 of the design spec split across the working directory (domain logic) and stash@{2} (UI + supplier rate-sheets)

The work wasn't lost yet, but it was scattered across multiple fragile holding areas with no metadata, no dependency tracking, and no automatic preservation.

## The analogies

The developer brought a series of analogies from mechanical engineering and cryptography. Each one tested a different aspect of the system before it was built.

### The parallelogram linkage (derailleur)

The closest analogy. A parallelogram linkage has four bars connected in a rectangle. When you push one side, the opposite side moves parallel to it, maintaining its orientation. The cage moves without rotating. The chain guide stays aligned with the cogs regardless of where the linkage sits.

The dock is the cage. The designer's intent moves wildly — "do accessibility" then "do irrigation" then "check the elevation wiring." The dock absorbs that lateral motion (snapshots the current work, writes a new saddle) without rotating the existing work. The patch doesn't change. The hash doesn't change. The dependencies don't change. The work stays oriented the way it was.

The return spring: when the designer stops working on something and comes back later, the saddle is still there, pointing at the same direction. The work hasn't drifted. The system returns to exactly where it was.

The limit screws: the CI gate (typecheck, lint, test) prevents the chain from moving past them. The chain can't merge to main without passing CI.

### The Markov chain

The developer's first concept: "it's a little bit like the Markov chain where two things are interdependent, nothing exists on its own and you have a state and then the probability changes so its relevance changes."

Three properties: interdependency (nothing exists alone), state (each item has a current state), probability shifts (when something changes, the relevance of interdependent items changes with it).

This became the transition function. When `supplier-rate-sheet-loading` is abandoned, `irrigation-edit-loop-domain` and `irrigation-edit-loop-ui` both automatically jump to `critical` through the dependency graph. The relevance propagates. The next state is a function of the current state and the transition event, not of history.

### The verification layer (LayerEdge / ZK proofs)

The structural pattern: a downstream system that trusts unverified inputs will propagate lies as truth. In ZK proof systems, the verification layer normalizes and checks proofs before admitting them. In the dock, the verification layer checks stage claims against git reality before accepting them.

The specific concept that mapped: the under-constrained circuit. A circuit is under-constrained when the polynomial equations fail to uniquely determine the output. The dock's transition function was under-constrained — it accepted "merged" claims without checking if the work was actually on main. The developer proved this in 30 seconds by claiming a false merge and watching the system accept it.

The fix: the Simplex decision module. Intercept the claim, check it against git ground truth, refuse if false.

### Cross-chain technology

Weaker fit at solo scale, real at team scale. The light client pattern maps (verify specific claims without full state), but the core problem cross-chain solves — trustless interoperation between independent consensus systems — doesn't exist when there's one developer and one git repo. If the team grew, the dock would need cross-chain-like mechanisms: light client verification of other developers' claims, finality handling for cross-developer dependencies, and GitHub as the relayer delivering state changes between local docks.

## The research

A targeted research prompt was issued — five logical mechanisms described without naming the industry or application, allowing cross-domain prior art to emerge organically. The research returned a paper covering:

1. **Empirical verification** — Simplex Architecture (cyber-physical control), ABRV (runtime verification), LogicGuard/AgentVerify (LLM agent guardrails). The Simplex pattern: an untrusted complex controller proposes state transitions, a verified decision module intercepts and checks against ground truth, refusing if the claim contradicts reality.

2. **Dynamic DAG propagation** — Adapton (incremental computation over dependency DAGs where state transitions propagate through edges and halt when output doesn't change), Belief Propagation in Bayesian Networks (Markov property: next state depends only on current state and the event).

3. **Structured transient snapshots** — Content-addressable storage with metadata-annotated snapshots independent of the primary commit graph. The "shadow graph" pattern: a clean, validated primary graph with a separate, hash-addressed shadow graph for transient work.

4. **Structured state handoff** — Terraform's `terraform.tfstate` paradigm: a persistent structured file as the absolute ground truth for a sequential process. Each execution reads the file, does work, updates the file, terminates. The next execution reads the updated file. No resident memory, no heuristic retrieval.

5. **Automatic boundary capture** — Durable execution platforms (Temporal, Restate, Inngest) that intercept the event loop boundary (await/yield) and automatically serialize state before the thread yields. The capture happens because the boundary fires, not because an operator remembered to save.

Each mechanism exists independently in its own field. No single system combines all five. The dock's novelty is the composition.

## The architecture

### The dock directory

```
.pipeline/dock/
  manifest.json          ← single source of truth (JSON)
  transition.mjs         ← Markov transition function + verification layer
  convert.cjs            ← YAML-to-JSON converter (kept for reference)
  patches/               ← immutable content-hashed snapshots
    working-directory.patch
    stash-0.patch through stash-8.patch
```

### The manifest

A JSON file structured like a Terraform state file. It contains:

- **Schema metadata**: version, timestamp, current branch, main SHA, origin SHA, Railway SHA
- **Items**: each work item has an ID, title, spec reference, stage, location, patch path, SHA-256 hash, file list, dependency graph (`depends_on`, `blocks`), a saddle (direction, next action, context), and a relevance level
- **Stale entries**: patches preserved for reference but superseded
- **Transition history**: last 50 transition events with timestamps and changes

Stages: `spec → coded → committed → merged → pushed → deployed → verified`

Relevance levels: `zero → low → medium → high → critical`

### The saddle

Each item has a saddle — structured metadata for the next agent. It contains:
- **direction**: what to do with this item
- **next_action**: the specific command or operation to perform
- **context**: what was done, what exists, what the next agent needs to know

The saddle is the relay baton. It's written as if the next agent has zero context.

### The patch

Each item's work is preserved as a git patch file with a SHA-256 hash. Patches are immutable — if work changes, a new patch is written. Patches are never deleted, even when stale. They are the temporal redundancy: every state is copied and git-tracked, making loss impossible because the dock is a protected lane that other workflows don't touch.

### The transition function

`transition.mjs` is the Markov transition matrix as executable code. Five event types:

- `item-advanced --item <id> --stage <stage>` — item moves forward, relevance propagates through the graph
- `item-regressed --item <id> --stage <stage>` — item moves backward, dependents become at risk
- `item-abandoned --item <id>` — item dropped, dependents become critical, blocked items freed
- `new-spec --spec <path> --affects <id1,id2>` — new spec arrives, affected items and neighbors recompute
- `status` — read-only: print table, detect relevance drift, run verification layer

Transition rules implement the Markov property:
- If item A blocks item B and A reaches merged, B is unblocked (relevance rises)
- If item A depends on item B and B regresses, A is at risk (relevance rises)
- If item A is abandoned, items that depend on A become critical
- If a new spec references item A, A and its graph neighbors recompute
- If all dependencies of an item are committed, the item becomes critical (ready to proceed)

### The verification layer

The Simplex decision module. When `item-advanced` is proposed, the verification layer intercepts the claim and checks it against git ground truth before admitting it:

| Stage claim | Verification check | How |
|---|---|---|
| `coded` | Files appear in working directory diff | `git diff --name-only` |
| `committed` | A branch exists with changes to the item's files | `git branch --list` + `git log --name-only` |
| `merged` | Files are NOT in working directory diff + commit on main | `git diff --name-only` + `git log main` |
| `pushed` | main is not ahead of origin | `git rev-list --count origin/main..main` |
| `deployed` | Railway API SHA matches main SHA | compare manifest fields |
| `verified` | Out of scope (needs HTTP probe) | warns but admits |

If verification fails, the event is refused with exit code 1. The manifest is NOT updated. The transition is NOT applied. This prevents the under-constrained circuit problem — false claims cannot propagate through the system.

The `status` command also runs drift detection on all items at `committed` or beyond, checking their claims against current git state.

### The git hook

`post-checkout` fires after every `git checkout`. It:
1. Records the context switch in the dock's transition history
2. Snapshots any uncommitted changes that carried over to the new branch
3. Updates the manifest's `current_branch` field
4. Commits the dock state

Limitation: git has no `pre-checkout` or `pre-reset` hook. The hook fires after the checkout, not before. For destructive operations (`git reset --hard`, `git stash drop`), the agent must invoke `save-pipeline` before the operation. The hook handles the most common case (branch switching) automatically.

### The skills

Two Devin skills manage the dock:

**`load-pipeline`** — invoked at session start:
1. Runs `node .pipeline/dock/transition.mjs status`
2. Reads the manifest for saddle details on critical/high items
3. Checks for relevance drift and new specs
4. Presents state to the user
5. Follows the saddles

**`save-pipeline`** — invoked before context switch or session end:
1. Snapshots working directory to patch
2. Snapshots all stashes to patches
3. Computes SHA-256 hashes
4. Updates manifest with current state
5. Records any stage transitions via `transition.mjs`
6. Commits the dock

## The five mechanisms mapped to prior art

| Mechanism | Prior art | Field | Dock implementation |
|---|---|---|---|
| Empirical verification | Simplex Architecture, ABRV | Cyber-physical control | Verification layer in transition.mjs |
| DAG relevance propagation | Adapton, Bayesian Networks | Incremental computation | Transition rules in transition.mjs |
| Structured transient snapshots | Content-addressable storage, G-CCACS | Distributed systems | Patches with SHA-256 hashes |
| Structured state handoff | Terraform tfstate | Infrastructure as Code | manifest.json |
| Automatic boundary capture | Temporal, Restate, Inngest | Durable execution | post-checkout git hook |

No single existing system combines all five. The dock's novelty is the composition of these five mechanisms from five different fields into a single system for AI-agent-driven software development.

## How to use it

### At session start
```sh
node .pipeline/dock/transition.mjs status
```
Read the table. Follow the saddles for anything at `critical` or `high`.

### When something changes state
```sh
node .pipeline/dock/transition.mjs item-advanced --item <id> --stage <stage>
node .pipeline/dock/transition.mjs item-abandoned --item <id>
node .pipeline/dock/transition.mjs new-spec --spec <path> --affects <id1,id2>
```
The verification layer checks the claim against git before admitting it. Relevance propagates through the dependency graph automatically.

### Before context switch or session end
```sh
git diff > .pipeline/dock/patches/working-directory.patch
git add .pipeline/
git commit -m "chore(pipeline): snapshot dock state"
```
Or invoke the `save-pipeline` skill, which does this automatically.

### If a patch needs to be recovered
```sh
git apply .pipeline/dock/patches/stash-2.patch
```
The patch is the redundant copy. The stash doesn't need to exist.

### The post-checkout hook fires automatically
No action needed when switching branches. It records the switch and snapshots carried-over changes.

## What was tested

1. **Transition function — item-advanced**: advanced `irrigation-edit-loop-domain` to `committed`. Stage updated, location updated to `branch`. No relevance changes because dependencies weren't ready. Correct.

2. **Transition function — item-advanced (chain reaction)**: advanced `supplier-rate-sheet-loading` to `committed` after domain was already committed. Both dependencies now ready for the UI. UI was already at `critical` so no visible change. Correct.

3. **Transition function — new-spec**: new spec §4.10 arriving, affecting irrigation items. Both items pushed to `critical` with propagation to graph neighbors. Correct.

4. **Transition function — item-abandoned**: abandoned `supplier-rate-sheet-loading`. Both dependents jumped to `critical`. The abandoned item dropped to `zero`. Relevance propagated through the dependency graph automatically. Correct.

5. **Verification layer — false merge claim**: attempted to advance `irrigation-edit-loop-domain` to `merged` without actually merging. Verification layer caught that the files still had uncommitted changes in the working directory. Event refused with exit code 1. Manifest NOT updated. Correct.

6. **Verification layer — false push claim**: attempted to advance `hero-overlay-polish` to `pushed`. Verification layer caught that main was 4 commits ahead of origin. Event refused. Correct.

7. **Verification layer — status drift detection**: ran `status` on a clean manifest. All three `merged` items passed verification (files not in working directory diff, commits on main). "All claims match git reality." Correct.

## What is genuinely novel

Each individual mechanism has prior art in its own field. The novelty is the composition:

- **Terraform** has the state handoff (mechanism 4) but not verification against external reality (mechanism 1), transient snapshots (mechanism 3), or automatic boundary capture (mechanism 5).
- **Temporal** has automatic boundary capture (mechanism 5) but not DAG relevance propagation (mechanism 2) or structured transient snapshots (mechanism 3).
- **Adapton** has DAG propagation (mechanism 2) but not state handoff (mechanism 4) or boundary capture (mechanism 5).
- **Simplex** has empirical verification (mechanism 1) but not any of the other four.
- **Merget** has automatic commits and prompt tracking but operates post-commit, destroying the pre-commit creative space that the dock preserves.

The dock is a Terraform state file for uncommitted software work, with Simplex verification, Adapton-style propagation, content-hashed snapshots, and durable-execution-style boundary capture. That composition does not exist in any other system.

## Commits

```
774a2b (uncommitted) fix(pipeline): manually clean direction field artifacts in manifest
47d391f chore(pipeline): remove manifest.yaml — JSON is single source of truth
8749e63 fix(pipeline): correct direction field offset in YAML converter
dbdfcf7 feat(pipeline): add verification layer — Simplex decision module
c0782fc fix(pipeline): restore manifest to true state + add YAML-to-JSON converter
3cddf32 feat(pipeline): add transition function — Markov relevance computation
dea0aac chore(pipeline): add relay dock for cross-session state continuity
```

## Current state

Three items at `critical`, all uncommitted:
- `irrigation-edit-loop-domain` (working directory) — §4.7 domain logic + tests, 346 lines
- `irrigation-edit-loop-ui` (stash@{2}) — §4.7 UI, 327 lines
- `supplier-rate-sheet-loading` (stash@{2}) — honest pricing, 230 lines

Two items flagged for relevance drift (should be `critical`, currently lower):
- `a11y-pass` (working directory) — P1-P3 accessibility items, 12 files
- `elevation-mode-wiring` (stash@{0}) — elevation URL sync, ~69 lines

Three items at `merged` on main, not deployed:
- `hero-overlay-polish` — §4.8
- `shadow-ledger` — §4.4
- `freeze-snapshot` — §4.5 (partial)

One item at `spec`:
- `branch-tree` — §4.5 variation explorer, not started

Verification layer confirms: all claims match git reality.
