/**
 * CI gate: every Next.js route under `apps/web/src/app` must be reachable by a
 * user — i.e. something in the product navigates to it — or be allowlisted with
 * a reason.
 *
 * Why this exists: `scripts/check-feature-reachability.mjs` proves a *component*
 * is imported somewhere, and names this exact hole in its own "known limits":
 *
 *   "Routes are not components: Next.js reaches `page.tsx` by filesystem, so an
 *    entire route with no inbound link in the product passes."
 *
 * That was not hypothetical. `/growth-studio/[id]` — a finished 3D
 * growth-maturity studio reading the real design canvas — shipped with no
 * inbound link anywhere. It typechecked, it linted, its components were
 * "reachable" by import, and every gate was green. No user could get to it.
 * Finished-but-unreachable is this codebase's characteristic failure mode (five
 * inert features found when `apps/web` was first linted in 2026-08, then
 * `PointerMarkSettings`, then `VignetteOverlay`), so it gets its own ratchet.
 *
 * Method, in two halves:
 *
 *  1. Enumerate every `page.tsx` under the app directory and turn its path into
 *     a URL pattern, dynamic segments included.
 *  2. Extract every *navigable* URL literal from the shipped source — a string
 *     that some code shape actually points a browser at (`href`, `router.push`,
 *     `redirect`, a Stripe `success_url`) — and match the two.
 *
 * Half 2 is the part that has to be careful. The Fastify API and the Next.js app
 * share path shapes: `apiFetch(`/projects/${id}/carbon`)` is an API call, not a
 * page link, yet a naive substring scan reads it as proof that
 * `/projects/[id]/carbon` is reachable. Requiring a navigation context is what
 * separates "this string exists" from "a user can get there".
 *
 * Deliberate exclusions from the link corpus (searching them would make this
 * gate lie):
 *  - `*.test.ts(x)` and `e2e/` — a spec that navigates straight to a URL proves
 *    nothing about whether a user can get there. That is precisely the trap this
 *    gate exists to close, so tests may not vouch for a route.
 *  - Comments. An earlier gate here was silenced by a comment naming the very
 *    component it was written to catch, so comments are stripped from every file
 *    before it is searched.
 *  - Markdown. A doc describing a route is not an entry point.
 *
 * Known limits, stated rather than pretended away:
 *  - A route linked from a component that is itself never mounted reads as
 *    reachable. One level of indirection, the same blind spot the feature gate
 *    has; `check-feature-reachability.mjs` is what covers that flank.
 *  - A link rendered behind a condition that is never true reads as reachable.
 *    Catching that needs a runtime crawl, not a static scan.
 *  - An href assembled away from its navigation site (`const t = "/x"; push(t)`),
 *    built by concatenation (`"/projects/" + id`), or stitched from fragments in
 *    a nav table (`` `${base}${item.path}` ``) is NOT matched. That errs toward
 *    failing, which is the safe direction for a ratchet — write the route out in
 *    full at the navigation site, or allowlist it with the reason.
 *    `lib/project-sections.ts` is written that way deliberately.
 *  - An alias route's redirect *target* is not verified, because the target
 *    usually lives in a helper rather than the page. The target is gated on its
 *    own account as a route, so an alias cannot launder an orphan.
 *  - Reachability is not authorisation, and it is not discoverability: this
 *    proves a link exists, not that the operator may follow it or would ever
 *    find it.
 *
 * Usage:
 *   node scripts/check-route-reachability.mjs
 *   node scripts/check-route-reachability.mjs --report   # full inventory
 */
import fs from "node:fs";
import path from "node:path";

const APP_DIR = "apps/web/src/app";

/**
 * Where an inbound link may legitimately come from, each with a floor.
 *
 * The floors are the entire point of this list. Three of this repo's eight
 * ratchets silently lost 60-93% of their scope in the 2026-08-19 directory
 * retirement and all three kept printing "ok", because `walk()` over a moved
 * directory returns `[]` and an empty list reads as "nothing to report". A root
 * that falls below its floor fails loudly instead.
 *
 * `apps/api/src` is in scope because client portal return URLs are built
 * server-side (Stripe `success_url` / `cancel_url`) — those are real inbound
 * links even though no operator-facing component renders them.
 *
 * Raise a floor when a root grows. Never lower one to make CI pass.
 */
