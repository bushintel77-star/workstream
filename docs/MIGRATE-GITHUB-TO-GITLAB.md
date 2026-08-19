# Migrate the repo from GitHub to GitLab — DONE 2026-08-19

Status: **completed**. Live repo: `https://gitlab.com/77999-group1/77999-project`
(group `77999-group1`, project `77999-project`, default branch `main`).
Local remotes: `origin` = GitLab, `github` = frozen GitHub archive.
`main` was pushed 2026-08-19 (`a358967`) and GitLab CI (`.gitlab-ci.yml`)
runs on it. Steps below are the historical record.

Why: the GitHub account is frozen on a failed payment (a paid plan charge that
debit cards could not settle), which paused Actions and stalled Railway
git-linked builds. GitLab.com Free gives the same needs for $0 — private
repos, branch-protection rules, and shared-runner CI minutes — and Railway
deploys from it.

## 1. Create the GitLab project (your hands, one time)

1. Sign in (or sign up) at https://gitlab.com.
2. New project → **Create blank project**:
   - Project name: `workstream`
   - Visibility: **Private**
   - **Untick** "Initialize repository with a README" (we push the existing repo).
3. Note the project URL, e.g. `https://gitlab.com/<username>/workstream.git`.

## 2. Push the existing repo (from this working tree)

The code is all local, so we push rather than "import" (GitHub import needs a
GitHub token, which a frozen account may refuse).

```powershell
# keep GitHub as an upstream backup (optional but reversible)
git remote rename origin github

# point origin at GitLab
git remote add origin https://gitlab.com/<username>/workstream.git

# push the product branch (AGENTS.md: single branch, main is canonical)
git push -u origin main

# optional: push all local feature/agent branches
git push -u origin --all

# optional: push tags
git push -u origin --tags
```

GitLab will prompt for your username + a **personal access token** (or a
GitLab password). Use HTTPS + token: GitLab → Settings → Access Tokens →
`write_repository` scope.

## 3. Turn on branch protection (the GitHub-Pro feature, now free)

1. Project → **Settings → Repository → Protected branches**.
2. Protect `main`:
   - Allowed to push: **No one** (or Maintainers only).
   - Allowed to merge: **Maintainers**.
3. Optionally require the CI pipeline to pass before merge:
   **Settings → Merge requests → Pipelines must succeed**.

## 4. Re-point Railway

Railway's git auto-deploy was GitHub-linked. Two options:

- **Keep CLI deploys (works today, no account change):**
  `railway up --detach --service <web|api> --environment production`
- **Restore git auto-deploy:**
  Railway dashboard → project **Settings → Source Repo → disconnect GitHub →
  connect GitLab** → select the new repo. Auto-deploys resume on push to `main`.

## 5. Verify

- Push a commit to `main` and watch the GitLab **CI/CD → Pipelines** page:
  `gate` → `secret-scan` → `e2e` (allowed to fail) + docker builds.
- Confirm `gate` runs `pnpm run ci` green (it is green locally as of
  2026-08-19).

## 6. Cleanup (after everything is green on GitLab)

- Delete `.github/` (the retired Actions workflows) once you are sure you will
  not return to GitHub. Keeping it is harmless but inert.
- Update any lingering docs that still say "GitHub" (grep for `GitHub`).

## Notes

- The `github:` entries in `packages/domain/package.json` are **third-party
  npm dependencies** (osmic / open-crop-icons), not this repo — leave them.
- `pnpm run ci` is provider-agnostic and stays the local gate.
