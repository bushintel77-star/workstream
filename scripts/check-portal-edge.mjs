import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const portalRoot = path.join(process.cwd(), "apps", "web", "src", "app", "portal");
const edgeRouteFiles = new Set(["layout.tsx", "page.tsx", "loading.tsx", "error.tsx"]);
const nodeOnlyImports = [
  "child_process",
  "cluster",
  "crypto",
  "fs",
  "http",
  "https",
  "net",
  "os",
  "path",
  "stream",
  "tls",
  "zlib",
];
const nodeOnlyImportPattern = new RegExp(
  `(?:import\\s+[^;]*\\s+from\\s+["'](?:node:)?(?:${nodeOnlyImports.join("|")})(?:/promises)?["']|require\\(["'](?:node:)?(?:${nodeOnlyImports.join("|")})(?:/promises)?["']\\))`,
);
const edgeRuntimePattern = /export\s+const\s+runtime\s*=\s*["']edge["']/;

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

const failures = [];
const files = await walk(portalRoot);

for (const file of files) {
  const source = await readFile(file, "utf8");
  const relative = path.relative(process.cwd(), file);
  if (nodeOnlyImportPattern.test(source)) {
    failures.push(`${relative}: imports a Node-only module, which is not Edge-safe`);
  }
  if (edgeRouteFiles.has(path.basename(file)) && !edgeRuntimePattern.test(source)) {
    failures.push(`${relative}: missing export const runtime = "edge"`);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
