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

if (-not (Test-Path $aiRoot)) {
    throw "未找到 a3-ai-python 目录: $aiRoot"
}

if (-not (Test-Path $venvPython)) {
    throw "未找到项目虚拟环境 Python: $venvPython。请先在 a3-ai-python 下执行 D:\Python\python.exe -m venv .venv 并安装依赖。"
}

if (-not (Test-Path $envFile)) {
    throw "未找到环境配置文件: $envFile。请先从 .env.example 复制生成 .env。"
}

Write-Host "启动 a3-ai-python 本地服务..."
Write-Host "工作目录: $aiRoot"
Write-Host "Python 环境: $venvPython"
Write-Host "服务地址: http://127.0.0.1:18080"
Write-Host "提示: 请不要直接使用系统 python、uvicorn 或 Anaconda 环境启动。"

Push-Location $aiRoot
try {
    if (Test-Path $libreOfficeProgram) {
        $env:PATH = "$libreOfficeProgram;$env:PATH"
    }

    if (-not $SkipMigrations) {
        Write-Host "执行数据库迁移..."
        & $venvPython -m alembic upgrade head
    }

    $arguments = @(
        "-m", "uvicorn",
        "app.main:app",
        "--host", "127.0.0.1",
        "--port", "18080"
    )

    if ($Reload) {
        $arguments += "--reload"
    }

    & $venvPython @arguments
}
finally {
    Pop-Location
}
