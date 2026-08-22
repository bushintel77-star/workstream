/**
 * CI gate: the shared design tokens in `@workstream/ui` and the web palette
 * must agree, by value, or CI fails.
 *
 * Why this exists
 * ---------------
 * `apps/web/src/styles/globals.css:4` states that the web chrome is "Unified
 * with @workstream/ui tokens (packages/ui/src/tokens.ts)". That claim was true
 * by value and false by construction: `packages/ui` is consumed by apps/mobile,
 * **zero files in apps/web import it**, and nothing compared the two. A stated
 * invariant with no mechanism behind it drifts the first time someone edits one
 * side, and the only signal is a designer noticing a colour looks wrong on one
 * platform months later.
 *
 * `packages/ui/src/tokens.ts` already documents the web counterpart for every
 * value in its JSDoc (`base: "#EBEBEB"` — "web `--surface-base`
 * (`--gs-glass-sunken`)"). This gate turns that prose into an executable table.
 *
 * How it cannot silently collapse
 * -------------------------------
 * Three of this repo's ratchets lost 60-93% of their scope in a directory
 * retirement and kept printing `ok`, because a directory walk over a moved path
 * returns an empty list and an empty list reads as "nothing to report". This
 * gate is built so that failure mode is unreachable:
 *
 *  1. It reads two **named files**. A move or rename is a hard read error, not
 *     an empty result.
 *  2. Both sides carry a **scope floor** — the count of `--gs-*` tokens parsed
 *     out of the CSS and the count of pairs actually compared. Fewer than the
 *     floor fails, so a parser that silently stops matching cannot pass.
 *  3. Every colour leaf in `tokens.ts` must be **classified** — either paired
 *     with a web token below, or listed in MOBILE_ONLY with a reason. Adding a
 *     token to `packages/ui` and forgetting the web side fails the gate; it
 *     cannot be ignored by omission.
 *
 * Scope
 * -----
 * Colour only. The type/space/radius/elevation/motion scales in `tokens.ts` are
 * expressed in React Native units (unitless numbers, shadow objects) against a
 * web scale in px/rem with different rung names, so a value comparison would be
 * a false equivalence. Colour is the axis where both sides genuinely hold the
 * same value and where drift is invisible until it ships.
 *
 * Usage:
 *   node scripts/check-ui-token-parity.mjs
 */
import fs from "node:fs";
import vm from "node:vm";

const TOKENS_TS = "packages/ui/src/tokens.ts";
const WEB_CSS = "apps/web/src/styles/color-tokens.css";

/**
 * Floors. Never lower one to make CI pass — repoint the reader instead.
 * At the time of writing: 83 `--gs-*` tokens, 32 compared pairs.
 */
const FLOOR_WEB_TOKENS = 70;
const FLOOR_PAIRS = 30;

/**
 * mobile token path -> web token.
 *
 * A plain string is an exact value match. `{ token, alpha }` is for the two
 * mobile values that are pre-composited rgba() because React Native has no
 * `color-mix()`: the rgb triple must equal the web token and the alpha must
 * equal the percentage web mixes it at.
 *
 * Every entry mirrors the counterpart already named in the tokens.ts JSDoc.
 */
