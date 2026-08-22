/**
 * CI gate: hold the line on what a client actually downloads.
 *
 * What this replaced: a single measurement of the *whole*
 * `apps/web/.next/static/chunks` directory against one total. That budget is the
 * wrong shape for a WebGL product in three ways.
 *
 *  1. A directory total hides distribution. One 4 MB Three.js chunk passes as
 *     long as everything else is small, and a chunk nobody downloads costs the
 *     same against the budget as one every visitor pulls.
 *  2. Nothing measured a *route*. `/projects/[id]` is the canvas — the route
 *     that dominates this product's weight — and it had no budget of its own,
 *     so the number that matters most to a user was the one number nobody held.
 *  3. Growth was invisible until it was catastrophic: a route could double its
 *     first load while the directory total moved a few percent.
 *
 * So this measures three things, tightest first:
 *
 *  - **Per-route first-load JS** — polyfills + the root shell + every entry
 *    chunk in that route's segment tree (layout chain, page, and the
 *    loading/error boundaries Next ships alongside them). This is the closest
 *    reproducible stand-in for a cold visit.
 *  - **Per-chunk cap** — the largest single JS chunk, so weight cannot pool.
 *  - **Directory total** — kept as a coarse backstop, because the two measures
 *    above only see chunks that are reachable from a route manifest, and a
 *    lazily-imported chunk still costs bandwidth when something pulls it.
 *
 * **These are uncompressed bytes.** A user downloads them compressed — brotli
 * over this kind of JS typically lands near a quarter of the raw size — so the
 * numbers here are a proxy for movement, not a transfer estimate. Every failure
 * message says so, because a budget that quietly implies "MB downloaded" when it
 * means "MB on disk" is a budget that gets argued with rather than fixed.
 *
 * Measured from Turbopack's per-route client-reference manifests rather than the
 * build log: Next 16 + Turbopack no longer prints a First Load JS column, and
 * scraping a table that may vanish next minor is not a gate.
 *
 * Usage:
 *   node scripts/check-bundle-size.mjs
 *   node scripts/check-bundle-size.mjs --report   # every route, largest first
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const budgetPath = path.join(root, "scripts", "bundle-size-budget.json");
const budget = JSON.parse(fs.readFileSync(budgetPath, "utf8"));
const wantsReport = process.argv.includes("--report");

/**
 * Fewer routes than this means the manifests moved or the build shape changed,
 * not that the app shrank. Without it, a Next upgrade that renames
 * `page_client-reference-manifest.js` would leave this gate measuring zero
 * routes and still printing ok — the vacuous-green failure that has already
 * happened to three ratchets in this repo.
 */
const MIN_ROUTES_MEASURED = 20;

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file, files);
    else files.push(file);
  }
  return files;
}

const mb = (bytes) => `${(bytes / 1_000_000).toFixed(2)} MB`;
const kb = (bytes) => `${Math.round(bytes / 1000)} kB`;

/**
 * Turbopack writes each route's client manifest as a script that assigns onto
 * `globalThis`. Rebinding that identifier to a local object is enough to read it
 * without touching the real global.
 */
function readRscManifest(file) {
  const source = fs.readFileSync(file, "utf8").replace(/globalThis/g, "__scope");
  const scope = {};
  new Function("__scope", source)(scope);
  return scope.__RSC_MANIFEST ?? {};
}

