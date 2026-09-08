[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
$catalog = Join-Path $repo "a3-ai-python\xfyun_agent\knowledge\software-job-ability-knowledge-catalog.md"
$required = @("requirement_analysis", "system_design", "coding_implementation", "software_testing", "project_collaboration")
$text = Get-Content -Raw -Encoding UTF8 $catalog
$ids = [regex]::Matches($text, '(?m)^## (K\d{3}) ')
$skillCount = ([regex]::Matches($text, '(?m)^- 技能点：.+$')).Count
$sourceLines = [regex]::Matches($text, '(?m)^- 来源：(.+)$')
$missing = @()
foreach ($m in $sourceLines) {
  $path = ($m.Groups[1].Value -split '｜', 2)[0].Trim()
  if (-not (Test-Path (Join-Path $repo $path))) { $missing += $path }
}
$dimensions = @([regex]::Matches($text, '(?m)^- 能力维度：(.+)$') | ForEach-Object { $_.Groups[1].Value.Trim() } | Sort-Object -Unique)
$submitNames = @("报名信息", "作品Demo", "作品说明", "作品源码", "安全与合规", "补充材料")
$submitDirs = 1..6 | ForEach-Object { Join-Path $repo ("deliverables\{0:D2}-{1}" -f $_, $submitNames[$_ - 1]) }
$missingDirs = @($submitDirs | Where-Object { -not (Test-Path $_) })
$sourcePackage = Join-Path $repo "deliverables\04-作品源码"
$sensitive = @(Get-ChildItem -Path $sourcePackage -Recurse -File -Force -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '^\.env($|\.)|\.log$|\.sqlite$' })
$legacySlides = @()
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
foreach ($ppt in (Get-ChildItem -Path (Join-Path $repo "deliverables\03-作品说明") -Filter *.pptx -File -ErrorAction SilentlyContinue)) {
  $zip = [IO.Compression.ZipFile]::OpenRead($ppt.FullName)
  try {
    foreach ($entry in $zip.Entries | Where-Object { $_.FullName -match '^ppt/slides/slide\d+\.xml$' }) {
      $reader = New-Object IO.StreamReader($entry.Open())
      try { $slideText = $reader.ReadToEnd() } finally { $reader.Dispose() }
      if ($slideText -match '中国软件杯|A3-') { $legacySlides += $ppt.Name; break }
    }
  } finally { $zip.Dispose() }
}

Write-Host "XA-202603 offline audit"
Write-Host "catalog_entries=$($ids.Count) skill_points=$skillCount sources=$($sourceLines.Count)"
Write-Host "dimensions=$($dimensions -join ',')"
if ($ids.Count -lt 80) { throw "知识目录应至少为 80 条（团队目标），当前为 $($ids.Count)" }
if ($skillCount -ne $ids.Count) { throw "技能点数量必须与目录条目一致，当前为 $skillCount/$($ids.Count)" }
if ($sourceLines.Count -ne $ids.Count) { throw "来源数量必须与目录条目一致，当前为 $($sourceLines.Count)/$($ids.Count)" }
if (@($dimensions | Where-Object { $_ -notin $required }).Count -gt 0 -or @($required | Where-Object { $_ -notin $dimensions }).Count -gt 0) { throw "五个能力维度覆盖不完整" }
if ($missing.Count -gt 0) { throw "存在不存在的来源文件：$($missing -join ', ')" }
if ($missingDirs.Count -gt 0) { throw "提交目录缺失：$($missingDirs -join ', ')" }
if ($sensitive.Count -gt 0) { throw "发现疑似运行时/敏感文件，请勿放入提交包：$($sensitive.FullName -join ', ')" }
if ($legacySlides.Count -gt 0) { throw "03-作品说明中 PPT 仍含旧 A3 口径：$($legacySlides -join ', ')" }
Write-Host "PASS: catalog, sources, dimensions, submission directories, and sensitive-file checks"
