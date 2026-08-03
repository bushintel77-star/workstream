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
 *
 * Usage: node scripts/check-feature-reachability.mjs
 */
import fs from "fs";
import path from "path";

const FEATURES = "apps/web/src/components/canvas/handoff/features";
const SRC = "apps/web/src";

/**
 * Components that are deliberately unmounted today. Every entry needs a reason
 * and an OUTSTANDING.md item — this is a ratchet, not a dumping ground. Remove
 * the entry when the component is wired up.
 */
const ALLOW = new Map([
  [
    "PointerMarkSettings",
    "Never mounted, so the drawing cursor cannot be changed. Restoring it is a Cmd+K decision per STUDIO-STYLING-AND-UX.md §6 item 9.",
  ],
  [
    "StudioCoachMarks",
    "Never mounted, so first-run onboarding has never appeared. Three-step tour with cc_coach_done localStorage gating, ready to wire.",
  ],
  [
    "CanvasMeasureSummary",
    "Never mounted. Its buildCanvasMeasureSummary helper IS used and has passing tests, so the logic is covered while the card never renders.",
  ],
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

const featureFiles = walk(FEATURES).filter(
  (f) => f.endsWith(".tsx") && !isTest(f),
);

/** name -> defining file */
const exported = new Map();
for (const file of featureFiles) {
  const src = fs
    .readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
  for (const re of EXPORT_PATTERNS) {
    for (const m of src.matchAll(re)) {
      const name = m[1];
      // Types/consts that happen to be PascalCase are fine to skip: we only
      // care about things that could be mounted, i.e. defined in a .tsx.
      if (!exported.has(name)) exported.set(name, file);
    }
  }
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

const unreachable = [];
for (const [name, definedIn] of exported) {
  const testSiblings = new Set([
    definedIn.replace(/\.tsx$/, ".test.tsx"),
    definedIn.replace(/\.tsx$/, ".test.ts"),
  ]);
  // An import binding (possibly inside a multi-line `{ ... }` block), a JSX
  // tag, or a direct call. Prose mentioning the name does not count.
  const asImport = new RegExp(`\\bimport\\b[^;]*\\b${name}\\b[^;]*from\\b`);
  const asJsx = new RegExp(`<${name}[\\s/>]`);
  const asCall = new RegExp(`\\b${name}\\s*\\(`);
  // Barrel re-export, including aliased: `export { Foo as Bar } from "./Foo"`.
  // This is the one-level indirection noted in the limits above.
  const asReexport = new RegExp(`export\\s*{[^}]*\\b${name}\\b[^}]*}\\s*from`);
  let referenced = false;
  for (const [f, content] of contentByFile) {
    if (f === definedIn || testSiblings.has(f)) continue;
    if (
      asImport.test(content) ||
      asJsx.test(content) ||
      asCall.test(content) ||
      asReexport.test(content)
    ) {
      referenced = true;
      break;
    }
  }
  if (!referenced) unreachable.push({ name, file: rel(definedIn) });
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

console.log(
  `ok: ${exported.size} feature components, all reachable ` +
  `(${ALLOW.size} allowlisted: ${[...ALLOW.keys()].join(", ") || "none"})`,
);
