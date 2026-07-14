param(
    [switch]$SkipMysqlInit = $false,
    [switch]$RunAiMigrations = $false,
    [switch]$NoOpenPages = $false,
    [switch]$Strict = $false,
    [int]$StartupTimeoutSeconds = 240
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$dockerDesktop = "C:\Program Files\Docker\Docker\Docker Desktop.exe"

function Test-Port {
    param(
        [int]$Port,
        [int]$TimeoutMilliseconds = 600
    )

    $client = [System.Net.Sockets.TcpClient]::new()
    try {
        $connect = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
        if (-not $connect.AsyncWaitHandle.WaitOne($TimeoutMilliseconds, $false)) {
            return $false
        }

        $client.EndConnect($connect)
        return $true
    } catch {
        return $false
    } finally {
        $client.Close()
    }
}

function Wait-Command {
    param(
        [scriptblock]$Command,
        [int]$TimeoutSeconds = 120,
        [int]$IntervalSeconds = 3,
        [string]$Name = "condition"
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            if (& $Command) {
                return $true
            }
        } catch {
            # Keep polling until timeout.
        }
        Start-Sleep -Seconds $IntervalSeconds
    }

    Write-Warning "Timed out waiting for $Name."
    return $false
}

function Start-BackgroundPowerShell {
    param(
        [string]$Name,
        [string]$Command,
        [string]$LogFile
    )

    $logPath = Join-Path $repoRoot $LogFile
    $psCommand = "Set-Location '$repoRoot'; $Command *>> '$logPath'"
    Write-Host "Starting $Name..."
    Start-Process -FilePath powershell.exe -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $psCommand -WindowStyle Hidden
}

function Start-BackgroundCmd {
    param(
        [string]$Name,
        [string]$Command,
        [string]$LogFile
    )

    $logPath = Join-Path $repoRoot $LogFile
    $cmdLine = "cd /d `"$repoRoot`" && $Command >> `"$logPath`" 2>&1"
    Write-Host "Starting $Name..."
    Start-Process -FilePath cmd.exe -ArgumentList "/d", "/c", $cmdLine -WindowStyle Hidden
}

function Wait-Services {
    param(
        [array]$Services,
        [int]$TimeoutSeconds = 240,
        [int]$IntervalSeconds = 2
    )

    $status = @{}
    foreach ($service in $Services) {
        $status[$service.Name] = $false
    }

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        $allReady = $true

        foreach ($service in $Services) {
            if (-not $status[$service.Name]) {
                $status[$service.Name] = Test-Port $service.Port
                if ($status[$service.Name]) {
                    Write-Host ("OK   {0,-14} port {1}" -f $service.Name, $service.Port)
                }
            }

            if (-not $status[$service.Name]) {
                $allReady = $false
            }
        }

        if ($allReady) {
            break
        }

        Start-Sleep -Seconds $IntervalSeconds
    }

    return $status
}

function Test-HttpCheck {
    param(
        [hashtable]$Check,
        [int]$TimeoutSeconds = 5
    )

    try {
        $headers = if ($Check.Headers) { $Check.Headers } else { @{} }
        $response = Invoke-WebRequest -UseBasicParsing -Uri $Check.Url -Headers $headers -TimeoutSec $TimeoutSeconds
        return @{ Ok = $true; Status = $response.StatusCode; Message = "" }
    } catch {
        return @{ Ok = $false; Status = ""; Message = $_.Exception.Message }
    }
}

Set-Location $repoRoot

Write-Host "A3 full local startup"
Write-Host "Repository: $repoRoot"

try {
    docker version --format "{{.Server.Version}}" *> $null
} catch {
    if (Test-Path $dockerDesktop) {
        Write-Host "Starting Docker Desktop..."
        Start-Process $dockerDesktop -WindowStyle Hidden
    } else {
        throw "Docker daemon is not running and Docker Desktop was not found at $dockerDesktop"
    }
}

Wait-Command -Name "Docker daemon" -TimeoutSeconds 240 -Command {
    docker version --format "{{.Server.Version}}" *> $null
    return $LASTEXITCODE -eq 0
} | Out-Null

Write-Host "Starting dependency containers..."
docker compose -f .\docker-compose.local.yml up -d

Wait-Command -Name "MySQL port 13306" -TimeoutSeconds 90 -Command { Test-Port 13306 } | Out-Null

if (-not $SkipMysqlInit) {
    Write-Host "Initializing MySQL schemas..."
    try {
        powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\init-mysql.ps1
    } catch {
        Write-Warning "MySQL init failed once. Waiting 15 seconds and retrying..."
        Start-Sleep -Seconds 15
        powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\init-mysql.ps1
    }
}

if (-not (Test-Port 8090)) {
    Start-BackgroundCmd -Name "a3-learning" -LogFile "learning-live.log" -Command 'set "JAVA_TOOL_OPTIONS=--add-opens=java.base/java.lang.invoke=ALL-UNNAMED" && ".\mvnw.cmd" -f ".\a3-learning\pom.xml" spring-boot:run -Dspring-boot.run.profiles=local -DskipTests'
} else {
    Write-Host "a3-learning already listens on 8090."
}

