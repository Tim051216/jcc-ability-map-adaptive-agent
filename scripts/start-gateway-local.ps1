param(
    [switch]$SkipTests = $true
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$mvnw = Join-Path $repoRoot "mvnw.cmd"
$gatewayPom = Join-Path $repoRoot "a3-gateway\\pom.xml"

if (-not (Test-Path $mvnw)) {
    throw "未找到 Maven Wrapper: $mvnw"
}

if (-not (Test-Path $gatewayPom)) {
    throw "未找到网关模块 pom: $gatewayPom"
}

$arguments = @(
    "-f", $gatewayPom,
    "spring-boot:run",
    "-Dspring-boot.run.profiles=local"
)

if ($SkipTests) {
    $arguments += "-DskipTests"
}

Write-Host "启动 a3-gateway 本地联调模式..."
Write-Host "Profile: local"
Write-Host "AI 路由: http://127.0.0.1:10010/ai/**"

& $mvnw @arguments
