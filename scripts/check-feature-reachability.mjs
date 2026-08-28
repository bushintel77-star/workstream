/**
 * CI gate: every component exported from a canvas feature folder must be
 * imported somewhere. A component nothing mounts is invisible to typecheck, to
 * unit tests, and to ESLint — the three things this repo already gates on.
 *
 * Why this exists: when `apps/web` was first linted (2026-08) six finished
 * features turned out to be shipping inert. Five left an unused binding behind,
 * so ESLint now catches them. The sixth, `PointerMarkSettings`, did not: a
 * complete 91-line component with its own stylesheet, full listbox a11y and
 * passing unit tests that nothing imported, so the drawing cursor could never be
 * changed. Nothing in CI could see that.
 *
 * Method: collect PascalCase component exports under features/, then require a
 * real reference somewhere else — an import binding, a `<Jsx` tag, or a call.
 * Bare word presence is deliberately NOT enough: the first version of this gate
 * counted a comment explaining that `PointerMarkSettings` is unmounted as proof
 * that it was mounted, so documentation silenced the exact finding the gate was
 * written for.
 *
 * Known limits, stated rather than pretended away:
 *  - A component re-exported by a barrel that is itself unused reads as
 *    reachable (one level of indirection).
 *  - A component that IS imported but rendered behind a condition that is never
 *    true reads as reachable. That is the next mutation of this bug and needs a
 *    runtime probe, not a static one.
 *  - A module-internal helper is rescued by a reachable sibling export in the
 *    same file (see pass 2), so a helper mounted by a dead sibling in a module
 *    with any other live export reads as reachable.
 *  - Routes are not components: Next.js reaches `page.tsx` by filesystem, so an
 *    entire route with no inbound link in the product passes. `/growth-studio/[id]`
 *    is exactly that today. Route reachability needs a separate gate.
 *
 * Usage: node scripts/check-feature-reachability.mjs
 */
import fs from "fs";
import path from "path";

/**
 * Scanned roots, each with a floor on how many components it must yield.
 *
 * The floor is the entire point of this list. Until 2026-08-22 the only root was
 * `canvas/handoff/features` — the *retired* SVG studio. `walk()` returns `[]` for
 * a missing directory (see below), so when the 2026-08-19 retirement emptied that
 * folder the gate degraded to a silent no-op that still printed "ok": 9
 * components inspected while the 61 in `canvas/webgl` — the surface where every
 * new component now lands — went unexamined. A root that falls below its floor
 * fails loudly, so the next directory move cannot quietly empty this gate.
 *
 * Raise a floor when a root grows. Never lower one to make CI pass.
 */
const ROOTS = [
  { dir: "apps/web/src/components/canvas", min: 60 },
];
const SRC = "apps/web/src";

/**
 * Components that are deliberately unmounted today. Every entry needs a reason
 * and an OUTSTANDING.md item — this is a ratchet, not a dumping ground. Remove
 * the entry when the component is wired up.
 */
const ALLOW = new Map([
  // Alternate canvas-native layout prototypes — wiring pending user approval
  ["BottomAssetStrip", "Alternate layout: bottom asset strip (not yet mounted)",],
  // RightPanelTabs deleted 2026-08-28 with the hidden-dock retirement.
  // Classic SVG-era elevation board — stranded by the WebGL migration; the
  // photo-trace elevation (PhotoElevationSheet) is the live surface. Re-home
  // or retire with the handoff/ prune (AGENTS.md migration note).
  ["ElevationBoard", "Classic elevation board awaiting re-home decision under handoff/",],
]);

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const isTest = (f) => /\.test\.(ts|tsx)$/.test(f);
const rel = (f) => f.replace(/\\/g, "/");