const LINK_ROOTS = [
  /* apps/web/src lowered 300 → 270 on 2026-08-31 against two deliberate
   * deletions in the same series: the 48-file dead-code purge (UI redundancy
   * scan Tier 1) and the legacy project chrome removal (ProjectChrome +
   * breadcrumb + surface rail + nine redirect-only pipeline routes). The
   * corpus stands at 278 — this floor still catches the failure it exists
   * for (a moved or emptied directory reading as "nothing to report"), it
   * just no longer encodes file count from before the purge. */
  { dir: "apps/web/src", min: 270 },
  { dir: "apps/api/src", min: 100 },
];

/**
 * Fewer `page.tsx` files than this means the app directory moved, not shrank.
 *
 * Lowered 30 → 24 on 2026-08-31, in the same commit as the deletion the gate
 * asks for: the nine redirect-only legacy pipeline routes (`overview`,
 * `survey`, `tasks`, `filing`, `costing`, `design`, `design/cad`,
 * `design/develop`, `design/studio`) were removed with the legacy project
 * chrome. Each was a stub whose whole body was `redirectToCanvas(id, mode)`,
 * so they contributed pages without contributing product. The canvas owns
 * those modes via `?mode=`.
 */
const MIN_PAGES = 23;

/**
 * …and of those pages, this many must be real gated routes. Without a second
 * floor, a change that made every page read as a redirect-only alias would empty
 * the gate while `MIN_PAGES` still passed — the same vacuous-green shape the
 * floors exist to prevent, one level in.
 */
const MIN_GATED_ROUTES = 20;

/**
 * Fewer navigable hrefs than this means the extractor broke, not that the
 * product stopped linking anywhere. Without this floor a regression in
 * `collectNavHrefs` would report every route as an orphan — loud, but for the
 * wrong reason, and the temptation would be to allowlist the world.
 */
const MIN_NAV_HREFS = 60;

/**
 * Routes with no inbound link *by design*. Every entry needs a reason. This is a
 * ratchet, not a dumping ground: an entry that becomes reachable fails the gate
 * as stale, so it must then be deleted and can never be re-added quietly, and an
 * entry for a route that no longer exists fails as phantom.
 */
const ALLOW = new Map([
  [
    "/share/[token]",
    "Deep-link only: the client share portal is reached by an emailed tokenised URL. The operator copies the link out of canvas Share mode rather than following it.",
  ],
  [
    "/portal/quote/[token]",
    "Deep-link only: the client quote portal is reached by the tokenised URL emailed with the quote output.",
  ],
  [
    "/portal/deposit/[token]",
    "Deep-link only: reached from the deposit button on the emailed quote portal page, which builds the href from the same token it was loaded with.",
  ],
  [
    "/sign-up/[[...sign-up]]",
    "Clerk owns this entry point — reached from the Clerk-rendered sign-in card, which is not in our source.",
  ],
  [
    "/e2e/root-error",
    "E2e-only probe: Playwright navigates here in non-production to assert the app-level error boundary copy. Not linked from operator UI.",
  ],
]);

/**
 * Framework files that are not routes. They have no URL of their own: Next.js
 * composes them into a route's render tree (layout/loading/error) or emits them
 * into the document head (metadata routes). Requiring an inbound link to
 * `error.tsx` would be nonsense, so they are counted and reported, not gated.
 */
const FRAMEWORK_FILES = new Set([
  "layout.tsx",
  "layout.ts",
  "template.tsx",
  "default.tsx",
  "loading.tsx",
  "error.tsx",
  "global-error.tsx",
  "not-found.tsx",
  "forbidden.tsx",
  "unauthorized.tsx",
]);

/** Metadata routes — emitted by the framework into <head>, never navigated to. */
const METADATA_FILES =
  /^(opengraph-image|twitter-image|icon|apple-icon|sitemap|robots|manifest)\.(tsx?|jsx?)$/;

/**
 * HTTP handlers, not pages. They are reached by `fetch`, not by navigation, so
 * "inbound link" is the wrong question for them — fetch-reachability would be a
 * different script. Counted and reported so a collapse in this set is visible.
 */
const HANDLER_FILES = new Set(["route.ts", "route.tsx", "route.js"]);

/**
 * An alias route: a page that renders nothing and only redirects. Nine of these
 * survive from the pipeline-era URLs (`/projects/[id]/survey`, `/design/cad`,
 * `/costing`, …) and exist precisely so that stale bookmarks and already-sent
 * client emails land on the canvas. Requiring an inbound link would invert their
 * purpose: the product deliberately does not link them.
 *
 * Detected structurally rather than by name — a page module with no `return`
 * statement whose body calls a redirect helper. A real page always returns its
 * tree, so adding a `return` to one of these turns it back into a gated route,
 * which is the fail-loud direction.
 */
