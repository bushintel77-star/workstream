# Deploy Workstream to existing Fly apps (construct-api + construct-web).
# Product: Workstream. Fly hostnames unchanged until workstream-* cutover.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$ApiUrl = "https://construct-api.fly.dev"

Write-Host "==> construct-api"
flyctl deploy --config apps/api/fly.toml --dockerfile apps/api/Dockerfile -a construct-api --remote-only
flyctl scale count 1 -a construct-api

Write-Host "==> construct-web"
flyctl deploy --config apps/web/fly.toml --dockerfile apps/web/Dockerfile -a construct-web --remote-only `
  --build-arg "NEXT_PUBLIC_API_URL=$ApiUrl"

Write-Host "==> smoke"
Invoke-RestMethod -Uri "$ApiUrl/healthz"
$r = Invoke-WebRequest -Uri "https://construct-web.fly.dev/" -UseBasicParsing
Write-Host "construct-web HTTP $($r.StatusCode)"
Write-Host "Done."
