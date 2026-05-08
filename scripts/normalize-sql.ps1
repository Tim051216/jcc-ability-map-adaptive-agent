param(
    [string]$SourceDir = "",
    [string]$TargetDir = ""
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($SourceDir)) {
    $SourceDir = Join-Path $projectRoot "sql"
}
if ([string]::IsNullOrWhiteSpace($TargetDir)) {
    $TargetDir = $SourceDir
}

$dbNameMap = @{
    "a3_exam.sql" = "a3_exam"
    "tj_auth.sql" = "tj_auth"
    "tj_course.sql" = "tj_course"
    "tj_learning.sql" = "tj_learning"
    "tj_media.sql" = "tj_media"
    "tj_message.sql" = "tj_message"
    "tj_pay.sql" = "tj_pay"
    "tj_promotion.sql" = "tj_promotion"
    "tj_remark.sql" = "tj_remark"
    "tj_search.sql" = "tj_search"
    "tj_trade.sql" = "tj_trade"
    "tj_user.sql" = "tj_user"
}

$backtick = [char]96

function Normalize-ColumnLine {
    param(
        [string]$Line
    )

    $trimmed = $Line.TrimEnd()
    $hasComma = $trimmed.EndsWith(",")

    $patterns = @(
        '^(?<indent>\s*)`(?<name>[^`]+)`\s+(?<rest>[A-Za-z]+(?:\([^)]+\))?(?:\s+unsigned)?(?:\s+CHARACTER SET\s+[A-Za-z0-9_]+(?:\s+COLLATE\s+[A-Za-z0-9_]+)?)?(?:\s+(?:NOT NULL|NULL))?(?:\s+DEFAULT\s+(?:CURRENT_TIMESTAMP|NULL|b''[01]''|''[^'']*''|[A-Za-z0-9_.\-]+))?(?:\s+AUTO_INCREMENT)?(?:\s+ON UPDATE\s+CURRENT_TIMESTAMP)?)',
        '^(?<indent>\s*)`(?<name>[^`]+)`\s+(?<rest>[A-Za-z]+(?:\([^)]+\))?(?:\s+CHARACTER SET\s+[A-Za-z0-9_]+(?:\s+COLLATE\s+[A-Za-z0-9_]+)?)?(?:\s+(?:NOT NULL|NULL))?)'
    )

    foreach ($pattern in $patterns) {
        $match = [regex]::Match($trimmed, $pattern)
        if ($match.Success) {
            $normalized = "{0}{1}{2}{1} {3}" -f $match.Groups["indent"].Value, $backtick, $match.Groups["name"].Value, $match.Groups["rest"].Value.Trim()
            if ($hasComma) {
                $normalized += ","
            }
            return $normalized
        }
    }

    $asciiOnly = ($trimmed -replace "[^\u0000-\u007F]", "").TrimEnd()
    if ($hasComma -and -not $asciiOnly.EndsWith(",")) {
        $asciiOnly += ","
    }
    return $asciiOnly
}

function Normalize-KeyLine {
    param(
        [string]$Line
    )

    $trimmed = $Line.TrimEnd()
    $hasComma = $trimmed.EndsWith(",")
    $asciiOnly = ($trimmed -replace "\s+COMMENT\s*=.*$", "" -replace "\s+COMMENT\s+'.*$", "")
    $asciiOnly = ($asciiOnly -replace "[^\u0000-\u007F]", "").TrimEnd()
    if ($hasComma -and -not $asciiOnly.EndsWith(",")) {
        $asciiOnly += ","
    }
    return $asciiOnly
}

function Normalize-SqlFile {
    param(
        [string]$InputPath,
        [string]$OutputPath,
        [string]$DatabaseName
    )

    $raw = Get-Content -Path $InputPath -Raw
    $raw = $raw -replace '(?m)^DELETE FROM\s+`[^`]+`;\r?\n?', ""

    $lines = $raw -split "\r?\n"
    $result = New-Object System.Collections.Generic.List[string]
    $skipInsert = $false

    $header = @(
        "/*",
        " Cleaned SQL for local startup.",
        " Source file: $([System.IO.Path]::GetFileName($InputPath))",
        " Note: upstream seed data/comments may contain mojibake, so this version keeps schema-first statements.",
        "*/",
        "",
        "CREATE DATABASE IF NOT EXISTS $backtick$DatabaseName$backtick DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
        "USE $backtick$DatabaseName$backtick;",
        ""
    )
    $result.AddRange([string[]]$header)

    foreach ($line in $lines) {
        if (-not $skipInsert -and $line -match '^\s*INSERT INTO\s+`') {
            $skipInsert = $true
            if ($line.TrimEnd().EndsWith(";")) {
                $skipInsert = $false
            }
            continue
        }
        if ($skipInsert) {
            if ($line.TrimEnd().EndsWith(";")) {
                $skipInsert = $false
            }
            continue
        }

        if ($line -match '^\s*CREATE DATABASE\s+') { continue }
        if ($line -match '^\s*USE\s+`') { continue }
        if ($line -match '^\s*/\*!') { continue }

        $currentLine = $line

        if ($currentLine -match '^\s*`') {
            $currentLine = Normalize-ColumnLine -Line $currentLine
        } elseif ($currentLine -match '^\s*(PRIMARY KEY|UNIQUE KEY|KEY|INDEX)\s+') {
            $currentLine = Normalize-KeyLine -Line $currentLine
        } elseif ($currentLine -match '^\)\s+ENGINE') {
            $currentLine = ($currentLine -replace "\s+COMMENT\s*=.*$", "").TrimEnd()
            $currentLine = ($currentLine -replace "[^\u0000-\u007F]", "")
            if (-not $currentLine.EndsWith(";")) {
                $currentLine += ";"
            }
        }

        if ($currentLine -match "^\s*$") {
            $result.Add("")
            continue
        }
        $result.Add($currentLine)
    }

    Set-Content -Path $OutputPath -Value $result -Encoding UTF8
}

New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null

foreach ($entry in $dbNameMap.GetEnumerator() | Sort-Object Name) {
    $inputPath = Join-Path $SourceDir $entry.Key
    if (-not (Test-Path $inputPath)) {
        continue
    }
    $outputPath = Join-Path $TargetDir $entry.Key
    Normalize-SqlFile -InputPath $inputPath -OutputPath $outputPath -DatabaseName $entry.Value
    Write-Host "Normalized $($entry.Key)"
}