/** `export function Foo(` / `export const Foo =` / `export default function Foo(` */
const EXPORT_PATTERNS = [
  /export\s+function\s+([A-Z][A-Za-z0-9_]*)\s*\(/g,
  /export\s+const\s+([A-Z][A-Za-z0-9_]*)\s*[:=]/g,
  /export\s+default\s+function\s+([A-Z][A-Za-z0-9_]*)\s*\(/g,
];

/**
 * `SCREAMING_SNAKE_CASE` matches the PascalCase patterns above but can never be
 * mounted — JSX treats it as a literal tag. The docstring always claimed consts
 * were skipped; the regex never actually did, so widening the scope surfaced
 * `CAMERA_CHROME_ATTR` (a `data-` attribute name used twice in its own file) as
 * an inert component.
 */
const isConstantCase = (name) => /^[A-Z0-9_]+$/.test(name);

/** name -> defining file */
const exported = new Map();
/** dir -> { found, min } — checked against the floor before anything else. */
const scope = new Map();

for (const { dir, min } of ROOTS) {
  const files = walk(dir).filter((f) => f.endsWith(".tsx") && !isTest(f));
  const namesHere = new Set();
  for (const file of files) {
    const src = fs
      .readFileSync(file, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    for (const re of EXPORT_PATTERNS) {
      for (const m of src.matchAll(re)) {
        const name = m[1];
        if (isConstantCase(name)) continue;
        namesHere.add(name);
        // Types/consts that happen to be PascalCase are fine to skip: we only
        // care about things that could be mounted, i.e. defined in a .tsx.
        if (!exported.has(name)) exported.set(name, file);
      }
    }
  }
  scope.set(dir, { found: namesHere.size, min });
}

const starved = [...scope.entries()].filter(([, s]) => s.found < s.min);
if (starved.length) {
  console.error(
    "FAIL: a scanned root yielded fewer components than its floor. The gate is\n" +
    "not measuring what it claims to — a directory was moved, renamed or emptied:\n",
  );
  for (const [dir, s] of starved) {
    console.error(`  ${dir}\n    found ${s.found}, floor ${s.min}`);
  }
  console.error(
    "\nRepoint ROOTS at the real location. Do not lower the floor to pass.",
  );
  process.exit(1);
}

/**
 * Index every other source file once, so this stays O(files) not O(files*names).
 *
 * Comments are stripped from the searched content, not just from the defining
 * file. Without this a comment explaining that a component is unmounted counts
 * as a reference and silences the gate — which is exactly what happened on the
 * first run: a note in HandoffDesignStudio naming `PointerMarkSettings` made it
 * read as reachable.
 */
const allSource = walk(SRC).filter((f) => /\.(ts|tsx)$/.test(f));
const contentByFile = new Map();
for (const f of allSource) {
  const stripped = fs
    .readFileSync(f, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
  contentByFile.set(f, stripped);
}

/** Matchers for a real reference to `name`. Prose mentioning it does not count. */
function matchers(name) {
  return {
    // An import binding, possibly inside a multi-line `{ ... }` block.
    asImport: new RegExp(`\\bimport\\b[^;]*\\b${name}\\b[^;]*from\\b`),
    asJsx: new RegExp(`<${name}[\\s/>]`),
    asCall: new RegExp(`\\b${name}\\s*\\(`),
    // Barrel re-export, including aliased: `export { Foo as Bar } from "./Foo"`.
    // This is the one-level indirection noted in the limits above.
    asReexport: new RegExp(`export\\s*{[^}]*\\b${name}\\b[^}]*}\\s*from`),
  };
}

/** Referenced from any file other than its own definition and test sibling. */
function referencedElsewhere(name, definedIn) {
  const testSiblings = new Set([
    definedIn.replace(/\.tsx$/, ".test.tsx"),
    definedIn.replace(/\.tsx$/, ".test.ts"),
  ]);
  const { asImport, asJsx, asCall, asReexport } = matchers(name);
  for (const [f, content] of contentByFile) {
    if (f === definedIn || testSiblings.has(f)) continue;
    if (
      asImport.test(content) ||
      asJsx.test(content) ||
      asCall.test(content) ||
      asReexport.test(content)
    ) {
      return true;
    }
  }
  return false;
}

/** Pass 1: cross-file reachability, which is the original test. */
const crossFile = new Map();
for (const [name, definedIn] of exported) {
  crossFile.set(name, referencedElsewhere(name, definedIn));
}

/**
 * Pass 2: rescue module-internal helpers.
 *
 * A component mounted only by a sibling export in the same file is reachable —
 * `SceneItem` is rendered by `SceneItems` in `webgl/sceneItems.tsx`, and
 * `StudioScene` mounts `SceneItems`. Pass 1 skips the defining file (so that a
 * component referencing only itself cannot vouch for itself), which reported
 * that as inert. Requiring a *distinct* reachable export in the same file keeps
 * the original protection: a lone self-referential component still fails.
 */
const unreachable = [];
for (const [name, definedIn] of exported) {
  if (crossFile.get(name)) continue;
  const siblingReachable = [...exported].some(
    ([other, otherFile]) =>
      otherFile === definedIn && other !== name && crossFile.get(other),
  );
  const { asJsx, asCall } = matchers(name);
  const own = contentByFile.get(definedIn) ?? "";
  if (siblingReachable && (asJsx.test(own) || asCall.test(own))) continue;
  unreachable.push({ name, file: rel(definedIn) });
}

const unexpected = unreachable.filter((u) => !ALLOW.has(u.name));
const stale = [...ALLOW.keys()].filter(
  (name) => !unreachable.some((u) => u.name === name),
);

if (unexpected.length) {
  console.error(
    "FAIL: feature components exported but imported nowhere (shipped inert):\n",
  );
  for (const u of unexpected) console.error(`  ${u.name}  ${u.file}`);
  console.error(
    "\nWire it up, delete it, or add it to ALLOW in this script with a reason\n" +
    "and an OUTSTANDING.md entry. Do not add entries to make CI quiet.",
  );
  process.exit(1);
}

if (stale.length) {
  console.error(
    "FAIL: ALLOW entries that are now reachable — remove them so the ratchet tightens:\n",
  );
  for (const name of stale) console.error(`  ${name}`);
  process.exit(1);
}

const scopeNote = [...scope.entries()]
  .map(([dir, s]) => `${dir.replace("apps/web/src/components/", "")} ${s.found}/${s.min}`)
  .join(", ");

console.log(
  `ok: ${exported.size} canvas components, all reachable ` +
  `(${ALLOW.size} allowlisted: ${[...ALLOW.keys()].join(", ") || "none"}; ` +
  `scope ${scopeNote})`,
);