if (-not (Test-Port 18080)) {
    $aiFlags = if ($RunAiMigrations) { "" } else { "-SkipMigrations" }
    Start-BackgroundPowerShell -Name "a3-ai-python" -LogFile "ai-live.log" -Command "& '.\scripts\start-ai-local.ps1' $aiFlags"
} else {
    Write-Host "a3-ai-python already listens on 18080."
}

if (-not (Test-Port 10010)) {
    Start-BackgroundPowerShell -Name "a3-gateway" -LogFile "gateway-live.log" -Command "& '.\scripts\start-gateway-local.ps1'"
} else {
    Write-Host "a3-gateway already listens on 10010."
}

if (-not (Test-Port 3002)) {
    Start-BackgroundPowerShell -Name "student web" -LogFile "student-live.log" -Command "Set-Location '.\a3-student-react-web'; npm run dev"
} else {
    Write-Host "student web already listens on 3002."
}

if (-not (Test-Port 3004)) {
    Start-BackgroundPowerShell -Name "admin web" -LogFile "admin-live.log" -Command "Set-Location '.\a3-admin-web'; npm run dev"
} else {
    Write-Host "admin web already listens on 3004."
}

Write-Host "Waiting for services, timeout ${StartupTimeoutSeconds}s..."
$services = @(
    @{ Name = "student"; Port = 3002; Required = $true },
    @{ Name = "gateway"; Port = 10010; Required = $true },
    @{ Name = "ai"; Port = 18080; Required = $true },
    @{ Name = "admin"; Port = 3004; Required = $false },
    @{ Name = "learning"; Port = 8090; Required = $true }
)

$serviceStatus = Wait-Services -Services $services -TimeoutSeconds $StartupTimeoutSeconds

Write-Host ""
Write-Host "Port summary"
$missingRequired = @()
$missingOptional = @()
foreach ($service in $services) {
    if ($serviceStatus[$service.Name]) {
        Write-Host ("OK   {0,-14} port {1}" -f $service.Name, $service.Port)
    } elseif ($service.Required) {
        Write-Warning ("FAIL {0,-14} port {1}" -f $service.Name, $service.Port)
        $missingRequired += $service.Name
    } else {
        Write-Warning ("WARN {0,-14} port {1}" -f $service.Name, $service.Port)
        $missingOptional += $service.Name
    }
}

$checks = @(
    @{ Name = "student"; Url = "http://127.0.0.1:3002/" },
    @{ Name = "admin"; Url = "http://127.0.0.1:3004/" },
    @{ Name = "learning"; Url = "http://127.0.0.1:8090/evaluation/test/course/1"; Headers = @{ "user-info" = "1" } },
    @{ Name = "gateway-ai"; Url = "http://127.0.0.1:10010/ai/v1/admin/ping" },
    @{ Name = "ai-embedding"; Url = "http://127.0.0.1:18080/api/v1/admin/embedding/ping" },
    @{ Name = "rabbitmq-console"; Url = "http://127.0.0.1:15672/" },
    @{ Name = "minio-console"; Url = "http://127.0.0.1:19001/" },
    @{ Name = "milvus-health"; Url = "http://127.0.0.1:19091/healthz" }
)

Write-Host ""
Write-Host "Health checks"
$failedRequiredChecks = @()
foreach ($check in $checks) {
    $result = Test-HttpCheck -Check $check -TimeoutSeconds 5
    if ($result.Ok) {
        Write-Host ("OK   {0,-18} {1}" -f $check.Name, $result.Status)
    } else {
        $requiredCheck = $check.Name -in @("student", "learning", "gateway-ai", "ai-embedding")
        $label = if ($requiredCheck) { "FAIL" } else { "WARN" }
        Write-Warning ("{0} {1,-18} {2}" -f $label, $check.Name, $result.Message)
        if ($requiredCheck) {
            $failedRequiredChecks += $check.Name
        }
    }
}

Write-Host ""
Write-Host "URLs"
Write-Host "Student:          http://127.0.0.1:3002/"
Write-Host "Admin:            http://127.0.0.1:3004/"
Write-Host "Gateway:          http://127.0.0.1:10010/"
Write-Host "AI docs:          http://127.0.0.1:18080/docs"
Write-Host "RabbitMQ console: http://127.0.0.1:15672/  guest / guest"
Write-Host "MinIO console:    http://127.0.0.1:19001/  minioadmin / minioadmin"
Write-Host "Milvus health:    http://127.0.0.1:19091/healthz"

if (-not $NoOpenPages) {
    Start-Process "http://127.0.0.1:3002/"
    Start-Process "http://127.0.0.1:3004/"
    Start-Process "http://127.0.0.1:15672/"
    Start-Process "http://127.0.0.1:19001/"
}

Write-Host ""
if (($missingRequired.Count -gt 0) -or ($failedRequiredChecks.Count -gt 0)) {
    Write-Error ("Startup finished with required service failures. Missing ports: {0}; failed checks: {1}. See *-live.log files in {2}." -f ($missingRequired -join ", "), ($failedRequiredChecks -join ", "), $repoRoot)
    exit 1
}

if (($missingOptional.Count -gt 0) -or $Strict) {
    if ($missingOptional.Count -gt 0) {
        Write-Warning ("Optional services not ready: {0}. The student app can still be used if required checks passed." -f ($missingOptional -join ", "))
    }

    if ($Strict -and ($missingOptional.Count -gt 0)) {
        exit 1
    }
}

Write-Host "Startup complete. Required services are ready."
exit 0
