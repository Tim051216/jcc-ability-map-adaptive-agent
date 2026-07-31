param(
    [switch]$ForceEnv,
    [switch]$ForceDependencies,
    [switch]$SkipPython,
    [switch]$SkipFrontend
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$repoRoot = Split-Path -Parent $PSScriptRoot
$aiRoot = Join-Path $repoRoot "a3-ai-python"
$studentRoot = Join-Path $repoRoot "a3-student-react-web"
$adminRoot = Join-Path $repoRoot "a3-admin-web"

function Assert-Command {
    param([string]$Name, [string]$InstallHint)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command '$Name' was not found. $InstallHint"
    }
}

function Copy-TemplateIfNeeded {
    param([string]$Template, [string]$Destination)
    if ((Test-Path $Destination) -and -not $ForceEnv) {
        Write-Host "KEEP config: $Destination"
        return
    }
    if (-not (Test-Path $Template)) {
        throw "Configuration template is missing: $Template"
    }
    Copy-Item -LiteralPath $Template -Destination $Destination -Force
    Write-Host "WRITE config: $Destination"
}

function Get-PythonLauncher {
    $candidates = @(
        @{ Command = "py"; Prefix = @("-3.12") },
        @{ Command = "python"; Prefix = @() },
        @{ Command = "python3"; Prefix = @() }
    )
    foreach ($candidate in $candidates) {
        if (-not (Get-Command $candidate.Command -ErrorAction SilentlyContinue)) { continue }
        $version = & $candidate.Command @($candidate.Prefix) -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>$null
        if ($LASTEXITCODE -eq 0 -and $version -match '^(3\.1[2-9]|[4-9]\.)') { return $candidate }
    }
    throw "Python 3.12 or newer was not found. Install Python 3.12 and enable the py launcher or PATH entry."
}

function Install-NodeDependencies {
    param([string]$Directory, [string]$Name)
    $nodeModules = Join-Path $Directory "node_modules"
    $lockFile = Join-Path $Directory "package-lock.json"
    $marker = Join-Path $nodeModules ".a3-package-lock.sha256"
    $lockHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $lockFile).Hash
    $installedHash = if (Test-Path $marker) { (Get-Content -LiteralPath $marker -Raw).Trim() } else { "" }
    if ((Test-Path $nodeModules) -and $installedHash -eq $lockHash -and -not $ForceDependencies) {
        Write-Host "KEEP dependencies: $Name"
        return
    }
    Write-Host "INSTALL dependencies: $Name"
    Push-Location $Directory
    try {
        & npm.cmd ci --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) { throw "npm ci failed for $Name" }
        Set-Content -LiteralPath $marker -Value $lockHash -Encoding ASCII
    } finally {
        Pop-Location
    }
}

Set-Location $repoRoot
Assert-Command "git" "Install Git for Windows: https://git-scm.com/download/win"
Assert-Command "docker" "Install Docker Desktop: https://www.docker.com/products/docker-desktop/"
Assert-Command "java" "Install a JDK (17 recommended): https://adoptium.net/"

if (-not $SkipFrontend) {
    Assert-Command "node" "Install Node.js 20 LTS: https://nodejs.org/"
    Assert-Command "npm.cmd" "npm is included with Node.js."
    $nodeMajor = [int]((& node --version).TrimStart('v').Split('.')[0])
    if ($nodeMajor -lt 20) {
        throw "Node.js 20 or newer is required. Current version: $(& node --version)"
    }
}

Copy-TemplateIfNeeded -Template (Join-Path $aiRoot ".env.local.example") -Destination (Join-Path $aiRoot ".env")
Copy-TemplateIfNeeded -Template (Join-Path $studentRoot ".env.example") -Destination (Join-Path $studentRoot ".env.local")

if (-not $SkipPython) {
    $venvPython = Join-Path $aiRoot ".venv\Scripts\python.exe"
    if (-not (Test-Path $venvPython)) {
        $launcher = Get-PythonLauncher
        Write-Host "CREATE Python virtual environment: $aiRoot\.venv"
        & $launcher.Command @($launcher.Prefix) -m venv (Join-Path $aiRoot ".venv")
        if ($LASTEXITCODE -ne 0) { throw "Python virtual environment creation failed." }
    }
    $pythonMarker = Join-Path $aiRoot ".venv\.a3-pyproject.sha256"
    $pyprojectHash = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $aiRoot "pyproject.toml")).Hash
    $installedPythonHash = if (Test-Path $pythonMarker) { (Get-Content -LiteralPath $pythonMarker -Raw).Trim() } else { "" }
    if ($ForceDependencies -or $installedPythonHash -ne $pyprojectHash) {
        Write-Host "INSTALL Python dependencies"
        & $venvPython -m pip install --upgrade pip setuptools wheel
        if ($LASTEXITCODE -ne 0) { throw "pip bootstrap failed." }
        & $venvPython -m pip install -e "$($aiRoot)[dev]"
        if ($LASTEXITCODE -ne 0) { throw "AI dependency installation failed." }
        Set-Content -LiteralPath $pythonMarker -Value $pyprojectHash -Encoding ASCII
    } else {
        Write-Host "KEEP dependencies: a3-ai-python"
    }
}

if (-not $SkipFrontend) {
    Install-NodeDependencies -Directory $studentRoot -Name "student web"
    Install-NodeDependencies -Directory $adminRoot -Name "admin web"
}

Write-Host ""
Write-Host "Local setup is ready. Start everything with:"
Write-Host "powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-full-local.ps1"