/** `/_next/static/chunks/x.js` and `static/chunks/x.js` both live under `.next`. */
function chunkPath(nextDir, asset) {
  return path.join(nextDir, asset.replace(/^\/_next\//, "").replace(/^\//, ""));
}

function sizeOf(file) {
  try {
    return fs.statSync(file).size;
  } catch {
    return 0;
  }
}

let failed = false;

for (const [name, rule] of Object.entries(budget)) {
  const directory = path.join(root, rule.directory);
  if (!fs.existsSync(directory)) {
    console.error(`FAIL: ${name} bundle directory is missing: ${rule.directory}`);
    console.error("Run the web build first (pnpm web:check-bundle-size does).");
    failed = true;
    continue;
  }

  /* ------------------------------------------------ directory backstop */

  const files = walk(directory);
  const totalBytes = files.reduce((total, file) => total + sizeOf(file), 0);
  const javascriptFiles = files.filter((file) => file.endsWith(".js"));
  const javascriptBytes = javascriptFiles.reduce(
    (total, file) => total + sizeOf(file),
    0,
  );

  console.log(
    `${name}: ${mb(totalBytes)} chunks on disk, ${mb(javascriptBytes)} JavaScript ` +
      `(uncompressed, ${files.length} files)`,
  );

  if (totalBytes > rule.maxBytes) {
    console.error(
      `FAIL: ${name} chunk directory is ${mb(totalBytes)} uncompressed on disk, ` +
        `over the ${mb(rule.maxBytes)} backstop.`,
    );
    failed = true;
  }
  if (javascriptBytes > rule.maxJavaScriptBytes) {
    console.error(
      `FAIL: ${name} JavaScript is ${mb(javascriptBytes)} uncompressed on disk, ` +
        `over the ${mb(rule.maxJavaScriptBytes)} backstop.`,
    );
    failed = true;
  }

  /* ----------------------------------------------------- per-chunk cap */

  const chunks = javascriptFiles
    .map((file) => ({ file: path.relative(root, file).replace(/\\/g, "/"), bytes: sizeOf(file) }))
    .sort((a, b) => b.bytes - a.bytes);
  const biggest = chunks[0];

  if (biggest && biggest.bytes > rule.maxChunkBytes) {
    console.error(
      `FAIL: ${name} has a single chunk of ${kb(biggest.bytes)} uncompressed, over the ` +
        `${kb(rule.maxChunkBytes)} per-chunk cap:\n  ${biggest.file}\n` +
        "A directory total cannot see this: one chunk this size is downloaded whole\n" +
        "before the route it belongs to can hydrate. Split it, or lazy-import the\n" +
        "part that is not needed for first paint.",
    );
    failed = true;
  }

  /* ---------------------------------------------- per-route first load */

  const nextDir = path.join(root, rule.nextDir);
  const appDir = path.join(nextDir, "server", "app");
  const rootManifestPath = path.join(nextDir, "build-manifest.json");

  if (!fs.existsSync(rootManifestPath)) {
    console.error(
      `FAIL: ${name} build manifest is missing: ${path.relative(root, rootManifestPath)}\n` +
        "Per-route first-load JS cannot be measured, which is the measurement that\n" +
        "matters most here. Do not treat a missing manifest as a pass.",
    );
    failed = true;
    continue;
  }

  const rootManifest = JSON.parse(fs.readFileSync(rootManifestPath, "utf8"));
  /** The shell every route pays for: polyfills + the root client runtime. */
  const shell = [
    ...(rootManifest.polyfillFiles ?? []),
    ...(rootManifest.rootMainFiles ?? []),
  ];

  const measured = [];
  for (const file of walk(appDir)) {
    if (!file.endsWith("page_client-reference-manifest.js")) continue;
    const manifest = readRscManifest(file);
    for (const [key, entry] of Object.entries(manifest)) {
      if (!key.endsWith("/page")) continue;
      const route = key.slice(0, -"/page".length) || "/";
      // Framework-internal segments, not routes an operator can visit.
      if (route.startsWith("/_")) continue;

      const assets = new Set(shell);
      for (const list of Object.values(entry.entryJSFiles ?? {})) {
        for (const asset of list) assets.add(asset);
      }
      const bytes = [...assets].reduce(
        (total, asset) => total + sizeOf(chunkPath(nextDir, asset)),
        0,
      );
      measured.push({ route, bytes, assets: assets.size });
    }
  }

  measured.sort((a, b) => b.bytes - a.bytes);

  if (measured.length < MIN_ROUTES_MEASURED) {
    console.error(
      `FAIL: measured first-load JS for only ${measured.length} routes, floor is ` +
        `${MIN_ROUTES_MEASURED}.\n\n` +
        "The manifests moved or changed shape — almost certainly a Next upgrade —\n" +
        "so this gate is no longer measuring the thing it claims to. Repoint it at\n" +
        "the new manifest location. Do not lower the floor to make CI pass.",
    );
    failed = true;
    continue;
  }

  const shellBytes = shell.reduce(
    (total, asset) => total + sizeOf(chunkPath(nextDir, asset)),
    0,
  );

  if (wantsReport) {
    console.log(
      `\n${name} first-load JS per route (uncompressed; shared shell ${kb(shellBytes)}):\n`,
    );
    for (const entry of measured) {
      const cap = rule.routes?.[entry.route] ?? rule.maxFirstLoadBytes;
      const flag = entry.bytes > cap ? " OVER" : "";
      console.log(
        `  ${kb(entry.bytes).padStart(8)}  / ${kb(cap).padStart(8)} cap   ` +
          `${entry.route}${flag}`,
      );
    }
    console.log(`\n${name} largest chunks (uncompressed):\n`);
    for (const chunk of chunks.slice(0, 8)) {
      console.log(`  ${kb(chunk.bytes).padStart(8)}  ${chunk.file}`);
    }
    console.log("");
  }

  const overBudget = measured.filter(
    (entry) => entry.bytes > (rule.routes?.[entry.route] ?? rule.maxFirstLoadBytes),
  );
  if (overBudget.length) {
    console.error(
      `FAIL: ${name} routes over their first-load JS budget (uncompressed bytes;\n` +
        "a user downloads these compressed, so treat the number as movement, not transfer):\n",
    );
    for (const entry of overBudget) {
      const cap = rule.routes?.[entry.route] ?? rule.maxFirstLoadBytes;
      console.error(
        `  ${entry.route}\n    ${kb(entry.bytes)} first load, budget ${kb(cap)}`,
      );
    }
    console.error(
      "\nThis is a ratchet: raise a route budget only with the reason in the commit\n" +
        "message, and never to paper over an import that should have been lazy.",
    );
    failed = true;
  }

  const unknownRoutes = Object.keys(rule.routes ?? {}).filter(
    (route) => !measured.some((entry) => entry.route === route),
  );
  if (unknownRoutes.length) {
    console.error(
      "FAIL: per-route budgets naming routes that no longer build — delete them so\n" +
        "the budget file cannot drift out of contact with the app:\n",
    );
    for (const route of unknownRoutes) console.error(`  ${route}`);
    failed = true;
  }

  if (!failed) {
    const heaviest = measured[0];
    console.log(
      `${name}: ${measured.length} routes measured, heaviest first load ` +
        `${kb(heaviest.bytes)} (${heaviest.route}), largest chunk ${kb(biggest?.bytes ?? 0)}, ` +
        `shared shell ${kb(shellBytes)} — all uncompressed`,
    );
  }
}

if (failed) process.exit(1);
