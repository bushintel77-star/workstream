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
  $apiUrl = "https://api-production-a8ff1.up.railway.app"
  docker build -f apps/api/Dockerfile -t workstream-api:local .
  docker build -f apps/web/Dockerfile --build-arg "NEXT_PUBLIC_API_URL=$apiUrl" -t workstream-web:local .
  Write-Host "Docker images: workstream-api:local, workstream-web:local"
}