const PAIRS = {
  "surface.base": "--gs-glass-sunken",
  "surface.elevated": "--gs-panel",
  "surface.sunken": "--gs-frame",
  "surface.inverted": "--gs-ink",

  "ink.primary": "--gs-ink",
  "ink.secondary": "--gs-ink-secondary",
  "ink.tertiary": "--gs-ink-muted",
  "ink.inverted": "--gs-chip-active-ink",

  /* web: --line-hairline = color-mix(in srgb, var(--gs-line) 55%, transparent) */
  "line.hairline": { token: "--gs-line", alpha: 0.55 },
  "line.strong": "--gs-line-strong",
  "line.ink": "--gs-ink",

  "accent.default": "--gs-primary",
  "accent.soft": "--gs-primary-quiet",
  "accent.ink": "--gs-primary-ink",
  "accent.bright": "--gs-primary-hover",

  "semantic.ok": "--gs-success",
  "semantic.warn": "--gs-warning",
  "semantic.block": "--gs-conflict",
  "semantic.info": "--gs-ink-secondary",

  "studio.gold": "--gs-gold",
  "studio.goldInk": "--gs-gold-ink",
  "studio.signalBlue": "--gs-signal-blue",
  "studio.signalBlueInk": "--gs-signal-blue-ink",
  "studio.conflict": "--gs-conflict",
  /* web: --gs-conflict-veil = color-mix(in srgb, var(--gs-conflict) 16%, transparent) */
  "studio.conflictSoft": { token: "--gs-conflict", alpha: 0.16 },
  "studio.primary": "--gs-primary",
  "studio.primaryHover": "--gs-primary-hover",
  "studio.primaryPressed": "--gs-primary-pressed",
  "studio.primaryInk": "--gs-primary-ink",
  "studio.primaryQuiet": "--gs-primary-quiet",
  "studio.truth": "--gs-truth",
  "studio.truthInk": "--gs-truth-ink",
};

/**
 * Deliberately unpaired, with the reason. These are the only two values in the
 * mobile palette with no web counterpart: apps/mobile has dark field screens
 * (grid-soil, recording) and apps/web has none, so there is no web token to
 * drift against. Documented as such in tokens.ts.
 */
const MOBILE_ONLY = {
  "ink.invertedSecondary": "field-screen body on charcoal — web has no dark screens",
  "ink.invertedTertiary": "field-screen captions on charcoal — web has no dark screens",
};

function fail(lines) {
  console.error(`FAIL: ${lines.join("\n")}`);
  process.exit(1);
}

/**
 * Evaluate the real exported object rather than regex-approximating it, so the
 * gate compares what apps/mobile actually imports. `as const` / `satisfies` are
 * the only TS syntax in the file; anything else is a loud parse error.
 */
function readMobileTokens() {
  const src = fs.readFileSync(TOKENS_TS, "utf8");
  const body = src
    .replace(/^\s*export\s+const\s+tokens\s*=\s*/m, "")
    .replace(/\bas\s+const\b/g, "")
    .replace(/\bsatisfies\s+[^=;]+(?=;)/g, "")
    .trim()
    .replace(/;$/, "");
  let parsed;
  try {
    parsed = vm.runInNewContext(`(${body})`, Object.create(null), {
      timeout: 2000,
    });
  } catch (err) {
    fail([
      `could not evaluate the token object in ${TOKENS_TS}: ${err.message}`,
      "If new TypeScript syntax was introduced there, teach this reader about it.",
      "Do not delete this gate to get past a parse error.",
    ]);
  }
  if (!parsed?.color) {
    fail([`${TOKENS_TS} parsed, but has no \`color\` block to compare.`]);
  }
  const flat = {};
  (function walk(node, prefix) {
    for (const [k, v] of Object.entries(node)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === "object") walk(v, key);
      else flat[key] = String(v);
    }
  })(parsed.color, "");
  return flat;
}

