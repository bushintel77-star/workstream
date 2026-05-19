# Deploy api + web to Fly (same as CI deploy job).
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

$ApiUrl = if ($env:NEXT_PUBLIC_API_URL) { $env:NEXT_PUBLIC_API_URL } else { "https://construct-api.fly.dev" }

Write-Host "==> construct-api"
flyctl deploy --config apps/api/fly.toml --dockerfile apps/api/Dockerfile `
  -a construct-api --remote-only

Write-Host "==> construct-web (NEXT_PUBLIC_API_URL=$ApiUrl)"
flyctl deploy --config apps/web/fly.toml --dockerfile apps/web/Dockerfile `
  -a construct-web --remote-only `
  --build-arg "NEXT_PUBLIC_API_URL=$ApiUrl"

Write-Host "==> smoke"
Invoke-RestMethod -Uri "https://construct-api.fly.dev/healthz"
$r = Invoke-WebRequest -Uri "https://construct-web.fly.dev/" -UseBasicParsing
Write-Host "construct-web HTTP $($r.StatusCode)"
