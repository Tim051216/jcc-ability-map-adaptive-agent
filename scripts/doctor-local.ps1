param([switch]$RequireServices)

$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$repoRoot = Split-Path -Parent $PSScriptRoot
$failures = 0

function Report {
    param([bool]$Ok, [string]$Name, [string]$Detail)
    if ($Ok) {
        Write-Host ("OK   {0,-24} {1}" -f $Name, $Detail) -ForegroundColor Green
    } else {
        Write-Host ("FAIL {0,-24} {1}" -f $Name, $Detail) -ForegroundColor Red
        $script:failures++
    }
}

function Test-Port {
    param([int]$Port)
    $client = [System.Net.Sockets.TcpClient]::new()
    try {
        $result = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
        if (-not $result.AsyncWaitHandle.WaitOne(400, $false)) { return $false }
        $client.EndConnect($result)
        return $true
    } catch { return $false } finally { $client.Dispose() }
}

Write-Host "A3 local environment doctor"
Write-Host "Repository: $repoRoot"
Write-Host ""

$commands = @(
    @{ Name = "git"; Hint = "Git for Windows" },
    @{ Name = "docker"; Hint = "Docker Desktop" },
    @{ Name = "java"; Hint = "JDK 17 recommended" },
    @{ Name = "node"; Hint = "Node.js 20+" },
    @{ Name = "npm.cmd"; Hint = "npm" }
)
foreach ($item in $commands) {
    $command = Get-Command $item.Name -ErrorAction SilentlyContinue
    Report ([bool]$command) $item.Name $(if ($command) { $command.Source } else { $item.Hint })
}

$nodeVersion = if (Get-Command node -ErrorAction SilentlyContinue) { (& node --version).Trim() } else { "missing" }
$nodeMajor = if ($nodeVersion -match '^v(\d+)') { [int]$Matches[1] } else { 0 }
Report ($nodeMajor -ge 20) "Node.js version" "$nodeVersion (20+ required)"

$pythonReady = $false
$pythonVersion = "missing"
$pythonCandidates = @(
    @{ Command = "py"; Prefix = @("-3.12") },
    @{ Command = "py"; Prefix = @("-3.11") },
    @{ Command = "python"; Prefix = @() },
    @{ Command = "python3"; Prefix = @() }
)
foreach ($candidate in $pythonCandidates) {
    if (-not (Get-Command $candidate.Command -ErrorAction SilentlyContinue)) { continue }
    $version = & $candidate.Command @($candidate.Prefix) -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>$null
    if ($LASTEXITCODE -eq 0 -and $version -match '^(3\.1[1-9]|[4-9]\.)') {
        $pythonReady = $true
        $pythonVersion = $version
        break
    }
}
Report $pythonReady "Python version" "$pythonVersion (3.11+ required)"

$requiredFiles = @(
    "a3-ai-python\.env",
    "a3-ai-python\.venv\Scripts\python.exe",
    "a3-student-react-web\node_modules",
    "a3-admin-web\node_modules"
)
foreach ($relativePath in $requiredFiles) {
    $path = Join-Path $repoRoot $relativePath
    Report (Test-Path $path) $relativePath $(if (Test-Path $path) { "ready" } else { "run scripts\setup-local.ps1" })
}

$dockerReady = $false
if (Get-Command docker -ErrorAction SilentlyContinue) {
    & docker version --format "{{.Server.Version}}" *> $null
    $dockerReady = $LASTEXITCODE -eq 0
}
Report $dockerReady "Docker daemon" $(if ($dockerReady) { "running" } else { "start Docker Desktop" })

if ($RequireServices) {
    $services = @(
        @{ Name = "student web"; Port = 3002 },
        @{ Name = "admin web"; Port = 3004 },
        @{ Name = "gateway"; Port = 10010 },
        @{ Name = "learning service"; Port = 8090 },
        @{ Name = "AI service"; Port = 18080 },
        @{ Name = "MySQL"; Port = 13306 },
        @{ Name = "PostgreSQL"; Port = 15432 },
        @{ Name = "Redis"; Port = 16379 },
        @{ Name = "Milvus"; Port = 19530 }
    )
    foreach ($service in $services) {
        Report (Test-Port $service.Port) $service.Name "127.0.0.1:$($service.Port)"
    }
}

Write-Host ""
if ($failures -gt 0) {
    Write-Host "$failures check(s) failed." -ForegroundColor Red
    exit 1
}
Write-Host "All requested checks passed." -ForegroundColor Green
exit 0