/** `--gs-*` declarations from the CSS, with one-level `var()` aliases resolved. */
function readWebTokens() {
  const src = fs
    .readFileSync(WEB_CSS, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  const raw = {};
  for (const m of src.matchAll(/(--gs-[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    raw[m[1]] = m[2].trim();
  }
  const resolve = (name, depth = 0) => {
    const v = raw[name];
    if (v === undefined || depth > 8) return v;
    const alias = v.match(/^var\(\s*(--[a-z0-9-]+)\s*\)$/);
    return alias ? resolve(alias[1], depth + 1) : v;
  };
  const resolved = {};
  for (const name of Object.keys(raw)) resolved[name] = resolve(name);
  return resolved;
}

const norm = (hex) => hex.trim().toLowerCase();

function rgbaParts(value) {
  const m = value.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)[\s,/]+([\d.]+)\s*\)$/);
  if (!m) return null;
  return { rgb: [+m[1], +m[2], +m[3]], alpha: +m[4] };
}

function hexToRgb(hex) {
  const h = norm(hex).replace("#", "");
  if (h.length !== 6) return null;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

const mobile = readMobileTokens();
const web = readWebTokens();
const webCount = Object.keys(web).length;

const classified = new Set([...Object.keys(PAIRS), ...Object.keys(MOBILE_ONLY)]);
const problems = [];

/* Every colour leaf must be classified — no drift by silent addition. */
for (const key of Object.keys(mobile)) {
  if (!classified.has(key)) {
    problems.push(
      `  ${TOKENS_TS} has colour \`${key}\` (${mobile[key]}) that this gate does not know about.\n` +
        `    Pair it with a --gs-* token in PAIRS, or list it in MOBILE_ONLY with the reason.`,
    );
  }
}

/* Every classified key must still exist — no drift by silent rename. */
for (const key of classified) {
  if (!(key in mobile)) {
    problems.push(
      `  \`${key}\` is mapped in ${import.meta.url.split("/").pop()} but no longer exists in ${TOKENS_TS}.\n` +
        `    Update the mapping to the new name; do not drop the pair.`,
    );
  }
}

let compared = 0;
for (const [key, spec] of Object.entries(PAIRS)) {
  const mobileValue = mobile[key];
  if (mobileValue === undefined) continue; // already reported above
  const tokenName = typeof spec === "string" ? spec : spec.token;
  const webValue = web[tokenName];
  if (webValue === undefined) {
    problems.push(
      `  ${WEB_CSS} has no \`${tokenName}\` (paired with \`${key}\`).\n` +
        `    Repoint the pair at the token that replaced it.`,
    );
    continue;
  }
  compared += 1;

  if (typeof spec === "string") {
    if (norm(mobileValue) !== norm(webValue)) {
      problems.push(
        `  ${key} = ${mobileValue}   but   ${tokenName} = ${webValue}\n` +
          `    Shared tokens must hold the same value on both platforms.`,
      );
    }
    continue;
  }

  const parts = rgbaParts(mobileValue);
  const webRgb = hexToRgb(webValue);
  if (!parts || !webRgb) {
    problems.push(
      `  ${key} = ${mobileValue} / ${tokenName} = ${webValue}\n` +
        `    Expected a pre-composited rgba() against a hex token; one side changed shape.`,
    );
    continue;
  }
  if (parts.rgb.join() !== webRgb.join()) {
    problems.push(
      `  ${key} = ${mobileValue}   but   ${tokenName} = ${webValue}\n` +
        `    The rgb triple must equal the web token it is mixed from.`,
    );
  }
  if (Math.abs(parts.alpha - spec.alpha) > 1e-6) {
    problems.push(
      `  ${key} alpha ${parts.alpha} but web mixes ${tokenName} at ${spec.alpha}.\n` +
        `    Keep the pre-composited alpha equal to the color-mix percentage.`,
    );
  }
}

/* Floors last, so a real mismatch is reported before a scope complaint. */
if (problems.length) {
  fail([
    "the shared design tokens have drifted between packages/ui and apps/web.",
    "",
    ...problems,
    "",
    `Sources: ${TOKENS_TS} (mobile) and ${WEB_CSS} (web).`,
    "globals.css claims these are unified — keep the claim true or change the claim.",
  ]);
}

if (webCount < FLOOR_WEB_TOKENS || compared < FLOOR_PAIRS) {
  fail([
    "this gate is no longer measuring the surface it claims to.",
    `  --gs-* tokens parsed from ${WEB_CSS}: ${webCount}, floor ${FLOOR_WEB_TOKENS}`,
    `  token pairs compared: ${compared}, floor ${FLOOR_PAIRS}`,
    "",
    "Repoint the reader at the real token source. Do not lower a floor to pass.",
  ]);
}

console.log(
  `ok: ${compared} shared colour tokens agree across packages/ui and apps/web ` +
    `(${webCount} --gs-* tokens read; ${Object.keys(MOBILE_ONLY).length} documented mobile-only).`,
);
