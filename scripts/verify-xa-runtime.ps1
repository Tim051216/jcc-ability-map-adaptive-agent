[CmdletBinding()]
param(
    [string]$BaseUrl = "http://127.0.0.1:18080",
    [string]$PluginUrl = ""
)

$ErrorActionPreference = "Stop"
$api = "$($BaseUrl.TrimEnd('/'))/api/v1/xa-competition"
$checkedAt = (Get-Date).ToUniversalTime().ToString('o')

function Get-Json([string]$url) {
    Invoke-RestMethod -Uri $url -Method Get -TimeoutSec 60
}
function Post-Json([string]$url, [hashtable]$body) {
    Invoke-RestMethod -Uri $url -Method Post -ContentType 'application/json' -Body ($body | ConvertTo-Json -Depth 8) -TimeoutSec 60
}

$health = Invoke-RestMethod -Uri "$($BaseUrl.TrimEnd('/'))/health" -TimeoutSec 20
$industry = Get-Json "$api/industry/jobs-analysis?professional_group=%E8%BD%AF%E4%BB%B6%E6%8A%80%E6%9C%AF%E4%B8%93%E4%B8%9A%E7%BE%A4"
$groups = Get-Json "$api/industry/professional-groups"
$ability = Post-Json "$api/job-ability/generate" @{ job_name = 'software developer'; professional_group = 'software'; observed_skills = @('code review'); typical_tasks = @('API integration acceptance') }
$task = Post-Json "$api/learning-task/generate" @{ work_task = 'battery pack assembly'; job_name = 'vehicle technician'; professional_group = 'new energy'; industry_context = 'battery safety inspection'; ability_focus = @('high voltage safety', 'insulation test') }
$adaptive = Post-Json "$api/adaptive-learning/recommend" @{ goal = 'skills competition preparation'; goal_scene = 'competition'; job_name = 'vehicle technician'; assessment_scores = @{ K01 = 42; K02 = 88 }; ability_labels = @{ K01 = 'safety diagnostics'; K02 = 'safe operation' } }

$groupSampleCounts = [ordered]@{}
foreach ($item in @($groups.items)) {
    $groupSampleCounts[$item.professional_group] = $item.sample_count
}
$coveredGroupCount = @($groups.items | Where-Object { $_.sample_count -gt 0 }).Count

$result = [ordered]@{
    checked_at = $checkedAt
    base_url = $BaseUrl
    health = $health.status
    industry_analysis = [ordered]@{ fetched_count = $industry.fetched_count; sample_count = $industry.sample_count; collection_mode = $industry.collection_mode; trend_source = $industry.trend_source; history_count = $industry.history_count; source_count = @($industry.source_urls).Count }
    professional_groups = [ordered]@{
        group_count = @($groups.items).Count
        covered_group_count = $coveredGroupCount
        total_sample_count = (@($groups.items) | Measure-Object -Property sample_count -Sum).Sum
        sample_counts = $groupSampleCounts
    }
    job_ability = [ordered]@{ ability_node_count = @($ability.abilities).Count; observed_skill_ingested = (@($ability.abilities.skill_points) -contains 'code review'); typical_task_ingested = (@($ability.typical_tasks) -contains 'API integration acceptance') }
    learning_task = [ordered]@{ step_count = @($task.steps).Count; safety_point_count = @($task.safety_points).Count; resource_count = @($task.resources).Count }
    adaptive_learning = [ordered]@{ weak_area_count = @($adaptive.weak_areas).Count; path_step_count = @($adaptive.next_steps).Count; ability_label = $adaptive.weak_areas[0].label }
    evidence_boundary = 'This script verifies local structured APIs only; it does not prove platform authorization, cloud release, or teacher/student trials.'
}
if ($PluginUrl) {
    $pluginHealth = Invoke-RestMethod -Uri "$($PluginUrl.TrimEnd('/'))/health" -TimeoutSec 20
    $result.plugin_gateway = [ordered]@{ url = $PluginUrl; health = $pluginHealth.status }
}

$outPath = Join-Path $PSScriptRoot '..\docs\evidence\xa-runtime-smoke-current.json'
$result | ConvertTo-Json -Depth 10 | Set-Content -Path $outPath -Encoding UTF8
$result | ConvertTo-Json -Depth 10
Write-Host "Evidence written to $outPath"
