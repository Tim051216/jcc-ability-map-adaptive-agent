param(
  [int]$Port = 3002,
  [switch]$NoOpen
)

$ErrorActionPreference = "Stop"
$studentWeb = Join-Path $PSScriptRoot "..\a3-student-react-web"
if (-not (Test-Path (Join-Path $studentWeb "package.json"))) {
  throw "Student web directory not found: $studentWeb"
}
Set-Location $studentWeb
if (-not (Test-Path "node_modules")) {
  Write-Host "Installing dependencies for the first run..." -ForegroundColor Yellow
  npm ci
}
$url = "http://127.0.0.1:$Port/annotation-agent"
Write-Host "AI annotation training page: $url" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop. For LAN trials, replace 127.0.0.1 with the host WLAN IPv4." -ForegroundColor DarkGray
if (-not $NoOpen) {
  Start-Process $url
}
npm run dev -- --port $Port --host 0.0.0.0
