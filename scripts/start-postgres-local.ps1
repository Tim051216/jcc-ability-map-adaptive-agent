param(
    [switch]$RestartAi = $false
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$composeFile = Join-Path $repoRoot "docker-compose.local.yml"
$dockerCommand = Get-Command docker -ErrorAction SilentlyContinue
$dockerExe = if ($dockerCommand) { $dockerCommand.Source } else { $null }
$venvPython = Join-Path $repoRoot "a3-ai-python\.venv\Scripts\python.exe"
$aiRoot = Join-Path $repoRoot "a3-ai-python"
$aiStdout = Join-Path $aiRoot ".codex-uvicorn.out.log"
$aiStderr = Join-Path $aiRoot ".codex-uvicorn.err.log"

if (-not (Test-Path $composeFile)) {
    throw "Cannot find compose file: $composeFile"
}

if (-not $dockerExe) {
    throw "Cannot find docker on PATH. Install and start Docker Desktop first."
}

Write-Host "Starting local PostgreSQL container..."
& $dockerExe compose -f $composeFile up -d postgres

$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    try {
        $conn = Get-NetTCPConnection -LocalPort 15432 -State Listen -ErrorAction Stop
        if ($conn) {
            $ready = $true
            break
        }
    }
    catch {
        Start-Sleep -Seconds 2
    }
}

if (-not $ready) {
    throw "PostgreSQL port 15432 did not become ready in time."
}

Write-Host "PostgreSQL is listening on 127.0.0.1:15432"

if ($RestartAi) {
    if (-not (Test-Path $venvPython)) {
        throw "Cannot find AI virtualenv Python: $venvPython"
    }

    $existing = Get-NetTCPConnection -LocalPort 18080 -State Listen -ErrorAction SilentlyContinue |
        Select-Object -First 1 -ExpandProperty OwningProcess
    if ($existing) {
        Write-Host "Stopping existing AI service process: $existing"
        Stop-Process -Id $existing -Force
        Start-Sleep -Seconds 2
    }

    Write-Host "Restarting a3-ai-python so it can switch back to POSTGRES_DSN..."
    Start-Process -FilePath $venvPython `
        -ArgumentList @('-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '18080') `
        -WorkingDirectory $aiRoot `
        -RedirectStandardOutput $aiStdout `
        -RedirectStandardError $aiStderr `
        -WindowStyle Hidden
}

Write-Host "Done."
