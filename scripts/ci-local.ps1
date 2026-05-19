# Mirror GitHub CI locally (typecheck + test + optional docker builds).
param(
  [switch]$Docker
)
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

pnpm install --frozen-lockfile
pnpm typecheck
pnpm test

if ($Docker) {
  $apiUrl = "https://construct-api.fly.dev"
  docker build -f apps/api/Dockerfile -t construct-api:local .
  docker build -f apps/web/Dockerfile --build-arg "NEXT_PUBLIC_API_URL=$apiUrl" -t construct-web:local .
  Write-Host "Docker images: construct-api:local, construct-web:local"
}
