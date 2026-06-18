param(
    [switch]$SkipMigrations = $false,
    [switch]$Reload = $false
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$aiRoot = Join-Path $repoRoot "a3-ai-python"
$venvPython = Join-Path $aiRoot ".venv\Scripts\python.exe"
$envFile = Join-Path $aiRoot ".env"
$libreOfficeProgram = "C:\Program Files\LibreOffice\program"
$port = 18081

if (-not (Test-Path $aiRoot)) {
    throw "Cannot find AI service directory: $aiRoot"
}

if (-not (Test-Path $venvPython)) {
    throw "Cannot find project virtualenv Python: $venvPython. Create .venv inside a3-ai-python first."
}

if (-not (Test-Path $envFile)) {
    throw "Cannot find env file: $envFile. Copy .env.example to .env first."
}

Write-Host "Starting a3-ai-python local service on dedicated port..."
Write-Host "Working directory: $aiRoot"
Write-Host "Python runtime   : $venvPython"
Write-Host "Service URL      : http://127.0.0.1:$port"

Push-Location $aiRoot
try {
    if (Test-Path $libreOfficeProgram) {
        $env:PATH = "$libreOfficeProgram;$env:PATH"
    }

    if (-not $SkipMigrations) {
        Write-Host "Running Alembic migrations..."
        & $venvPython -m alembic upgrade head
    }

    $arguments = @(
        "-m", "uvicorn",
        "app.main:app",
        "--host", "127.0.0.1",
        "--port", "$port"
    )

    if ($Reload) {
        $arguments += "--reload"
    }

    & $venvPython @arguments
}
finally {
    Pop-Location
}
