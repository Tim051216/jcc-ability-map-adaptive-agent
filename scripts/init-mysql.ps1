param(
    [string]$DbHost = "127.0.0.1",
    [int]$Port = 13306,
    [string]$User = "root",
    [string]$Password = "a3mysql123",
    [string]$MysqlExe = "mysql"
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$sqlDir = Join-Path $projectRoot "sql"
$mysqlCommand = Get-Command $MysqlExe -ErrorAction SilentlyContinue
$useDockerMysql = -not [bool]$mysqlCommand

if ($useDockerMysql) {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw "Neither a local mysql client nor Docker was found. Install Docker Desktop or add mysql to PATH."
    }
    $containerRunning = (& docker inspect -f "{{.State.Running}}" a3-mysql 2>$null) -eq "true"
    if (-not $containerRunning) {
        throw "The a3-mysql container is not running. Start it with: docker compose -f docker-compose.local.yml up -d mysql"
    }
    Write-Host "Local mysql client not found; using the mysql client inside container a3-mysql."
}

$imports = @(
    @{ Database = "tj_auth"; File = "auth.sql" },
    @{ Database = "tj_course"; File = "course.sql" },
    @{ Database = "tj_learning"; File = "learning.sql" },
    @{ Database = "tj_media"; File = "media.sql" },
    @{ Database = "tj_message"; File = "message.sql" },
    @{ Database = "tj_pay"; File = "pay.sql" },
    @{ Database = "tj_promotion"; File = "promotion.sql" },
    @{ Database = "tj_remark"; File = "remark.sql" },
    @{ Database = "tj_search"; File = "search.sql" },
    @{ Database = "tj_trade"; File = "trade.sql" },
    @{ Database = "tj_user"; File = "user.sql" },
    @{ Database = "a3_exam"; File = "exam.sql" }
)

function Invoke-Mysql {
    param(
        [string[]]$Arguments,
        [string]$InputText
    )

    $env:MYSQL_PWD = $Password
    try {
        if ($useDockerMysql) {
            $dockerArguments = @("exec", "-i", "-e", "MYSQL_PWD=$Password", "a3-mysql", "mysql") + $Arguments
            if ($null -ne $InputText) {
                $InputText | & docker @dockerArguments
            } else {
                & docker @dockerArguments
            }
        } elseif ($null -ne $InputText) {
            $InputText | & $mysqlCommand.Source @Arguments
        } else {
            & $mysqlCommand.Source @Arguments
        }
        if ($LASTEXITCODE -ne 0) {
            throw "mysql command failed, exit code: $LASTEXITCODE"
        }
    } finally {
        Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
    }
}

$createSql = @"
CREATE DATABASE IF NOT EXISTS tj_auth DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS tj_course DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS tj_learning DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS tj_media DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS tj_message DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS tj_pay DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS tj_promotion DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS tj_remark DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS tj_search DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS tj_trade DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS tj_user DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS a3_exam DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
"@

Invoke-Mysql -Arguments @("-h", $DbHost, "-P", "$Port", "-u", $User, "-e", $createSql)

foreach ($item in $imports) {
    $filePath = Join-Path $sqlDir $item.File
    if (-not (Test-Path $filePath)) {
        throw "SQL file not found: $filePath"
    }
    Write-Host "Importing $($item.Database) <- $($item.File)"
    $content = Get-Content -Path $filePath -Raw -Encoding UTF8
    Invoke-Mysql -Arguments @("-h", $DbHost, "-P", "$Port", "-u", $User, $item.Database) -InputText $content
}

Write-Host "Database import completed."
