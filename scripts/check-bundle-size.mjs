import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const budgetPath = path.join(root, "scripts", "bundle-size-budget.json");
const budget = JSON.parse(fs.readFileSync(budgetPath, "utf8"));

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file, files);
    else files.push(file);
  }
  return files;
}

let failed = false;
for (const [name, rule] of Object.entries(budget)) {
  const directory = path.join(root, rule.directory);
  if (!fs.existsSync(directory)) {
    console.error(`FAIL: ${name} bundle directory is missing: ${rule.directory}`);
    failed = true;
    continue;
  }
  const files = walk(directory);
  const totalBytes = files.reduce((total, file) => total + fs.statSync(file).size, 0);
  const javascriptBytes = files
    .filter((file) => file.endsWith(".js"))
    .reduce((total, file) => total + fs.statSync(file).size, 0);
  const totalMiB = (totalBytes / 1_000_000).toFixed(2);
  const javascriptMiB = (javascriptBytes / 1_000_000).toFixed(2);
  console.log(`${name}: ${totalMiB} MB chunks, ${javascriptMiB} MB JavaScript`);
  if (totalBytes > rule.maxBytes) {
    console.error(
      `FAIL: ${name} chunks ${totalBytes} bytes exceeds ${rule.maxBytes} byte budget`,
    );
    failed = true;
  }
  if (javascriptBytes > rule.maxJavaScriptBytes) {
    console.error(
      `FAIL: ${name} JavaScript ${javascriptBytes} bytes exceeds ${rule.maxJavaScriptBytes} byte budget`,
    );
    failed = true;
  }
}

if (failed) process.exit(1);
