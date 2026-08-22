/**
 * Self-test for `check-route-reachability.mjs`: proves the gate fails when it
 * should, on every failure mode it claims to have.
 *
 * A gate nobody has watched fail is a green narrative, not a gate. Two of this
 * repo's ratchets were silently no-ops for days — one because a directory move
 * emptied its scope, one because a comment naming the component it hunted read
 * as a reference. Both printed "ok" throughout. This runs the real, unmodified
 * gate against scratch copies of the tree, each mutated into one of those
 * failure shapes, and asserts the exit code and the message.
 *
 * It never edits the gate under test. The stale/phantom cases exercise the real
 * ALLOW map by making its permanently-allowlisted `/` entry reachable, then by
 * deleting the route it names.
 *
 * Usage: node scripts/check-route-reachability.selftest.mjs
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const repo = process.cwd();
const gate = path.join(repo, "scripts", "check-route-reachability.mjs");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "route-reach-selftest-"));

/** A fresh scratch copy of everything the gate reads. */
function scratch(name) {
  const dir = path.join(root, name);
  for (const tree of ["apps/web/src", "apps/api/src"]) {
    fs.cpSync(path.join(repo, tree), path.join(dir, tree), { recursive: true });
  }
  return dir;
}

function run(cwd) {
  try {
    const stdout = execFileSync(process.execPath, [gate], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, out: stdout };
  } catch (err) {
    return { code: err.status ?? -1, out: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}

const write = (dir, file, body) => {
  const target = path.join(dir, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, body, "utf8");
};

const ORPHAN = "apps/web/src/app/zz-selftest/page.tsx";
const NOTE = "apps/web/src/lib/zz-selftest-note.ts";

const cases = [
  {
    name: "baseline tree passes",
    expect: 0,
    contains: "all reachable",
    build: () => scratch("baseline"),
  },
  {
    name: "a route nothing links to fails",
    expect: 1,
    contains: "nothing in the product navigates to",
    build: () => {
      const dir = scratch("orphan");
      write(dir, ORPHAN, "export default function P() {\n  return <main />;\n}\n");
      return dir;
    },
  },
  {
    name: "a comment naming the route does not rescue it",
    expect: 1,
    contains: "nothing in the product navigates to",
    build: () => {
      const dir = scratch("comment");
      write(dir, ORPHAN, "export default function P() {\n  return <main />;\n}\n");
      write(
        dir,
        NOTE,
        '/* Mounted at href="/zz-selftest" via router.push("/zz-selftest"). */\n' +
          'export const NOTE = "prose is not a link";\n',
      );
      return dir;
    },
  },
  {
    name: "a real link rescues it",
    expect: 0,
    contains: "all reachable",
    build: () => {
      const dir = scratch("linked");
      write(dir, ORPHAN, "export default function P() {\n  return <main />;\n}\n");
      write(dir, NOTE, 'export const LINK = { href: "/zz-selftest" };\n');
      return dir;
    },
  },
  {
    name: "a redirect-only page is classified as a legacy alias, not an orphan",
    expect: 0,
    contains: "redirect-only alias routes",
    build: () => {
      const dir = scratch("alias");
      write(
        dir,
        ORPHAN,
        'import { redirect } from "next/navigation";\n\n' +
          "export default function P() {\n  redirect(`/home`);\n}\n",
      );
      return dir;
    },
  },
  {
    name: "an allowlisted route that became reachable fails as stale",
    expect: 1,
    contains: "now reachable",
    build: () => {
      const dir = scratch("stale");
      // `/share/[token]` is allowlisted as emailed-deep-link-only. Give the
      // operator chrome a link to it and the allowlist entry must go.
      write(dir, NOTE, "export const LINK = { href: `/share/${1}` };\n");
      return dir;
    },
  },
  {
    name: "an allowlist entry for a deleted route fails as phantom",
    expect: 1,
    contains: "no longer exist",
    build: () => {
      const dir = scratch("phantom");
      fs.rmSync(path.join(dir, "apps/web/src/app/share"), {
        recursive: true,
        force: true,
      });
      return dir;
    },
  },
  {
    name: "an app-directory retirement trips the scope floor",
    expect: 1,
    contains: "floor",
    build: () => {
      const dir = scratch("floor");
      const appDir = path.join(dir, "apps/web/src/app");
      for (const entry of fs.readdirSync(appDir)) {
        if (entry !== "home") {
          fs.rmSync(path.join(appDir, entry), { recursive: true, force: true });
        }
      }
      return dir;
    },
  },
  {
    name: "a corpus retirement trips the corpus floor",
    expect: 1,
    contains: "fewer files than its floor",
    build: () => {
      const dir = scratch("corpus");
      fs.rmSync(path.join(dir, "apps/api/src"), { recursive: true, force: true });
      return dir;
    },
  },
];

let failed = 0;
try {
  for (const testCase of cases) {
    const { code, out } = run(testCase.build());
    const ok = code === testCase.expect && out.includes(testCase.contains);
    console.log(`${ok ? "  ok  " : "FAIL  "}${testCase.name}`);
    if (!ok) {
      failed += 1;
      console.error(
        `        expected exit ${testCase.expect} containing ${JSON.stringify(testCase.contains)},\n` +
          `        got exit ${code}:\n${out.replace(/^/gm, "        | ")}`,
      );
    }
  }
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

if (failed) {
  console.error(
    `\nFAIL: ${failed} of ${cases.length} route-reachability failure modes did not fire.\n` +
      "The gate is not gating what its docstring claims. Fix the gate, not this file.",
  );
  process.exit(1);
}

console.log(`ok: ${cases.length} route-reachability failure modes all fire`);
