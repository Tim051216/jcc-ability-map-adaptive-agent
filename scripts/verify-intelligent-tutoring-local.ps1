param(
    [string]$AiBaseUrl = "http://127.0.0.1:18080",
    [string]$GatewayBaseUrl = "http://127.0.0.1:10010",
    [int]$UserId = 1001
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Invoke-CheckGet {
    param(
        [string]$Name,
        [string]$Url,
        [hashtable]$Headers = @{}
    )
    Write-Step $Name
    $response = Invoke-RestMethod -Method Get -Uri $Url -Headers $Headers
    $response | ConvertTo-Json -Depth 8
}

function Invoke-CheckPost {
    param(
        [string]$Name,
        [string]$Url,
        [object]$Body,
        [hashtable]$Headers = @{}
    )
    Write-Step $Name
    $jsonBody = $Body | ConvertTo-Json -Depth 8
    $response = Invoke-RestMethod -Method Post -Uri $Url -ContentType "application/json; charset=utf-8" -Body $jsonBody -Headers $Headers
    $response | ConvertTo-Json -Depth 8
}

$authHeaders = @{
    "X-User-Id" = "$UserId"
}

Write-Step "Check local ports"
Test-NetConnection 127.0.0.1 -Port ([uri]$AiBaseUrl).Port | Select-Object ComputerName, RemotePort, TcpTestSucceeded
Test-NetConnection 127.0.0.1 -Port ([uri]$GatewayBaseUrl).Port | Select-Object ComputerName, RemotePort, TcpTestSucceeded

Invoke-CheckGet -Name "AI LLM Ping" -Url "$AiBaseUrl/api/v1/admin/llm/ping"
Invoke-CheckGet -Name "AI Embedding Ping" -Url "$AiBaseUrl/api/v1/admin/embedding/ping"
Invoke-CheckGet -Name "Gateway Admin Ping (/ai/v1)" -Url "$GatewayBaseUrl/ai/v1/admin/ping"
Invoke-CheckGet -Name "Gateway Admin Ping (/ai/api/v1)" -Url "$GatewayBaseUrl/ai/api/v1/admin/ping"

$ocrImageBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
Invoke-CheckPost `
    -Name "Tutoring OCR Preview" `
    -Url "$AiBaseUrl/api/v1/tutoring/ocr-preview" `
    -Headers $authHeaders `
    -Body @{ image_base64 = $ocrImageBase64 }

Invoke-CheckGet `
    -Name "Tutoring History" `
    -Url "$AiBaseUrl/api/v1/tutoring/history?page=1&page_size=5" `
    -Headers $authHeaders

Write-Host ""
Write-Host "Local intelligent tutoring checks completed. Start the database, AI service, and gateway before running full end-to-end verification from the frontend or curl." -ForegroundColor Green
