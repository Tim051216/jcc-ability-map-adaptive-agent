param(
    [string]$DbHost = "127.0.0.1",
    [int]$DbPort = 13306,
    [string]$DbUser = "root",
    [string]$DbPassword = "a3mysql123",
    [string]$MysqlExe = "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe",
    [switch]$SkipEvaluationDemo,
    [switch]$SkipMysqlSeed,
    [switch]$SkipAiSeed
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$sqlDir = Join-Path $repoRoot "sql"
$aiRoot = Join-Path $repoRoot "a3-ai-python"
$aiPython = Join-Path $aiRoot ".venv\Scripts\python.exe"

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Normalize-LearningSql {
    param([string]$SqlText)

    $normalized = $SqlText -replace 'CREATE DATABASE IF NOT EXISTS\s+`learning`', 'CREATE DATABASE IF NOT EXISTS `tj_learning`'
    $normalized = $normalized -replace 'USE\s+`learning`;', 'USE `tj_learning`;'
    return $normalized
}

function Invoke-MysqlText {
    param(
        [string]$InputText,
        [string[]]$Arguments
    )

    $env:MYSQL_PWD = $DbPassword
    try {
        $InputText | & $MysqlExe @Arguments
        if ($LASTEXITCODE -ne 0) {
            throw "mysql exited with code $LASTEXITCODE"
        }
    }
    finally {
        Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
    }
}

if (-not $SkipMysqlSeed -or -not $SkipEvaluationDemo) {
    if (-not (Test-Path $MysqlExe)) {
        throw "mysql executable not found: $MysqlExe"
    }
}

if (-not $SkipEvaluationDemo) {
    $evaluationInitSql = Join-Path $sqlDir "evaluation_init.sql"
    $evaluationDemoSql = Join-Path $sqlDir "evaluation_demo_ascii.sql"

    if (-not (Test-Path $evaluationInitSql)) {
        throw "Missing evaluation init SQL: $evaluationInitSql"
    }
    if (-not (Test-Path $evaluationDemoSql)) {
        throw "Missing evaluation demo SQL: $evaluationDemoSql"
    }

    Write-Step "Import evaluation schema and demo rows into tj_learning"
    $evaluationInitText = Normalize-LearningSql -SqlText (Get-Content -Path $evaluationInitSql -Raw)
    Invoke-MysqlText -InputText $evaluationInitText -Arguments @(
        "-h", $DbHost,
        "-P", "$DbPort",
        "-u", $DbUser,
        "--default-character-set=utf8mb4",
        "tj_learning"
    )

    $evaluationDemoText = Normalize-LearningSql -SqlText (Get-Content -Path $evaluationDemoSql -Raw)
    Invoke-MysqlText -InputText $evaluationDemoText -Arguments @(
        "-h", $DbHost,
        "-P", "$DbPort",
        "-u", $DbUser,
        "--default-character-set=utf8mb4",
        "tj_learning"
    )
}

if (-not $SkipMysqlSeed) {
    $mysqlSeedSql = Join-Path $sqlDir "local_demo_seed.sql"
    if (-not (Test-Path $mysqlSeedSql)) {
        throw "Missing MySQL seed SQL: $mysqlSeedSql"
    }

    Write-Step "Seed learning progress and Q&A demo rows into tj_learning"
    Invoke-MysqlText -InputText (Get-Content -Path $mysqlSeedSql -Raw) -Arguments @(
        "-h", $DbHost,
        "-P", "$DbPort",
        "-u", $DbUser,
        "--default-character-set=utf8mb4",
        "tj_learning"
    )
}

if (-not $SkipAiSeed) {
    if (-not (Test-Path $aiPython)) {
        throw "AI virtualenv Python not found: $aiPython"
    }

    Write-Step "Seed AI PostgreSQL demo rows"
    Push-Location $aiRoot
    try {
        & $aiPython ".\scripts\init_real_local_data.py"
        if ($LASTEXITCODE -ne 0) {
            throw "AI demo seed failed with exit code $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }
}

Write-Step "Done"
Write-Host "MySQL learning DB : tj_learning"
Write-Host "AI PostgreSQL seed: $(if ($SkipAiSeed) { 'skipped' } else { 'applied' })"
