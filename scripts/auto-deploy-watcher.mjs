/**
 * Workstream auto-deploy watcher — GitLab main → Railway, no CI compute.
 *
 * Polls the GitLab API for the head of `main`; when it moves past the last
 * deployed SHA it fires `railway up` for web and api via the local Railway
 * CLI (auth from ~/.railway/config.json). State lives in
 * %USERPROFILE%\.workstream-auto-deploy.json (which also carries the
 * GitLab PAT used for polling). Durable while this machine is on; the
 * GitLab CI `deploy-railway` stage covers pushes from any machine once the
 * account's CI compute is validated.
 *
 * Registered at HKCU\...\Run as "WorkstreamAutoDeploy" (no admin needed).
 */

import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const CONFIG = path.join(os.homedir(), ".workstream-auto-deploy.json");
const GITLAB_HEAD =
  "https://gitlab.com/api/v4/projects/77999-group1%2F77999-project/repository/commits/main";
const RAILWAY_PROJECT = "e2c12b66-af3a-4a51-a285-874c7a6de7d4";
const POLL_MS = 60_000;

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG, "utf8"));
  } catch {
    return {};
  }
}

function writeConfig(cfg) {
  fs.writeFileSync(CONFIG, JSON.stringify(cfg, null, 2));
}

function log(msg) {
  console.log(`[auto-deploy ${new Date().toISOString()}] ${msg}`);
}

function deploy(service, sha, title) {
  return new Promise((resolve) => {
    const args = [
      "up",
      "--project",
      RAILWAY_PROJECT,
      "--service",
      service,
      "--environment",
      "production",
      "--detach",
      "-m",
      `auto-deploy ${sha.slice(0, 8)}: ${title}`,
    ];
    const child = execFile("railway", args, { stdio: "inherit" });
    child.on("exit", (code) => {
      log(`${service} up exit ${code}`);
      resolve(code ?? 1);
    });
    child.on("error", (err) => {
      log(`${service} spawn error: ${err.message}`);
      resolve(1);
    });
  });
}

async function poll() {
  const cfg = readConfig();
  if (!cfg.gitlabToken) {
    log("no gitlabToken in config — set it in ~/.workstream-auto-deploy.json");
    return;
  }
  try {
    const res = await fetch(GITLAB_HEAD, {
      headers: { "PRIVATE-TOKEN": cfg.gitlabToken },
    });
    if (!res.ok) {
      log(`gitlab api ${res.status}`);
      return;
    }
    const commit = await res.json();
    if (commit.id === cfg.lastSha) return;
    log(
      `new main ${commit.id.slice(0, 8)} (was ${cfg.lastSha ? cfg.lastSha.slice(0, 8) : "none"}) — ${commit.title}`,
    );
    await deploy("web", commit.id, commit.title);
    await deploy("api", commit.id, commit.title);
    writeConfig({
      ...cfg,
      lastSha: commit.id,
      lastDeployAt: new Date().toISOString(),
      lastTitle: commit.title,
    });
  } catch (err) {
    log(`poll error: ${err && err.message ? err.message : String(err)}`);
  }
}

log("watcher started (60s poll)");
poll();
setInterval(poll, POLL_MS);
