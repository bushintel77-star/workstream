/**
 * Domain → consumer reachability audit.
 *
 * Extracts every symbol exported by @workstream/domain (functions, values,
 * types, classes) from packages/domain/src/index.ts and the module tree it
 * re-exports, then checks whether each name appears in the two consumer
 * surfaces: apps/web/src (the UI) and apps/api/src (the backend service).
 *
 * A domain symbol with ZERO references in either consumer is either:
 *   - genuinely unwired logic (a capability the platform computes but no
 *     surface calls) — the gap this gate exists to surface, or
 *   - an intentional public API / data type (contracts, re-exported types).
 *
 * The gate is deliberately coarse (name-based) and documented as such: it is
 * a tripwire against "compute it, never surface it", not a proof of UI
 * wiring. False positives (a plain noun that happens to match) are handled by
 * the INTERVAL allowlist; things that ARE surfaced through a different name
 * (e.g. re-exported contracts) are allowlisted with a reason.
 *
 * Usage: node scripts/check-domain-reachability.mjs
 */
import fs from "node:fs";
import path from "node:path";

const DOMAIN_SRC = "packages/domain/src";
const CONSUMERS = ["apps/web/src", "apps/api/src"];

/**
 * Intentional-unused allowlist. Every entry gets a "why" — a symbol that is
 * publicly exported API surface (contracts, schema types, the DSL lexicon)
 * but never imported by name in a consumer is fine; a capability that's dead
 * is not.
 */
const INTENTIONAL = new Map([
  // Re-exported contract types live in the schema layer; consumers import
  // them from @workstream/contracts, not @workstream/domain. The re-export
  // is a compatibility bridge.
  // (Populated when the audit reports each.)
]);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

function exportNamesFrom(src) {
  const names = new Set(); // logic symbols (const/function/class/enum)
  const types = new Set(); // type symbols (type/interface)
  // export const x = , export function x(, export class x, export type x = ,
  // export interface x , export enum x
  const RE =
    /export\s+(?:declare\s+)?(const|function|class|type|interface|enum)\s+([A-Za-z0-9_]+)/g;
  for (const m of src.matchAll(RE)) {
    const kind = m[1];
    const name = m[2];
    if (kind === "type" || kind === "interface") types.add(name);
    else names.add(name);
  }
  // export { a, b as c } from/named
  const BRACE_RE = /export\s+\{([^}]+)\}\s*from\s*['"][^'"]+['"]/g;
  for (const m of src.matchAll(BRACE_RE)) {
    for (const item of m[1].split(",")) {
      const raw = item.trim();
      const isType = raw.startsWith("type ");
      const name = raw.replace(/^type\s+/, "").split(/\s+as\s+/)[0]?.trim();
      if (name && /^[A-Za-z0-9_]+$/.test(name)) {
        (isType ? types : names).add(name);
      }
    }
  }
  return { names, types };
}

// Collect all exported symbol names from the whole domain src tree (each
// module's own exports). This is a superset of index.ts re-exports — good
// enough as a tripwire; a module exporting something nobody uses is a gap.
// Kinds are tracked separately: LOGIC (const/function/class/enum — actual
// capabilities) vs TYPE (type/interface — contract surface; consumers import
// types through @workstream/contracts or only use them as annotations, so a
// type name rarely appears by string in consumer source).
const logicSymbols = new Map(); // name -> files
const typeSymbols = new Map(); // name -> files
for (const file of walk(DOMAIN_SRC)) {
  try {
    const src = fs.readFileSync(file, "utf8");
    const { names, types } = exportNamesFrom(src);
    for (const name of names) {
      if (!logicSymbols.has(name)) logicSymbols.set(name, []);
      logicSymbols.get(name).push(file);
    }
    for (const name of types) {
      if (!typeSymbols.has(name)) typeSymbols.set(name, []);
      typeSymbols.get(name).push(file);
    }
  } catch {
    /* unreadable — skip */
  }
}

