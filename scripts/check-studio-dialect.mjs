/**
 * Dialect lint: frame-rail CSS must not use neumorphic / liquid-glass chip
 * tokens (--hc-neu-*, --hc-glass*) on [data-frame-rail] rules. Floating docks
 * may use glass; flat IDE frame bands must not.
 *
 * Usage: node scripts/check-studio-dialect.mjs
 */
import fs from "fs";
import path from "path";

const ROOT = path.join("apps", "web", "src", "components", "canvas", "handoff");
const BAD_IN_FRAME = /--hc-neu-|--hc-glass/;

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.name.endsWith(".module.css") || ent.name.endsWith(".css"))
      out.push(p);
  }
  return out;
}

const violations = [];

for (const file of walk(ROOT)) {
  const src = fs.readFileSync(file, "utf8");
  // Split roughly by rules containing data-frame-rail
  const re = /\[data-frame-rail\][^{]*\{[^}]*\}/gs;
  let m;
  while ((m = re.exec(src))) {
    const block = m[0];
    if (BAD_IN_FRAME.test(block)) {
      violations.push({
        file: file.replace(/\\/g, "/"),
        snippet: block.slice(0, 120).replace(/\s+/g, " "),
      });
    }
  }
}

if (violations.length) {
  console.error(
    `Studio dialect: ${violations.length} frame-rail rule(s) use glass/neu tokens:`,
  );
  for (const v of violations) {
    console.error(`  ${v.file}: ${v.snippet}…`);
  }
  process.exit(1);
}

console.log("Studio dialect: ok (no neu/glass on [data-frame-rail] rules)");
