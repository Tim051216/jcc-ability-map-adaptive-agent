param()

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$aiRoot = Join-Path $repoRoot "a3-ai-python"
$venvPython = Join-Path $aiRoot ".venv\Scripts\python.exe"

if (-not (Test-Path $aiRoot)) {
    throw "Cannot find AI service directory: $aiRoot"
}

if (-not (Test-Path $venvPython)) {
    throw "Cannot find project virtualenv Python: $venvPython"
}

Push-Location $aiRoot
try {
    Write-Host "Bootstrapping local AI database and course knowledge..."
    & $venvPython .\scripts\bootstrap_local_ai_data.py
}
finally {
    Pop-Location
}
