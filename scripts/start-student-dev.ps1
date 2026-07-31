$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$studentRoot = Join-Path $repoRoot "a3-student-react-web"
$stdout = Join-Path $repoRoot "student-dev.out.log"
$stderr = Join-Path $repoRoot "student-dev.err.log"

Set-Location $studentRoot
& npm.cmd run dev -- --host 127.0.0.1 --port 3002 1>$stdout 2>$stderr
