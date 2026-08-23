/**
 * API → frontend consumption audit.
 *
 * Extracts every Fastify route registered by apps/api, resolves the mount
 * prefix from server.ts, then looks for a matching consumption string in the
 * web consumer surface (Next proxy routes, lib/api.ts, actions.ts, clients).
 *
 * This is the "is backend logic wired to the UI?" instrument: an API route
 * with ZERO references anywhere under apps/web/src (excluding the API's own
 * proxy layer which exists ONLY to exist) is a gap — backend logic with no
 * UI path.
 *
 * Usage: node scripts/check-api-consumption.mjs
 */
import fs from "node:fs";
import path from "node:path";

const API_ROUTES_DIR = "apps/api/src/routes";
const SERVER_TS = "apps/api/src/server.ts";
const WEB_SRC = "apps/web/src";

const METHOD_RE = /(fastify|app|server)\.(get|post|put|patch|delete)\(\s*["'`]([^"'`]+)["'`]/g;
const PREFIX_RE = /server\.register\(\w+Routes?,\s*\{\s*prefix:\s*["'`]([^"'`]+)["'`]\s*\}/g;
const IMPORT_RE = /import (\w+)Routes.*?from ['"][^'"]+\/([a-z0-9-]+)['"]/g;
const ROUTE_FILE_RE = /^[a-z0-9-]+\.ts$/;

function allFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) allFiles(full, out);
    else if (entry.isFile() && ROUTE_FILE_RE.test(entry.name)) out.push(full);
  }
  return out;
}

function walkConsumers(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkConsumers(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

// 1. Mount prefixes: parse imports (alias → file) and registrations
// (alias → prefix) so each route FILE gets its mount prefix.
const serverSrc = fs.readFileSync(SERVER_TS, "utf8");
// `import surveyRoutes from './routes/surveys';`  →  surveyRoutes → surveys
const IMPORT_RE2 = /import\s+(\w+Routes?)\s+from\s+['"][^'"]+\/routes\/([a-z0-9-]+)['"]/g;
const aliasToFile = new Map();
for (const m of serverSrc.matchAll(IMPORT_RE2)) {
  aliasToFile.set(m[1], m[2]);
}
// `server.register(surveyRoutes, { prefix: '/projects' })`  → surveyRoutes → /projects
const REG_RE =
  /server\.register\(\s*(\w+Routes?),\s*\{\s*prefix:\s*["'`]([^"'`]+)["'`]\s*\}/g;
const aliasToPrefix = new Map();
for (const m of serverSrc.matchAll(REG_RE)) {
  aliasToPrefix.set(m[1], m[2]);
}
// File basename → prefix (also honour a direct import of a non-plural alias).
function prefixForFile(fileBase) {
  for (const [alias, file] of aliasToFile) {
    if (file === fileBase) {
      return aliasToPrefix.get(alias) ?? "";
    }
  }
  return "";
}

// 2. Extract routes per file (fastify.get/post/put…) and attach prefix.
const routes = [];
for (const file of allFiles(API_ROUTES_DIR)) {
  if (file.endsWith(".test.ts")) continue;
  const src = fs.readFileSync(file, "utf8");
  const base = path.basename(file, ".ts");
  const prefix = prefixForFile(base);
  for (const m of src.matchAll(METHOD_RE)) {
    const method = m[2].toUpperCase();
    const p = m[3];
    // Strip Fastify dynamic-param syntax and query strings for comparison.
    const normalized = p.replace(/:[A-Za-z]+/g, ":").split("?")[0];
    const full = `${prefix}${normalized}`;
    routes.push({ file: base, method, path: full, raw: p });
  }
}

// 3. Consumer surface.
const consumers = walkConsumers(WEB_SRC)
  // The proxy layer exists to relay, not to consume.
  .filter((f) => !f.includes("/app/api/"));
const consumerSrc = consumers
  .map((f) => fs.readFileSync(f, "utf8"))
  .join("\n");

// 4. Match: an API path is "consumed" if any LITERAL path segment (or a
// run of adjacent literals) appears in the consumer source. Distinctive
// multi-word tails (`stormwater-geojson`, `design-canvas`) give a strong
// signal; single segments like `files`/`tasks` are weak but usable when the
// route has no other literal. `:params` and `${...}` are skipped as non-
// literal.
function literalSegments(p) {
  const segs = p.split("/").filter(Boolean);
  return segs.filter((s) => !/^:/.test(s) && !/\$\{/.test(s) && !/^\*/.test(s));
}

const gaps = [];
for (const r of routes) {
  const lits = literalSegments(r.path);
  // Strongest: any 2-adjacent-literal run; else any distinctive literal.
  const found2 = lits.some((s, i) => i + 1 < lits.length && consumerSrc.includes(`${s}/${lits[i + 1]}`));
  // 1-segment fallback: require ≥4 chars so common slugs don't false-negative.
  const found1 = lits.some((s) => s.length >= 4 && consumerSrc.includes(s));
  // Special case: the integration hub is consumed through the
  // /integrations/hub path, so a bare "/hub" reference in the API is covered.
  const hubCovered = r.path.endsWith("/hub") && consumerSrc.includes("/integrations/hub");
  if (!found2 && !found1 && !hubCovered) gaps.push(r);
}

// Intentional gaps — routes that are probes, direct-URL assets, or otherwise
// never fetch-consumed by design. Keeping them here documents WHY, so a newly
// added route without a consumer fails loudly instead of hiding behind a
// blanket allowlist.
const INTENTIONAL_GAPS = new Set([
  "GET /healthz", // deploy/liveness probe — the probe calls it, not UI code
  "GET /readyz", // deploy readiness probe (same role)
  "GET /${kind}/:", // protected files — served by direct URL in <a href>, not fetch
]);

// Dedup by method+path.
const seen = new Set();
const unique = gaps.filter((r) => {
  const k = `${r.method} ${r.path}`;
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});

const real = unique.filter((r) => !INTENTIONAL_GAPS.has(`${r.method} ${r.path}`));
const intentional = unique.filter((r) => INTENTIONAL_GAPS.has(`${r.method} ${r.path}`));

console.log(`routes extracted: ${routes.length}`);
console.log(`consumer files scanned: ${consumers.length}`);
console.log(`unwired (no frontend reference): ${real.length} real + ${intentional.length} intentional`);
console.log("---");
for (const r of real.sort((a, b) => a.path.localeCompare(b.path))) {
  console.log(`  GAP ${r.method.padEnd(6)} ${r.path}   [${r.file}.ts]`);
}
for (const r of intentional.sort((a, b) => a.path.localeCompare(b.path))) {
  console.log(`  ok  ${r.method.padEnd(6)} ${r.path}   (intentional) [${r.file}.ts]`);
}
if (real.length > 0) {
  console.log("\nFAIL: backend routes exist with no frontend consumer. Wire a UI surface for each.");
  process.exit(1);
}
console.log("\nok: every backend route has a frontend consumer (or a documented intentional gap).");
