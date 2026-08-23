/**
 * Vision-polish capture — Playwright screenshots of the app for the vision
 * agent (DeepSeek-V4-Flash-Vision-Exp in the harness GUI).
 *
 * Usage (run from apps/web):
 *   pnpm --filter @workstream/web exec node scripts/vision-screenshot.mjs
 *
 * Env:
 *   BASE_URL    default http://127.0.0.1:3002  (local dev) — or the production
 *               URL to screenshot public pages
 *   PROJECT_ID  when set, also captures the WebGL studio modes for that project
 *   OUT_DIR     default shots/ (relative to apps/web)
 *
 * Local dev first (studio needs dev-user auth):
 *   copy apps/api/.env.example + apps/web/.env.example to .env
 *   pnpm dev        (api :3001, web :3002)
 *   create a project, then export PROJECT_ID=<id> and re-run this script.
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3002";
const PROJECT_ID = process.env.PROJECT_ID ?? "";
const OUT = path.resolve(process.env.OUT_DIR ?? "shots");
const VIEWPORTS = [
  [1600, 950],
  [1280, 720],
  [960, 640],
];

const routes = ["/home", "/settings"];
if (PROJECT_ID) {
  routes.push(
    `/projects/${PROJECT_ID}?webgl=1&mode=survey`,
    `/projects/${PROJECT_ID}?webgl=1&mode=sketch`,
    `/projects/${PROJECT_ID}?webgl=1&mode=quote`,
  );
}

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

let saved = 0;
for (const route of routes) {
  for (const [w, h] of VIEWPORTS) {
    await page.setViewportSize({ width: w, height: h });
    try {
      await page.goto(BASE + route, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      // Let the studio boot (dynamic import + R3F mount) before shooting.
      await page.waitForTimeout(3000);
      const name = `${route.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "")}_${w}x${h}.png`;
      await page.screenshot({ path: path.join(OUT, name) });
      console.log("saved", name);
      saved++;
    } catch (err) {
      console.log("skip", route, `${w}x${h}`, String(err.message).slice(0, 80));
    }
  }
}

await browser.close();
console.log(`done — ${saved} screenshots in ${OUT}`);
