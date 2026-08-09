#!/usr/bin/env node
/**
 * Pipeline dock transition function — the Markov transition matrix.
 *
 * The state of the system is the manifest. Every item has a stage and a set
 * of dependencies. When a transition occurs (new spec, item merged, item
 * abandoned, new work), relevance of every interdependent item recomputes
 * through the dependency graph.
 *
 * Usage:
 *   node transition.mjs <event> [options]
 *
 * Events:
 *   new-spec      --spec <path> --affects <item-id,item-id,...>
 *   item-advanced --item <item-id> --stage <new-stage>
 *   item-regressed --item <item-id> --stage <new-stage>
 *   item-abandoned --item <item-id>
 *   new-item      --item <item-id> (adds a placeholder, agent fills details)
 *   status        (read-only: compute and print current relevance without writing)
 *
 * The transition rules are the Markov property:
 *   next_state = f(current_state, transition_event)
 *
 * Nothing depends on history. Only the current state and the event matter.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = resolve(__dirname, "manifest.json");
const REPO_ROOT = resolve(__dirname, "..", "..");

// ─── Git helpers ─────────────────────────────────────────────────
function git(args, opts = {}) {
  try {
    return execSync(`git ${args}`, {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      ...opts,
    }).trim();
  } catch {
    return null;
  }
}

function gitLines(args) {
  const out = git(args);
  if (!out) return [];
  return out.split("\n").filter(Boolean);
}

// ─── Relevance levels (ordered) ──────────────────────────────────
const LEVELS = ["zero", "low", "medium", "high", "critical"];
const levelIndex = (l) => LEVELS.indexOf(l);
const clampLevel = (l) => LEVELS[Math.max(0, Math.min(LEVELS.length - 1, l))];

// ─── Stage ordering ──────────────────────────────────────────────
const STAGES = ["spec", "coded", "committed", "merged", "pushed", "deployed", "verified"];
const stageIndex = (s) => STAGES.indexOf(s);

// ─── Verification layer (Simplex decision module) ────────────────
// Intercepts stage transition claims and checks them against git
// ground truth before admitting them. If the claim contradicts
// reality, the event is refused.
//
// This is the miter circuit: compare manifest claim vs git reality.
// This is the Simplex decision module: intercept, verify, refuse if false.
// This is the inductive invariant: merged items must be on main.

function verifyStageClaim(item, newStage, manifest) {
  const errors = [];
  const warnings = [];

  // coded: files should exist in working directory or stash
  if (newStage === "coded") {
    if (item.location === "working-directory") {
      const dirtyFiles = gitLines("diff --name-only");
      const stashFiles = gitLines("stash list --format=%gd");
      // Check if any of the item's files are in the working directory diff
      const found = (item.files || []).some((f) => dirtyFiles.includes(f));
      if (!found && dirtyFiles.length > 0) {
        warnings.push(`Item claims working-directory but none of its files appear in git diff --name-only`);
      }
    }
    // For stash locations, we can't easily verify which stash without more info
    // This is a soft check — we warn but don't block
  }

  // committed: a branch should exist with these files changed
  if (newStage === "committed") {
    const branches = gitLines("branch --list");
    // Check if any branch contains changes to the item's files
    const itemFiles = item.files || [];
    let foundOnBranch = false;
    for (const branch of branches) {
      const cleanBranch = branch.replace(/^\*?\s+/, "").trim();
      if (!cleanBranch || cleanBranch === "main") continue;
      const branchFiles = gitLines(`log --name-only --format="" ${cleanBranch} --not main`);
      if (itemFiles.some((f) => branchFiles.includes(f))) {
        foundOnBranch = true;
        break;
      }
    }
    if (!foundOnBranch) {
      errors.push(`No branch found with changes to this item's files. Cannot claim committed.`);
    }
  }

  // merged: the work must actually be on main
  if (newStage === "merged") {
    const itemFiles = item.files || [];
    const dirtyFiles = gitLines("diff --name-only");
    const dirtyStagedFiles = gitLines("diff --cached --name-only");

    // If the item's files still appear in the working directory diff,
    // the uncommitted changes are still there — they can't be merged
    const stillDirty = itemFiles.filter(
      (f) => dirtyFiles.includes(f) || dirtyStagedFiles.includes(f),
    );

    if (stillDirty.length > 0) {
      errors.push(
        `Files still have uncommitted changes in working directory: ${stillDirty.join(", ")}. ` +
        `Cannot claim merged — these changes are not on main.`,
      );
    }

    // Also check: if the item has a main_commit, verify it's on main
    if (item.main_commit && stillDirty.length === 0) {
      const mainLog = gitLines("log main --oneline");
      const foundOnMain = mainLog.some((line) => line.includes(item.main_commit));
      if (!foundOnMain) {
        // The files aren't dirty but the specific commit isn't on main.
        // Could be a squash merge — check if the files exist on main at all
        const filesOnMain = gitLines(`ls-tree main --name-only`);
        // This is a weak check — just because the file exists doesn't mean
        // the specific changes are merged. But if the file isn't dirty AND
        // exists on main, the changes might have been squash-merged.
        warnings.push(
          `main_commit ${item.main_commit} not found in git log main, ` +
          `but files are not dirty. May have been squash-merged — verify manually.`,
        );
      }
    }
  }

  // pushed: main must not be ahead of origin/main
  if (newStage === "pushed") {
    const ahead = git("rev-list --count origin/main..main");
    if (ahead !== "0") {
      errors.push(`main is ${ahead} commits ahead of origin/main. Cannot claim pushed.`);
    }
  }

  // deployed: Railway live SHA must match main
  if (newStage === "deployed") {
    const mainSha = git("rev-parse --short main");
    const railwaySha = manifest.railway_api_sha;
    if (railwaySha && railwaySha !== "unknown" && mainSha && mainSha !== railwaySha) {
      errors.push(`Railway API SHA (${railwaySha}) does not match main (${mainSha}). Cannot claim deployed.`);
    }
    if (!railwaySha || railwaySha === "unknown") {
      warnings.push(`Railway API SHA is unknown — cannot verify deployment. Admitting with warning.`);
    }
  }

  // verified: would require a live HTTP probe — out of scope for this function
  if (newStage === "verified") {
    warnings.push(`Verified stage requires a live HTTP probe. Verification layer cannot check this automatically.`);
  }

  return { errors, warnings };
}

// ─── Verify all items against current git state (drift detection) ─
function verifyAllItems(manifest) {
  const drift = [];
  for (const item of manifest.items) {
    if (stageIndex(item.stage) >= stageIndex("committed")) {
      const { errors } = verifyStageClaim(item, item.stage, manifest);
      if (errors.length > 0) {
        drift.push({ itemId: item.id, stage: item.stage, errors });
      }
    }
  }
  return drift;
}

// ─── Transition rules ────────────────────────────────────────────
// Each rule takes the manifest, the event, and returns a list of
// { itemId, newRelevance, reason } changes to apply.

function transitionRules(manifest, event) {
  const changes = [];
  const items = manifest.items;
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));

  // Rule 1: item advances → unblock things it blocks
  if (event.type === "item-advanced") {
    const item = byId[event.itemId];
    if (!item) return changes;

    const newStageIdx = stageIndex(event.newStage);
    const oldStageIdx = stageIndex(item.stage);
    const effectiveStage = event.newStage; // use the new stage for all checks

    // If the item reached merged or beyond, things it blocks are unblocked
    if (newStageIdx >= stageIndex("merged")) {
      for (const blockedId of item.blocks || []) {
        const blocked = byId[blockedId];
        if (!blocked) continue;
        if (levelIndex(blocked.relevance) < levelIndex("high")) {
          changes.push({
            itemId: blockedId,
            newRelevance: "high",
            reason: `Unblocked: ${item.id} reached ${event.newStage}`,
          });
        }
      }
    }

    // If the item reached verified, it's done — relevance drops to zero
    if (newStageIdx >= stageIndex("verified")) {
      changes.push({
        itemId: item.id,
        newRelevance: "zero",
        reason: `Completed: reached verified stage`,
      });
    }

    // If the item reached merged, its own relevance drops (no longer at risk)
    if (newStageIdx >= stageIndex("merged") && newStageIdx < stageIndex("verified")) {
      changes.push({
        itemId: item.id,
        newRelevance: "low",
        reason: `Merged: no longer at risk of loss`,
      });
    }

    // If the item advanced to committed, things it blocks can check if all their deps are ready
    if (newStageIdx >= stageIndex("committed") && oldStageIdx < stageIndex("committed")) {
      for (const blockedId of item.blocks || []) {
        const blocked = byId[blockedId];
        if (!blocked) continue;
        // Check if all dependencies of the blocked item are now committed or beyond
        // (the item being advanced counts as committed now)
        const allDepsReady = (blocked.depends_on || []).every((d) => {
          if (d === item.id) return newStageIdx >= stageIndex("committed");
          return stageIndex(byId[d]?.stage ?? "spec") >= stageIndex("committed");
        });
        if (allDepsReady && levelIndex(blocked.relevance) < levelIndex("critical")) {
          changes.push({
            itemId: blockedId,
            newRelevance: "critical",
            reason: `All dependencies committed — ready to proceed`,
          });
        }
      }
    }
  }

  // Rule 2: item regresses → things that depend on it are at risk
  if (event.type === "item-regressed") {
    const item = byId[event.itemId];
    if (!item) return changes;

    for (const depId of item.blocks || []) {
      const dep = byId[depId];
      if (!dep) continue;
      changes.push({
        itemId: depId,
        newRelevance: clampLevel(levelIndex(dep.relevance) + 1),
        reason: `At risk: ${item.id} regressed to ${event.newStage}`,
      });
    }
    // The item itself becomes more relevant (needs attention)
    changes.push({
      itemId: item.id,
      newRelevance: "critical",
      reason: `Regressed to ${event.newStage} — needs attention`,
    });
  }

  // Rule 3: item abandoned → dependents are at risk, blocked items are freed
  if (event.type === "item-abandoned") {
    const item = byId[event.itemId];
    if (!item) return changes;

    // Things that depend on this item are now at risk
    for (const depId of item.blocks || []) {
      const dep = byId[depId];
      if (!dep) continue;
      changes.push({
        itemId: depId,
        newRelevance: "critical",
        reason: `Dependency ${item.id} abandoned — re-evaluate`,
      });
    }
    // Things this item blocks are no longer blocked
    for (const blockedId of item.depends_on || []) {
      const blocked = byId[blockedId];
      if (!blocked) continue;
      // Check if other blockers still exist
      const otherBlockers = (blocked.blocks || []).filter((b) => b !== item.id);
      if (otherBlockers.length === 0) {
        changes.push({
          itemId: blockedId,
          newRelevance: clampLevel(levelIndex(blocked.relevance) - 1),
          reason: `Blocker ${item.id} abandoned — less constrained`,
        });
      }
    }
    // The abandoned item itself drops to zero
    changes.push({
      itemId: item.id,
      newRelevance: "zero",
      reason: "Abandoned",
    });
  }

  // Rule 4: new spec arrives → items it references become more relevant
  if (event.type === "new-spec") {
    const affectedIds = event.affects || [];
    for (const id of affectedIds) {
      const item = byId[id];
      if (!item) continue;
      changes.push({
        itemId: id,
        newRelevance: "critical",
        reason: `New spec ${event.spec} directly references this item`,
      });
      // Propagate to dependents
      for (const depId of item.blocks || []) {
        const dep = byId[depId];
        if (!dep) continue;
        if (levelIndex(dep.relevance) < levelIndex("high")) {
          changes.push({
            itemId: depId,
            newRelevance: "high",
            reason: `Upstream ${id} affected by new spec`,
          });
        }
      }
      // Propagate to dependencies
      for (const depId of item.depends_on || []) {
        const dep = byId[depId];
        if (!dep) continue;
        if (levelIndex(dep.relevance) < levelIndex("high")) {
          changes.push({
            itemId: depId,
            newRelevance: "high",
            reason: `Downstream ${id} affected by new spec — may need this`,
          });
        }
      }
    }
  }

  // Rule 5: new item added → inherits relevance from what it depends on
  if (event.type === "new-item") {
    // The agent will fill in details; just flag it as needing attention
    changes.push({
      itemId: event.itemId,
      newRelevance: "medium",
      reason: "New item — awaiting saddle details",
    });
  }

  // Deduplicate: if multiple changes target the same item, keep the highest
  const merged = {};
  for (const c of changes) {
    if (!merged[c.itemId] || levelIndex(c.newRelevance) > levelIndex(merged[c.itemId].newRelevance)) {
      merged[c.itemId] = c;
    }
  }
  return Object.values(merged);
}

// ─── Apply changes to manifest ───────────────────────────────────
function applyChanges(manifest, changes, event) {
  const byId = Object.fromEntries(manifest.items.map((i) => [i.id, i]));

  // First: update the item's own stage if this is an advancement/regression
  if (event && (event.type === "item-advanced" || event.type === "item-regressed")) {
    const item = byId[event.itemId];
    if (item && event.newStage) {
      item.stage = event.newStage;
      // Also update location based on stage
      if (event.newStage === "committed") item.location = "branch";
      else if (event.newStage === "merged") item.location = "main";
      else if (event.newStage === "pushed") item.location = "origin";
      else if (event.newStage === "deployed") item.location = "railway";
      else if (event.newStage === "verified") item.location = "live";
    }
  }

  // Then: apply relevance changes
  for (const c of changes) {
    const item = byId[c.itemId];
    if (item) {
      item.relevance = c.newRelevance;
    }
  }

  // Record the transition in history
  manifest.transitions = manifest.transitions || [];
  manifest.transitions.push({
    timestamp: new Date().toISOString(),
    event: event.type,
    itemId: event.itemId || null,
    changes,
  });
  // Keep only last 50 transitions
  if (manifest.transitions.length > 50) {
    manifest.transitions = manifest.transitions.slice(-50);
  }
  manifest.updated = new Date().toISOString();
  return manifest;
}

// ─── Status: compute current relevance without writing ───────────
function computeStatus(manifest) {
  const items = manifest.items;
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));

  // For each item, check if its relevance is consistent with the graph
  const notes = [];
  for (const item of items) {
    // If all dependencies are merged/verified and this item is still coded,
    // it should be critical (ready to proceed)
    const depsReady = (item.depends_on || []).every(
      (d) => stageIndex(byId[d]?.stage ?? "spec") >= stageIndex("merged"),
    );
    if (depsReady && item.stage === "coded" && levelIndex(item.relevance) < levelIndex("critical")) {
      notes.push({
        itemId: item.id,
        suggested: "critical",
        reason: "All dependencies merged — ready to proceed",
      });
    }

    // If item is verified, relevance should be zero
    if (stageIndex(item.stage) >= stageIndex("verified") && item.relevance !== "zero") {
      notes.push({
        itemId: item.id,
        suggested: "zero",
        reason: "Already verified — no longer relevant",
      });
    }

    // If item is merged but not deployed, relevance should be low
    if (item.stage === "merged" && item.relevance !== "low") {
      notes.push({
        itemId: item.id,
        suggested: "low",
        reason: "Merged but not deployed — waiting on Railway",
      });
    }
  }
  return notes;
}

// ─── CLI ─────────────────────────────────────────────────────────
function parseArgs(argv) {
  const [event, ...rest] = argv;
  const opts = {};
  for (let i = 0; i < rest.length; i++) {
    if (rest[i].startsWith("--")) {
      const key = rest[i].slice(2);
      const val = rest[i + 1];
      if (val && !val.startsWith("--")) {
        opts[key] = val;
        i++;
      } else {
        opts[key] = true;
      }
    }
  }
  return { event, opts };
}

function printTable(manifest) {
  const items = manifest.items;
  // Sort by relevance (critical first)
  const sorted = [...items].sort(
    (a, b) => levelIndex(b.relevance) - levelIndex(a.relevance),
  );
  console.log("\n┌────────────────────────────────────┬───────────┬────────────────────┬───────────┐");
  console.log("│ Item                               │ Stage     │ Location           │ Relevance │");
  console.log("├────────────────────────────────────┼───────────┼────────────────────┼───────────┤");
  for (const item of sorted) {
    const id = item.id.padEnd(34).slice(0, 34);
    const stage = item.stage.padEnd(9).slice(0, 9);
    const loc = (item.location || "none").padEnd(18).slice(0, 18);
    const rel = item.relevance.padEnd(9).slice(0, 9);
    console.log(`│ ${id} │ ${stage} │ ${loc} │ ${rel} │`);
  }
  console.log("└────────────────────────────────────┴───────────┴────────────────────┴───────────┘");
}

function main() {
  const { event, opts } = parseArgs(process.argv.slice(2));

  if (!event) {
    console.error("Usage: node transition.mjs <event> [options]");
    console.error("Events: new-spec, item-advanced, item-regressed, item-abandoned, new-item, status");
    process.exit(1);
  }

  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));

  // Status: read-only computation
  if (event === "status") {
    printTable(manifest);
    const notes = computeStatus(manifest);
    if (notes.length > 0) {
      console.log("\nRelevance drift detected:");
      for (const n of notes) {
        console.log(`  ${n.itemId}: ${n.reason} → suggest ${n.suggested}`);
      }
    } else {
      console.log("\nRelevance is consistent with dependency graph.");
    }
    // Also run verification layer — check all committed+ items against git
    const drift = verifyAllItems(manifest);
    if (drift.length > 0) {
      console.log("\nVerification layer — manifest/git drift:");
      for (const d of drift) {
        console.log(`  ${d.itemId} (claims ${d.stage}):`);
        for (const e of d.errors) {
          console.log(`    ✗ ${e}`);
        }
      }
    } else {
      console.log("Verification layer — all claims match git reality.");
    }
    return;
  }

  // Build the event object
  const evt = { type: event };
  if (event === "new-spec") {
    evt.spec = opts.spec;
    evt.affects = (opts.affects || "").split(",").filter(Boolean);
  } else if (event === "item-advanced" || event === "item-regressed") {
    evt.itemId = opts.item;
    evt.newStage = opts.stage;
  } else if (event === "item-abandoned" || event === "new-item") {
    evt.itemId = opts.item;
  }

  if (!evt.itemId && !evt.spec && event !== "status") {
    console.error(`Missing required options for event "${event}"`);
    process.exit(1);
  }

  // ─── Verification layer: intercept and verify before admitting ──
  if (event === "item-advanced" || event === "item-regressed") {
    const item = manifest.items.find((i) => i.id === evt.itemId);
    if (!item) {
      console.error(`Verification: item "${evt.itemId}" not found in manifest. Refusing.`);
      process.exit(1);
    }
    if (!evt.newStage || !STAGES.includes(evt.newStage)) {
      console.error(`Verification: invalid stage "${evt.newStage}". Refusing.`);
      process.exit(1);
    }

    // For item-advanced: verify the new stage claim against git
    if (event === "item-advanced") {
      const { errors, warnings } = verifyStageClaim(item, evt.newStage, manifest);

      if (warnings.length > 0) {
        for (const w of warnings) {
          console.log(`  ⚠ ${w}`);
        }
      }

      if (errors.length > 0) {
        console.error(`\n✗ VERIFICATION FAILED — event refused`);
        console.error(`  Item: ${item.id}`);
        console.error(`  Claimed stage: ${evt.newStage}`);
        console.error(`  Current stage: ${item.stage}`);
        for (const e of errors) {
          console.error(`  ✗ ${e}`);
        }
        console.error(`\nThe manifest was NOT updated. The transition was NOT applied.`);
        console.error(`Run 'node transition.mjs status' to see current state.`);
        process.exit(1);
      }

      console.log(`  ✓ Verified: ${item.id} can advance to ${evt.newStage}`);
    }

    // For item-regressed: warn but allow (regression is a decision, not a claim)
    if (event === "item-regressed") {
      console.log(`  ⚠ Regression: ${item.id} ${item.stage} → ${evt.newStage} (not verified — regression is a decision)`);
    }
  }

  // Compute transition (only reached if verification passed)
  const changes = transitionRules(manifest, evt);

  // Always apply (stage update happens even with no relevance changes)
  const updated = applyChanges(manifest, changes, evt);
  writeFileSync(MANIFEST_PATH, JSON.stringify(updated, null, 2) + "\n", "utf8");

  if (changes.length === 0) {
    console.log(`Transition: ${event} (${evt.itemId || evt.spec || ""})`);
    console.log("No relevance changes from this transition.");
  } else {
    console.log(`Transition: ${event}`);
    console.log(`Changes (${changes.length}):`);
    for (const c of changes) {
      console.log(`  ${c.itemId} → ${c.newRelevance}  (${c.reason})`);
    }
  }
  printTable(updated);
  writeFileSync(MANIFEST_PATH, JSON.stringify(updated, null, 2) + "\n", "utf8");

  console.log(`Transition: ${event}`);
  console.log(`Changes (${changes.length}):`);
  for (const c of changes) {
    console.log(`  ${c.itemId} → ${c.newRelevance}  (${c.reason})`);
  }
  printTable(updated);
}

main();
