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

$imports = @(
    @{ Database = "tj_auth"; File = "tj_auth.sql" },
    @{ Database = "tj_course"; File = "tj_course.sql" },
    @{ Database = "tj_learning"; File = "tj_learning.sql" },
    @{ Database = "tj_media"; File = "tj_media.sql" },
    @{ Database = "tj_message"; File = "tj_message.sql" },
    @{ Database = "tj_pay"; File = "tj_pay.sql" },
    @{ Database = "tj_promotion"; File = "tj_promotion.sql" },
    @{ Database = "tj_remark"; File = "tj_remark.sql" },
    @{ Database = "tj_search"; File = "tj_search.sql" },
    @{ Database = "tj_trade"; File = "tj_trade.sql" },
    @{ Database = "tj_user"; File = "tj_user.sql" },
    @{ Database = "a3_exam"; File = "a3_exam.sql" }
)

function Invoke-Mysql {
    param(
        [string[]]$Arguments,
        [string]$InputText
    )

    $env:MYSQL_PWD = $Password
    try {
        if ($null -ne $InputText) {
            $InputText | & $MysqlExe @Arguments
        } else {
            & $MysqlExe @Arguments
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
    $content = Get-Content -Path $filePath -Raw
    Invoke-Mysql -Arguments @("-h", $DbHost, "-P", "$Port", "-u", $User, $item.Database) -InputText $content
}

Write-Host "Database import completed."
