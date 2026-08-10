import fs from "node:fs";

const app = JSON.parse(fs.readFileSync("apps/mobile/app.json", "utf8")).expo;
const eas = JSON.parse(fs.readFileSync("apps/mobile/eas.json", "utf8"));
const failures = [];

if (app.ios?.bundleIdentifier !== "com.curtisandco.workstream") {
  failures.push("iOS bundleIdentifier must be com.curtisandco.workstream");
}
if (app.android?.package !== "com.curtisandco.workstream") {
  failures.push("Android package must be com.curtisandco.workstream");
}
for (const profile of ["base", "preview", "production"]) {
  if (!eas.build?.[profile]) failures.push(`missing EAS build profile: ${profile}`);
}
if (eas.build?.preview?.android?.buildType !== "apk") {
  failures.push("preview Android profile must produce an APK");
}
if (eas.build?.production?.android?.buildType !== "app-bundle") {
  failures.push("production Android profile must produce an app bundle");
}
if (eas.build?.production?.autoIncrement !== true) {
  failures.push("production profile must auto-increment versions");
}

if (failures.length) {
  console.error("FAIL: mobile distribution configuration");
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}

const needsCredentials = JSON.stringify(eas.submit?.production ?? {}).includes(
  "REPLACE_WITH",
);
console.log(
  needsCredentials
    ? "ok: EAS build profiles are production-ready; store credentials remain a human setup step"
    : "ok: EAS build and submit profiles are configured",
);