function isAliasRoute(source) {
  return !/\breturn\b/.test(source) && /\bredirect[A-Za-z]*\s*\(/.test(source);
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const rel = (f) => f.replace(/\\/g, "/");

/** Comments are not links. See the header note about the silenced gate. */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

if (!fs.existsSync(APP_DIR) || !fs.statSync(APP_DIR).isDirectory()) {
  console.error(
    `FAIL: the app directory ${APP_DIR} does not exist.\n` +
    "This gate cannot enumerate routes, so it cannot report anything. Repoint\n" +
    "APP_DIR at the real location — do not let it pass by finding nothing.",
  );
  process.exit(1);
}

/* ---------------------------------------------------------------- inventory */

const appFiles = walk(APP_DIR).map(rel);

/** route pattern -> defining file */
const routes = new Map();
/** route pattern -> defining file, for redirect-only legacy URLs */
const aliases = new Map();
const framework = [];
const metadata = [];
const handlers = [];
const colocated = [];

for (const file of appFiles) {
  const base = path.basename(file);
  const segments = path
    .dirname(file.slice(APP_DIR.length + 1))
    .split("/")
    .filter((seg) => seg !== "." && seg !== "")
    // Route groups `(marketing)` and private folders `_lib` never reach a URL.
    .filter((seg) => !/^\(.*\)$/.test(seg));

  if (/^page\.(tsx|ts|jsx|js)$/.test(base)) {
    const route = segments.length ? `/${segments.join("/")}` : "/";
    const source = stripComments(fs.readFileSync(file, "utf8"));
    if (isAliasRoute(source)) aliases.set(route, file);
    else routes.set(route, file);
  } else if (HANDLER_FILES.has(base)) {
    handlers.push(file);
  } else if (FRAMEWORK_FILES.has(base)) {
    framework.push(file);
  } else if (METADATA_FILES.test(base)) {
    metadata.push(file);
  } else if (/\.(tsx|ts)$/.test(base)) {
    colocated.push(file);
  }
}

const pageCount = routes.size + aliases.size;
if (pageCount < MIN_PAGES || routes.size < MIN_GATED_ROUTES) {
  console.error(
    `FAIL: discovered ${pageCount} pages (floor ${MIN_PAGES}), of which ` +
    `${routes.size} are gated routes (floor ${MIN_GATED_ROUTES}), under ${APP_DIR}.\n\n` +
    "A gate that finds nothing reports nothing and reads as green, which is how\n" +
    "three ratchets in this repo lost most of their scope without anyone noticing.\n" +
    "Either the app directory moved, or routes were deleted wholesale. Repoint\n" +
    "APP_DIR, or lower a floor only in the same commit as the deletion.",
  );
  process.exit(1);
}

/* ------------------------------------------------------------- link corpus */

const scope = new Map();
const corpus = new Map();

for (const { dir, min } of LINK_ROOTS) {
  const files = walk(dir)
    .map(rel)
    .filter((f) => /\.(ts|tsx|js|jsx|mjs)$/.test(f))
    // Tests may not vouch for a route — see the header.
    .filter((f) => !/\.test\.(ts|tsx)$/.test(f))
    .filter((f) => !/(^|\/)e2e\//.test(f));
  scope.set(dir, { found: files.length, min });
  for (const f of files) corpus.set(f, stripComments(fs.readFileSync(f, "utf8")));
}

const starved = [...scope.entries()].filter(([, s]) => s.found < s.min);
if (starved.length) {
  console.error(
    "FAIL: a link-corpus root yielded fewer files than its floor. This gate is\n" +
    "not searching what it claims to — a directory was moved, renamed or emptied:\n",
  );
  for (const [dir, s] of starved) {
    console.error(`  ${dir}\n    found ${s.found}, floor ${s.min}`);
  }
  console.error(
    "\nRepoint LINK_ROOTS at the real location. Do not lower a floor to pass:\n" +
    "an empty corpus makes every route look unreachable, which invites\n" +
    "allowlisting the world.",
  );
  process.exit(1);
}

/* --------------------------------------------------------- href extraction */

/** String literals: "…", '…', `…`. Escapes respected; a backtick inside a
 *  `${…}` hole would end a template early, which is rare enough to accept. */
const STRING_LITERAL =
  /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g;

/**
 * Code shapes that actually point a browser at a URL. Anchored to the end of the
 * text immediately preceding the literal, so the marker has to be what
 * introduces it.
 *
 * This is the line between "the string exists" and "a user can get there". Drop
 * it and every Fastify route registration and `apiFetch` path in the repo starts
 * vouching for the page route it happens to resemble: `/settings`,
 * `/share/[token]` and five `/projects/[id]/*` pages all read as linked on the
 * first run of this gate purely because the API serves same-shaped endpoints.
 *
 * The second alternative covers a nav table entry — `href: (projectId) => `/…``
 * — because that is a navigation site too, and without it every data-driven nav
 * in the app is invisible. It still requires the *property* to be an href, so a
 * bare `(id) => `/api/…`` helper does not qualify.
 */
const NAV_MARKER =
  "(?:[Hh]ref|HREF|formAction|\\.push|\\.replace|\\.assign|\\breplace|\\bredirect" +
  "|\\bpermanentRedirect|_url|Url|_URL)";

const NAV_CONTEXT = new RegExp(
  // `href="…"` · `href={…}` · `router.push("…")` · `success_url: "…"`
  `${NAV_MARKER}\\s*[:=(,]\\s*(?:\\{\\s*)?$` +
  // `href: (projectId) => "…"` · `href: id => "…"`
  `|${NAV_MARKER}\\s*[:=]\\s*(?:\\([^)]*\\)|[A-Za-z0-9_$]+)\\s*=>\\s*(?:\\{?\\s*return\\s*)?$`,
);

/**
 * `${apiBase}/x` and `https://host/x` both navigate to `/x`. Strip a leading
 * template hole or scheme+host so the matcher only ever sees a root-relative
 * path; anything that does not start with `/` afterwards is not a route link.
 */
function normaliseHref(raw) {
  return raw
    .replace(/^\$\{[^}]*\}/, "")
    .replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, "");
}

function collectNavHrefs(content) {
  const found = [];
  for (const m of content.matchAll(STRING_LITERAL)) {
    const before = content.slice(Math.max(0, m.index - 80), m.index);
    if (!NAV_CONTEXT.test(before)) continue;
    const href = normaliseHref(m[0].slice(1, -1));
    if (href.startsWith("/")) found.push(href);
  }
  return found;
}

/** file -> navigable hrefs found in it */
const navHrefs = new Map();
let navHrefCount = 0;
for (const [f, content] of corpus) {
  const hrefs = collectNavHrefs(content);
  if (hrefs.length) {
    navHrefs.set(f, hrefs);
    navHrefCount += hrefs.length;
  }
}

if (navHrefCount < MIN_NAV_HREFS) {
  console.error(
    `FAIL: extracted only ${navHrefCount} navigable hrefs, floor is ${MIN_NAV_HREFS}.\n\n` +
    "The extractor, not the product, is what broke: a repo that links nowhere\n" +
    "would fail every route at once. Fix NAV_CONTEXT / STRING_LITERAL rather\n" +
    "than allowlisting the fallout.",
  );
  process.exit(1);
}

/* ----------------------------------------------------------------- matching */

const escapeLiteral = (seg) => seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** One URL segment: a template hole `${projectId}`, or a literal id. */
const ONE_SEGMENT = "(?:\\$\\{[^}]*\\}|[^/\"'`\\s?#<>]+)";
/** A catch-all segment may span slashes. */
const MANY_SEGMENTS = "(?:\\$\\{[^}]*\\}|[^\"'`\\s?#<>]+)";

/**
 * Turn `/projects/[id]/tasks` into a regex anchored at the start of an href.
 *
 * The trailing boundary rejects `/` deliberately: without it a link to
 * `/projects/${id}/tasks` would also vouch for `/projects/[id]`, and every
 * parent route would inherit its children's reachability. Each route earns its
 * own link.
 *
 * The site root is its own case. Built from zero segments it would produce a
 * bare boundary assertion that can never match a href — every href starts with
 * the `/` the boundary rejects — so `/` would read as unreachable forever and
 * its ALLOW entry could never go stale. It matches the literal `"/"` instead.
 */
function routeMatcher(route) {
  const segments = route.split("/").filter(Boolean);
  if (segments.length === 0) return /^\/(?![A-Za-z0-9_/-])/;
  let source = "";
  for (const seg of segments) {
    if (/^\[\[\.\.\..+\]\]$/.test(seg)) {
      // `/sign-in/[[...sign-in]]` also serves `/sign-in`, so the whole segment,
      // leading slash included, is optional.
      source += `(?:/${MANY_SEGMENTS})?`;
    } else if (/^\[\.\.\..+\]$/.test(seg)) {
      source += `/${MANY_SEGMENTS}`;
    } else if (/^\[.+\]$/.test(seg)) {
      source += `/${ONE_SEGMENT}`;
    } else {
      source += `/${escapeLiteral(seg)}`;
    }
  }
  return new RegExp(`^${source}(?![A-Za-z0-9_/-])`);
}

/**
 * A route's own folder may not vouch for it. A page linking to itself — a
 * `?mode=` switch, a retry button, a `loading.tsx` skeleton — is not an entry
 * point.
 */
const ownDirectory = (file) => path.dirname(file);

const report = [];
for (const [route, file] of routes) {
  const matcher = routeMatcher(route);
  const home = ownDirectory(file);
  const linkedFrom = [];
  for (const [f, hrefs] of navHrefs) {
    if (ownDirectory(f) === home) continue;
    const hit = hrefs.find((href) => matcher.test(href));
    if (hit) linkedFrom.push({ file: f, href: hit });
  }
  report.push({ route, file, linkedFrom });
}

/* ------------------------------------------------------------------ verdict */

const orphans = report.filter((r) => r.linkedFrom.length === 0);
const unexpected = orphans.filter((r) => !ALLOW.has(r.route));
const stale = [...ALLOW.keys()].filter(
  (route) => routes.has(route) && !orphans.some((o) => o.route === route),
);
const phantom = [...ALLOW.keys()].filter((route) => !routes.has(route));

if (process.argv.includes("--report")) {
  console.log(`Routes under ${APP_DIR} (${report.length}):\n`);
  for (const r of [...report].sort((a, b) => a.route.localeCompare(b.route))) {
    const status = r.linkedFrom.length
      ? `linked (${r.linkedFrom.length})`
      : ALLOW.has(r.route)
        ? "allowlisted"
        : "ORPHAN";
    console.log(`  ${r.route.padEnd(34)} ${status}`);
    for (const l of r.linkedFrom.slice(0, 4)) {
      console.log(`      <- ${l.href}  (${l.file})`);
    }
    if (r.linkedFrom.length > 4) {
      console.log(`      <- (+${r.linkedFrom.length - 4} more)`);
    }
  }
  console.log(`\nAlias routes — redirect-only legacy URLs (${aliases.size}):\n`);
  for (const route of [...aliases.keys()].sort()) console.log(`  ${route}`);
  console.log(
    `\nNot gated: ${handlers.length} route handlers, ${framework.length} framework files, ` +
    `${metadata.length} metadata routes, ${colocated.length} colocated modules.`,
  );
}

if (unexpected.length) {
  console.error(
    "FAIL: routes that exist but nothing in the product navigates to (unreachable):\n",
  );
  for (const r of unexpected) console.error(`  ${r.route}\n      ${r.file}`);
  console.error(
    "\nA route Next.js serves by filesystem but no user can navigate to has\n" +
    "shipped inert. Link it from where it belongs in the operator's workflow,\n" +
    "delete it outright (no compatibility shim, per CLAUDE.md), or add it to\n" +
    "ALLOW in this script with the reason it is deep-link only. Do not add\n" +
    "entries to make CI quiet — a stale entry fails this gate.",
  );
  process.exit(1);
}

if (stale.length) {
  console.error(
    "FAIL: ALLOW entries that are now reachable — remove them so the ratchet tightens:\n",
  );
  for (const route of stale) console.error(`  ${route}\n      ${ALLOW.get(route)}`);
  process.exit(1);
}

if (phantom.length) {
  console.error("FAIL: ALLOW entries for routes that no longer exist — delete them:\n");
  for (const route of phantom) console.error(`  ${route}`);
  process.exit(1);
}

const scopeNote = [...scope.entries()]
  .map(([dir, s]) => `${dir} ${s.found}/${s.min}`)
  .join(", ");

console.log(
  `ok: ${routes.size} routes, all reachable ` +
  `(${ALLOW.size} allowlisted deep-link entry points; ` +
  `${aliases.size} redirect-only alias routes; ` +
  `${navHrefCount} navigable hrefs across ${navHrefs.size} files; ` +
  `${handlers.length} route handlers and ${framework.length} framework files not gated; ` +
  `corpus ${scopeNote})`,
);
