param(
    [string]$DbHost = "127.0.0.1",
    [int]$DbPort = 13306,
    [string]$DbUser = "root",
    [string]$DbPassword = "a3mysql123",
    [string]$MysqlExe = "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe",
    [switch]$SkipDemoImport,
    [switch]$SkipServiceRestart,
    [switch]$WaitForService
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$mvnw = Join-Path $repoRoot "mvnw.cmd"
$learningPom = Join-Path $repoRoot "a3-learning\pom.xml"
$evaluationInitSqlCandidates = @(
    (Join-Path $repoRoot "sql\evaluation_init.sql"),
    (Join-Path $repoRoot "sql\evaluation.sql")
)
$evaluationInitSql = $evaluationInitSqlCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
$demoSqlCandidates = @(
    (Join-Path $repoRoot "sql\evaluation_demo_ascii.sql"),
    (Join-Path $repoRoot "sql\tj_learning_evaluation_demo_ascii.sql")
)
$demoSql = $demoSqlCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
$serviceLog = Join-Path $repoRoot "a3-learning\learning-local.log"
$serviceErrLog = Join-Path $repoRoot "a3-learning\learning-local.err.log"

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
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
    } finally {
        Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
    }
}

function Invoke-Probe {
    param([string]$Url)
    try {
        return Invoke-RestMethod -Method Get -Uri $Url -Headers @{ "user-info" = "1" }
    } catch {
        return $null
    }
}

function Normalize-LearningSql {
    param([string]$SqlText)

    $normalized = $SqlText -replace 'CREATE DATABASE IF NOT EXISTS\s+`learning`', 'CREATE DATABASE IF NOT EXISTS `tj_learning`'
    $normalized = $normalized -replace 'USE\s+`learning`;', 'USE `tj_learning`;'
    return $normalized
}

if (-not (Test-Path $MysqlExe)) {
    throw "mysql executable not found: $MysqlExe"
}

if (-not (Test-Path $mvnw)) {
    throw "Maven wrapper not found: $mvnw"
}

if (-not (Test-Path $learningPom)) {
    throw "Learning pom not found: $learningPom"
}

if (-not $SkipDemoImport) {
    if (-not $evaluationInitSql) {
        throw "Evaluation init SQL not found. Checked: $($evaluationInitSqlCandidates -join ', ')"
    }
    if (-not $demoSql) {
        throw "Demo SQL not found. Checked: $($demoSqlCandidates -join ', ')"
    }

    Write-Step "Initialize evaluation tables"
    $evaluationInitText = Normalize-LearningSql -SqlText (Get-Content -Path $evaluationInitSql -Raw)
    Invoke-MysqlText -InputText $evaluationInitText -Arguments @(
        "-h", $DbHost,
        "-P", "$DbPort",
        "-u", $DbUser,
        "--default-character-set=utf8mb4",
        "tj_learning"
    )

    Write-Step "Import learning evaluation demo data"
    $sqlText = Normalize-LearningSql -SqlText (Get-Content -Path $demoSql -Raw)
    Invoke-MysqlText -InputText $sqlText -Arguments @(
        "-h", $DbHost,
        "-P", "$DbPort",
        "-u", $DbUser,
        "--default-character-set=utf8mb4",
        "tj_learning"
    )
}

if (-not $SkipServiceRestart) {
    Write-Step "Restart local learning service"
    $processes = Get-CimInstance Win32_Process |
        Where-Object {
            $_.Name -eq "java.exe" -and (
                $_.CommandLine -like "*a3-learning\pom.xml*" -or
                $_.CommandLine -like "*a3-learning/pom.xml*" -or
                $_.CommandLine -like "*\a3-learning\target\classes*" -or
                $_.CommandLine -like "*/a3-learning/target/classes*"
            )
        }

    foreach ($process in $processes) {
        Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
    }

    Start-Sleep -Seconds 2

    $env:JAVA_TOOL_OPTIONS = "--add-opens=java.base/java.lang.invoke=ALL-UNNAMED"

    $commandLine = "`"$mvnw`" -f `"$learningPom`" spring-boot:run -DskipTests -Dspring-boot.run.profiles=local"

    Start-Process -FilePath "cmd.exe" `
        -ArgumentList @("/c", $commandLine) `
        -WorkingDirectory $repoRoot `
        -RedirectStandardOutput $serviceLog `
        -RedirectStandardError $serviceErrLog `
        -WindowStyle Hidden | Out-Null
}

if ($WaitForService) {
    Write-Step "Wait for learning service"
    $deadline = (Get-Date).AddMinutes(2)
    $ready = $false
    while ((Get-Date) -lt $deadline) {
        $probe = Invoke-Probe -Url "http://127.0.0.1:8090/evaluation/test/course/1"
        if ($probe -and $probe.code -eq 200) {
            $ready = $true
            break
        }
        Start-Sleep -Seconds 3
    }
    if (-not $ready) {
        throw "Learning service did not become ready within 2 minutes."
    }
}

Write-Step "Local endpoints"
Write-Host "Learning service : http://127.0.0.1:8090"
Write-Host "Student dev      : http://127.0.0.1:3002"
Write-Host "Overview         : http://127.0.0.1:3002/"
Write-Host "Learning path    : http://127.0.0.1:3002/path?courseId=101"
Write-Host "Evaluation       : http://127.0.0.1:3002/evaluation?courseId=101"
Write-Host "Study report     : http://127.0.0.1:3002/report?courseId=101"
Write-Host "AI tutor         : http://127.0.0.1:3002/tutor?courseId=101"

$summary = Invoke-Probe -Url "http://127.0.0.1:8090/evaluation/test/course/1"
if ($summary -and $summary.code -eq 200) {
    Write-Step "Evaluation API check"
    $summary | ConvertTo-Json -Depth 6
}
