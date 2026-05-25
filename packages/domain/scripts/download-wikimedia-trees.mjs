/**
 * Download Wikimedia "Set of trees" SVGs (CC BY-SA 4.0) into packages/domain/assets/wikimedia-trees/.
 * Run: node packages/domain/scripts/download-wikimedia-trees.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, "../assets/wikimedia-trees");
const UA = "Workstream/1.0 (catalog import; +https://github.com/Boringuy7799/workstream)";

fs.mkdirSync(outDir, { recursive: true });

async function resolveUrl(fileTitle) {
  const api = new URL("https://commons.wikimedia.org/w/api.php");
  api.searchParams.set("action", "query");
  api.searchParams.set("format", "json");
  api.searchParams.set("titles", fileTitle);
  api.searchParams.set("prop", "imageinfo");
  api.searchParams.set("iiprop", "url");
  const res = await fetch(api, { headers: { "User-Agent": UA } });
  const json = await res.json();
  const pages = json.query?.pages ?? {};
  const page = Object.values(pages)[0];
  return page?.imageinfo?.[0]?.url ?? null;
}

async function downloadOne(n) {
  const num = String(n).padStart(2, "0");
  const title = `File:Set of trees - tree ${num}.svg`;
  const dest = path.join(outDir, `tree-${num}.svg`);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 5000) {
    console.log(`skip ${num} (exists)`);
    return true;
  }
  const url = await resolveUrl(title);
  if (!url) {
    console.error(`no url for ${title}`);
    return false;
  }
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) {
    console.error(`fetch failed ${num}: ${res.status}`);
    return false;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
  console.log(`ok ${num} (${buf.length} bytes)`);
  return true;
}

for (let n = 1; n <= 13; n++) {
  await downloadOne(n);
  await new Promise((r) => setTimeout(r, 2500));
}
