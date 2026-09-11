param(
  [string]$KnowledgeUrl = 'https://agent.xfyun.cn/agentbuilder/resource/knowledge/detail/144411/hit?tag=AIUI-RAG2',
  [string]$WorkflowUrl = 'https://agent.xfyun.cn/agentbuilder/work_flow/661895/arrange'
)

$results = @()
foreach ($item in @(@{name='knowledge'; url=$KnowledgeUrl}, @{name='workflow'; url=$WorkflowUrl})) {
  try {
    $response = Invoke-WebRequest -Uri $item.url -UseBasicParsing -TimeoutSec 20
    $results += [ordered]@{ name=$item.name; url=$item.url; http_status=$response.StatusCode; page_reachable=$true; checked_at=(Get-Date).ToUniversalTime().ToString('o'); note='Page reachable; release/index status must be confirmed from the authenticated page labels.' }
  } catch {
    $results += [ordered]@{ name=$item.name; url=$item.url; http_status=$null; page_reachable=$false; checked_at=(Get-Date).ToUniversalTime().ToString('o'); note=$_.Exception.Message }
  }
}
$out = [ordered]@{ checked_at=(Get-Date).ToUniversalTime().ToString('o'); checks=$results }
$path = Join-Path $PSScriptRoot '..\docs\xfyun-status-check.json'
$out | ConvertTo-Json -Depth 5 | Set-Content -Path $path -Encoding UTF8
Write-Output "写入 $path"
$out | ConvertTo-Json -Depth 5