// Consumer source: web + api, concatenated. PLUS the domain's own src tree
// (internal composition is a legitimate consumer — a symbol used by another
// domain module is wired, just not surfaced by name; separating the two
// keeps the "truly unwired" signal clean).
let consumerSrc = "";
let domainInternalSrc = "";
for (const dir of CONSUMERS) {
  for (const file of walk(dir)) {
    if (/\.tsx?$/.test(file) && !/\.test\./.test(file)) {
      try {
        consumerSrc += fs.readFileSync(file, "utf8") + "\n";
      } catch {
        /* skip */
      }
    }
  }
}
for (const file of walk(DOMAIN_SRC)) {
  // index.ts is the export barrel — it re-exports everything, so including it
  // in the internal scan would make every symbol "internally used". A REAL
  // internal user is a non-barrel module that composes with the symbol.
  if (file.endsWith(`${path.sep}index.ts`)) continue;
  if (!/\.test\./.test(file)) {
    try {
      domainInternalSrc += fs.readFileSync(file, "utf8") + "\n";
    } catch {
      /* skip */
    }
  }
}

// A symbol is "consumed" if its name appears (as a word) anywhere in
// consumer code. Word-boundary match avoids hex/noise partial matches.
function consumed(name) {
  const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
  return re.test(consumerSrc);
}

const unused = [];
const internalOnly = [];
for (const [name, files] of logicSymbols) {
  if (consumed(name)) continue;
  const why = INTENTIONAL.get(name);
  if (why) continue; // documented intentional
  // Used inside the domain itself (internal composition) → reachable, just
  // not surfaced to the UI by name. Not a "wire it" gap, but worth listing.
  // A symbol's own defining module always contains its name, so exclude the
  // defining file(s); only a DIFFERENT module composing with it counts.
  const defining = new Set(files.map((f) => f.replace(/\\/g, "/")));
  const otherModules = walk(DOMAIN_SRC).filter(
    (f) =>
      /\.tsx?$/.test(f) &&
      !/\.test\./.test(f) &&
      !f.endsWith(`${path.sep}index.ts`) &&
      !defining.has(f.replace(/\\/g, "/")),
  );
  const inDomain = otherModules.some((f) => {
    try {
      return new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(
        fs.readFileSync(f, "utf8"),
      );
    } catch {
      return false;
    }
  });
  if (inDomain) internalOnly.push({ name, files });
  else unused.push({ name, files });
}

console.log(`domain modules scanned: ${walk(DOMAIN_SRC).length}`);
console.log(`logic symbols exported: ${logicSymbols.size} (types: ${typeSymbols.size})`);
console.log(`truly unwired logic (no consumer, no internal user): ${unused.length}`);
console.log(`internal-only (used inside domain, not surfaced to UI): ${internalOnly.length}`);
// Sanity probe: a known-consumed symbol must NOT appear in the gap list.
console.log(
  `sanity: assessPlantingPlacement consumed=${consumed("assessPlantingPlacement")} ` +
    `flagged=${unused.some((u) => u.name === "assessPlantingPlacement")} ` +
    `consumerBytes=${consumerSrc.length}`,
);
console.log("--- UNWIRED (wire these) ---");
for (const u of unused.sort((a, b) => a.name.localeCompare(b.name))) {
  console.log(`  ${u.name}   [${u.files[0]?.replace(DOMAIN_SRC + "/", "")}]`);
}
console.log("--- INTERNAL-ONLY (exported for composition; not a UI gap) ---");
for (const u of internalOnly.sort((a, b) => a.name.localeCompare(b.name)).slice(0, 40)) {
  console.log(`  ${u.name}   [${u.files[0]?.replace(DOMAIN_SRC + "/", "")}]`);
}
if (unused.length > 0) {
  console.log(
    `\nNOTE: ${unused.length} domain logic exports have NO consumer anywhere. ` +
      "Each is either a genuinely unwired capability (wire a UI/API surface) or " +
      "an internal helper/constant that should not be exported.",
  );
}
