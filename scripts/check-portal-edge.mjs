import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const portalRoot = path.join(process.cwd(), "apps", "web", "src", "app", "portal");
const serverRouteFiles = new Set(["layout.tsx", "page.tsx", "loading.tsx"]);
const fsImportPattern = /(?:import\s+[^;]*\s+from\s+["'](?:node:)?fs(?:\/promises)?["']|require\(["'](?:node:)?fs(?:\/promises)?["']\))/;
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
  if (fsImportPattern.test(source)) {
    failures.push(`${relative}: imports fs, which is not Edge-safe`);
  }
  if (serverRouteFiles.has(path.basename(file)) && !source.includes('"use client"') && !edgeRuntimePattern.test(source)) {
    failures.push(`${relative}: missing export const runtime = "edge"`);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
