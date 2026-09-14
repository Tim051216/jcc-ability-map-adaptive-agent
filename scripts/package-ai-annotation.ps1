[CmdletBinding()]
param(
  [string]$OutputRoot = "",
  [switch]$IncludeScreenshots
)

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
if (-not $OutputRoot) {
  $OutputRoot = Join-Path $repo "output\ai-annotation-package-$stamp"
}
$OutputRoot = [IO.Path]::GetFullPath($OutputRoot)
$archive = "$OutputRoot.zip"
$staging = Join-Path $OutputRoot "作品编码600370-提交资料包"

function Assert-InRepo([string]$path) {
  $full = [IO.Path]::GetFullPath($path)
  $prefix = $repo.TrimEnd('\') + '\'
  if (-not $full.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw "输出路径必须位于仓库内：$full"
  }
}

Assert-InRepo $OutputRoot
if (Test-Path -LiteralPath $staging) {
  # Rebuilding into an existing staging directory can leave stale files from
  # an older package.  Remove only the exact, validated child under the
  # caller-selected output directory; never broaden this to the repository or
  # a generic output folder.
  $resolvedStaging = [IO.Path]::GetFullPath($staging)
  $resolvedOutput = [IO.Path]::GetFullPath($OutputRoot).TrimEnd('\') + '\'
  if (-not $resolvedStaging.StartsWith($resolvedOutput, [StringComparison]::OrdinalIgnoreCase) -or
      (Split-Path -Leaf $resolvedStaging) -ne "作品编码600370-提交资料包") {
    throw "拒绝清理未验证的预提交包暂存路径：$resolvedStaging"
  }
  Remove-Item -LiteralPath $resolvedStaging -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $staging | Out-Null

function Copy-Relative([string]$relative, [string]$targetRelative = $relative) {
  $source = Join-Path $repo $relative
  if (-not (Test-Path -LiteralPath $source)) {
    Write-Warning "跳过不存在的文件：$relative"
    return $false
  }
  $target = Join-Path $staging $targetRelative
  $targetDir = Split-Path -Parent $target
  New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
  Copy-Item -LiteralPath $source -Destination $target -Force
  return $true
}

function Copy-Tree([string]$relative, [string]$targetRelative = $relative) {
  $source = Join-Path $repo $relative
  if (-not (Test-Path -LiteralPath $source -PathType Container)) {
    Write-Warning "跳过不存在的目录：$relative"
    return $false
  }
  $targetParent = Join-Path $staging (Split-Path -Parent $targetRelative)
  New-Item -ItemType Directory -Force -Path $targetParent | Out-Null
  Copy-Item -LiteralPath $source -Destination $targetParent -Recurse -Force
  return $true
}

function Copy-TreeMapped([string]$sourceRelative, [string]$targetRelative) {
  $source = Join-Path $repo $sourceRelative
  if (-not (Test-Path -LiteralPath $source -PathType Container)) {
    Write-Warning "跳过不存在的目录：$sourceRelative"
    return $false
  }
  $sourceRoot = [IO.Path]::GetFullPath($source).TrimEnd('\')
  $found = $false
  Get-ChildItem -LiteralPath $sourceRoot -Recurse -File | ForEach-Object {
    $relativeChild = $_.FullName.Substring($sourceRoot.Length + 1).Replace('\', '/')
    if (Copy-Relative "$sourceRelative\$relativeChild" "$targetRelative\$relativeChild") { $found = $true }
  }
  return $found
}

$copied = [System.Collections.Generic.List[string]]::new()
$files = @(
  "AI_ANNOTATION_COMPETITION_ADAPTATION.md",
  "a3-ai-python\xfyun_agent\AI_ANNOTATION_SYSTEM_PROMPT.md",
  "a3-ai-python\xfyun_agent\AI_ANNOTATION_WORKFLOW_DEPLOYMENT.md",
  "a3-student-react-web\README.md",
  "a3-student-react-web\package.json",
  "a3-student-react-web\package-lock.json",
  "a3-student-react-web\tsconfig.json",
  "a3-student-react-web\vite.config.ts",
  "a3-student-react-web\src\App.tsx",
  "a3-student-react-web\src\pages\AIAnnotationAgent.tsx",
  "a3-student-react-web\src\data\aiAnnotationRules.ts",
  "a3-student-react-web\src\data\aiAnnotationKnowledge.ts",
  "a3-student-react-web\src\lib\aiAnnotationLearningTask.ts",
  "a3-student-react-web\scripts\smoke-ai-annotation-agent.ts",
  "a3-student-react-web\scripts\audit-ai-annotation-deliverables.ts",
  "a3-student-react-web\scripts\audit-ai-annotation-submission.ts",
  "scripts\start-ai-annotation.ps1",
  "scripts\package-ai-annotation.ps1",
  "scripts\verify-ai-annotation-package.ps1",
  "scripts\build_ai_annotation_docx.py",
  "scripts\build_ai_annotation_ppt.mjs"
)
foreach ($relative in $files) {
  if (Copy-Relative $relative (Join-Path "04-作品源码\source" $relative)) { $copied.Add($relative) }
}

# App.tsx keeps the historical routes available for compatibility, so the
# selected entry imports shared components and helpers.  Include the complete
# TypeScript source tree and HTML entry in the source bundle; otherwise a
# recipient cannot run `npm run build` from the packaged files.  The tree has
# no secrets or runtime data, while large generated assets remain excluded.
if (Copy-Tree "a3-student-react-web\src" "04-作品源码\source\a3-student-react-web\src") {
  $copied.Add("a3-student-react-web\src\*")
}
if (Copy-Relative "a3-student-react-web\index.html" "04-作品源码\source\a3-student-react-web\index.html") {
  $copied.Add("a3-student-react-web\index.html")
}

$deliverableFiles = @(
  "deliverables\01-报名信息\README.md",
  "deliverables\01-报名信息\作品编码600370-参赛信息核对表.md",
  "deliverables\01-报名信息\报名表扫描件-作品编码600370-韩盛豪团队.pdf",
  "deliverables\02-作品Demo\README.md",
  "deliverables\02-作品Demo\AI数据标注实训智能体-Demo信息.md",
  "deliverables\02-作品Demo\演示录屏\README.md",
  "deliverables\02-作品Demo\演示录屏\ai-annotation-demo-AI模拟-内部演示-20260913.webm",
  "deliverables\02-作品Demo\演示录屏\ai-annotation-demo-AI模拟-内部演示-20260913.mp4",
  "deliverables\03-作品说明\README.md",
  "deliverables\03-作品说明\AI数据标注实训智能体-项目说明.md",
  "deliverables\03-作品说明\AI数据标注实训智能体-项目说明.docx",
  "deliverables\03-作品说明\作品编码600370-答辩PPT-最新版.pptx",
  "deliverables\04-作品源码\README.md",
  "deliverables\04-作品源码\AI数据标注实训智能体-源码清单.md",
  "deliverables\05-安全与合规\README.md",
  "deliverables\05-安全与合规\AI数据标注实训智能体-安全合规承诺模板.md",
  "deliverables\05-安全与合规\AI数据标注实训智能体-安全合规承诺书-负责人电子签署版.pdf",
  "deliverables\06-补充材料\README.md",
  "deliverables\06-补充材料\AI数据标注实训智能体-证据包索引.md",
  "deliverables\06-补充材料\AI数据标注实训智能体-外部证据人工核验声明模板.md",
  "deliverables\AI数据标注实训智能体-竞赛说明.md",
  "deliverables\AI数据标注实训智能体-证据矩阵.md",
  "deliverables\AI数据标注实训智能体-交付审计.md",
  "deliverables\AI数据标注实训智能体-来源规则输出映射.md",
  "deliverables\AI数据标注实训智能体-来源文件核验清单.md",
  "deliverables\AI数据标注实训智能体-提交前总清单.md",
  "deliverables\AI数据标注实训智能体-试用与演示指南.md",
  "deliverables\AI数据标注实训智能体-真实试用执行清单.md",
  "deliverables\AI数据标注实训智能体-场景来源核验模板.md",
  "deliverables\AI数据标注实训智能体-知识来源核验审计.md",
  "deliverables\AI数据标注实训智能体-缺口审计与推进计划.md",
  "deliverables\AI数据标注实训智能体-自动化验收记录.md",
  "deliverables\AI数据标注实训智能体-知识库目录.md",
  "deliverables\AI数据标注实训智能体-岗位适配说明.md",
  "deliverables\AI数据标注实训智能体-AI模拟试用记录.md",
  "deliverables\AI数据标注实训智能体-AI模拟反馈.csv",
  "deliverables\AI数据标注真实用户反馈-模板.csv"
)
foreach ($relative in $deliverableFiles) {
  $target = $relative.Substring("deliverables\".Length)
  if (Copy-Relative $relative $target) { $copied.Add($relative) }
}

# The competition specification uses the following six directory names.  The
# repository keeps more descriptive internal names for development; copy an
# explicit, one-to-one alias so the handoff can be submitted without asking a
# reviewer to infer the mapping.  The original internal paths remain in the
# package for source traceability.
$officialDirectoryMap = @(
  @{ Source = "deliverables\01-报名信息"; Target = "01-参赛信息" },
  @{ Source = "deliverables\02-作品Demo"; Target = "02-作品Demo" },
  @{ Source = "deliverables\04-作品源码"; Target = "04-作品代码" },
  @{ Source = "deliverables\05-安全与合规"; Target = "05-伦理与安全合规性声明" },
  @{ Source = "deliverables\06-补充材料"; Target = "06-其他材料" }
)
foreach ($mapping in $officialDirectoryMap) {
  if (Copy-TreeMapped $mapping.Source $mapping.Target) {
    $copied.Add("$($mapping.Source) -> $($mapping.Target)")
  }
}

# The development directory retains historical revisions for audit history.
# The official submission directory intentionally receives only the current
# project description and the explicitly named latest defense deck.
foreach ($relative in @(
  "deliverables\03-作品说明\README.md",
  "deliverables\03-作品说明\AI数据标注实训智能体-项目说明.md",
  "deliverables\03-作品说明\AI数据标注实训智能体-项目说明.docx",
  "deliverables\03-作品说明\作品编码600370-答辩PPT-最新版.pptx"
)) {
  $name = Split-Path -Leaf $relative
  if (Copy-Relative $relative (Join-Path "03-作品方案" $name)) { $copied.Add("$relative -> 03-作品方案") }
}

# The knowledge catalogue is maintained at the deliverables root for internal
# cross-references.  Put an explicit copy in the official supplementary-
# materials folder so reviewers and the verifier can find it in one place.
if (Copy-Relative "deliverables\AI数据标注实训智能体-知识库目录.md" "06-其他材料\AI数据标注实训智能体-知识库目录.md") {
  $copied.Add("deliverables\AI数据标注实训智能体-知识库目录.md -> 06-其他材料")
}

# Keep a runnable source tree under the competition's official 04-作品代码
# directory as well as the descriptive internal 04-作品源码 directory.  The
# two paths intentionally contain the same audited files so a reviewer can
# open the official folder directly without having to infer an alias.
$internalSource = Join-Path $staging "04-作品源码\source"
$officialSource = Join-Path $staging "04-作品代码\source"
if (Test-Path -LiteralPath $internalSource -PathType Container) {
  New-Item -ItemType Directory -Force -Path $officialSource | Out-Null
  # Copy the contents, not the source directory itself; Copy-Item otherwise
  # creates an unnecessary officialSource/source nesting level.
  Get-ChildItem -LiteralPath $internalSource -Force | Copy-Item -Destination $officialSource -Recurse -Force
  $copied.Add("04-作品源码\source -> 04-作品代码\source")
}

if ($IncludeScreenshots) {
  $screenshotDir = Join-Path $repo "output\playwright"
  if (Test-Path -LiteralPath $screenshotDir) {
    $target = Join-Path $staging "06-补充材料\截图"
    New-Item -ItemType Directory -Force -Path $target | Out-Null
    Get-ChildItem -LiteralPath $screenshotDir -File -Filter "*annotation*" | Copy-Item -Destination $target -Force
    $copied.Add("output\playwright\*annotation*")
    $officialScreenshotTarget = Join-Path $staging "06-其他材料\截图"
    New-Item -ItemType Directory -Force -Path $officialScreenshotTarget | Out-Null
    Get-ChildItem -LiteralPath $screenshotDir -File -Filter "*annotation*" | Copy-Item -Destination $officialScreenshotTarget -Force
    $copied.Add("output\playwright\*annotation* -> 06-其他材料\截图")

    # Keep the explicitly labelled internal-demo recording discoverable from
    # the Demo directory.  It is never copied into the real-user evidence
    # location and its filename retains the AI-simulation marker.
    $video = Get-ChildItem -LiteralPath $screenshotDir -File -Filter "*AI模拟*webm" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($video) {
      $demoVideoTarget = Join-Path $staging "02-作品Demo\演示录屏"
      New-Item -ItemType Directory -Force -Path $demoVideoTarget | Out-Null
      Copy-Item -LiteralPath $video.FullName -Destination $demoVideoTarget -Force
      $copied.Add("output\playwright\$($video.Name) -> 02-作品Demo\演示录屏")
    }
  }
}

$readme = @(
  '# 作品编码 600370 提交资料包',
  '',
  ('生成时间：' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz')),
  '',
  '学校：南京林业大学；负责人：韩盛豪；成员：张文馨、蒋孟窈、朱佳音；指导教师：徐雨凤、张晓丹。',
  '报名作品名：面向软件工程专业群的岗课赛能力图谱构建与全闭环自适应导学智能体。',
  '当前实施模块：AI 数据标注实训智能体。报名作品名与实施模块专业口径不一致，须在赛事中心确认后再最终提交。',
  '',
  '星辰 Agent ID：5816885；2026-09-14 已提交讯飞星辰/讯飞星火渠道审核；公开体验链接待审核生成。',
  '',
  '这是已整理的技术提交资料包，不代表外部证据已经完成。包内明确区分：',
  '',
  '- 技术 MVP：可运行页面、规则库、启动脚本和自动化验收。',
  '- 候选来源：标准文件指纹和来源边界记录，等待教师复核。',
  '- 待补证据：真实场景来源、教师签字/核验、2 名学生 + 1 名教师真人试用、星辰公开体验地址、负责人签署的合规文件。',
  '- AI 模拟：仅用于内部演示，不得改名或放入第 8 项真实证据位。',
  '- 内部演示录屏：位于 `02-作品Demo/演示录屏/`，仅证明前端操作闭环，不替代真人试用。',
  '',
  '源码包明确不包含 `.env`、密钥、日志、数据库、`node_modules`、`dist`、上传文件和未授权原始图片。',
  '',
  '竞赛目录映射：01-报名信息→01-参赛信息；02-作品Demo→02-作品Demo；03-作品说明→03-作品方案；04-作品源码→04-作品代码；05-安全与合规→05-伦理与安全合规性声明；06-补充材料→06-其他材料。',
  '正式提交前请先阅读 `06-其他材料/AI数据标注实训智能体-证据包索引.md` 和 `AI数据标注实训智能体-提交前总清单.md`。',
  '封包后可在仓库根目录运行 `powershell -NoProfile -ExecutionPolicy Bypass -File .\\scripts\\verify-ai-annotation-package.ps1 -ArchivePath <zip路径>` 做完整性验真。'
) -join [Environment]::NewLine
Set-Content -LiteralPath (Join-Path $staging "README.md") -Value $readme -Encoding UTF8

$manifest = [ordered]@{
  generated_at = (Get-Date).ToUniversalTime().ToString("o")
  package_type = "submission-materials-external-evidence-pending"
  work_code = "600370"
  school = "南京林业大学"
  team_leader = "韩盛豪"
  agent_id = "5816885"
  agent_publish_status = "submitted-for-review"
  professional_group = "人工智能技术应用专业群（计算机视觉方向）"
  target_job = "AI 数据标注工程师"
  entry = "/annotation-agent"
  core_rule_count = 3
  knowledge_entry_count = 60
  official_directories = @("01-参赛信息", "02-作品Demo", "03-作品方案", "04-作品代码", "05-伦理与安全合规性声明", "06-其他材料")
  include_screenshots = [bool]$IncludeScreenshots
  external_evidence_status = "待真实场景、教师核验和真人试用"
  copied_source_count = $copied.Count
}
$manifestJson = $manifest | ConvertTo-Json -Depth 5
# Keep the manifest readable by both PowerShell 5.1 (which otherwise falls
# back to the active ANSI code page) and PowerShell 7.  The BOM makes the
# encoding unambiguous while preserving all Chinese metadata.
[IO.File]::WriteAllText(
  (Join-Path $staging "package-manifest.json"),
  $manifestJson,
  (New-Object Text.UTF8Encoding($true))
)

function Get-Sha256Hex([string]$filePath) {
  $sha = [System.Security.Cryptography.SHA256]::Create()
  $stream = [IO.File]::OpenRead($filePath)
  try {
    return ([BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-', '')
  } finally {
    $stream.Dispose()
    $sha.Dispose()
  }
}

$hashLines = Get-ChildItem -LiteralPath $staging -Recurse -File | Sort-Object FullName | ForEach-Object {
  $relative = $_.FullName.Substring($staging.Length + 1).Replace('\', '/')
  $hash = Get-Sha256Hex $_.FullName
  "$hash  $relative"
}
$hashPath = Join-Path $staging "SHA256SUMS.txt"
# Keep Unicode filenames intact.  ASCII encoding turns Chinese paths into
# question marks and makes a later hash verification impossible.
[IO.File]::WriteAllLines($hashPath, [string[]]$hashLines, (New-Object Text.UTF8Encoding($true)))

if (Test-Path -LiteralPath $archive) { Remove-Item -LiteralPath $archive -Force }
Compress-Archive -LiteralPath $staging -DestinationPath $archive -CompressionLevel Optimal -Force
Write-Host "提交资料包目录：$staging"
Write-Host "提交资料包压缩文件：$archive"
Write-Host "已收集文件：$($copied.Count)"
