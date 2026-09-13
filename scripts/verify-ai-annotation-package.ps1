[CmdletBinding()]
param(
  [string]$ArchivePath = ""
)

# Keep this verifier ASCII-only so it parses under Windows PowerShell 5.1 even
# when the file is checked out without a UTF-8 BOM. The archive may contain
# Non-ASCII names are checked by extension and directory shape below.
$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot

if ($ArchivePath) {
  $archive = [IO.Path]::GetFullPath($ArchivePath)
} else {
  $candidate = @(Get-ChildItem -LiteralPath (Join-Path $repo "output") -File -Filter "ai-annotation-package-*.zip" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1)
  if ($candidate.Count -eq 0) { throw "No ai-annotation-package-*.zip found under output." }
  $archive = $candidate[0].FullName
}
if (-not (Test-Path -LiteralPath $archive -PathType Leaf)) {
  throw "Archive not found: $archive"
}

$temp = Join-Path ([IO.Path]::GetTempPath()) ("ai-annotation-package-" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $temp | Out-Null

function Fail([string]$message) {
  throw "Package verification failed: $message"
}

try {
  Expand-Archive -LiteralPath $archive -DestinationPath $temp -Force
  $manifest = @(Get-ChildItem -LiteralPath $temp -Recurse -File -Filter "package-manifest.json" | Select-Object -First 1)
  if ($manifest.Count -eq 0) { Fail "missing package-manifest.json" }
  $stage = $manifest[0].Directory.FullName

  # Read the manifest before resolving the official directories.  Keeping the
  # verifier source ASCII-only makes it parse under Windows PowerShell 5.1;
  # the package itself may (and does) contain Unicode directory names.
  $manifestText = [IO.File]::ReadAllText($manifest[0].FullName, [Text.Encoding]::UTF8)
  $manifestObject = $manifestText | ConvertFrom-Json
  if ($manifestObject.package_type -ne "technical-pre-submission") {
    Fail "package_type is not technical-pre-submission"
  }
  if ([string]::IsNullOrWhiteSpace([string]$manifestObject.external_evidence_status)) {
    Fail "external evidence status is empty"
  }

  $officialDirectories = @($manifestObject.official_directories)
  if ($officialDirectories.Count -lt 6) { Fail "manifest lists fewer than six official directories" }
  $officialRoots = @{}
  foreach ($prefix in @("01-", "02-", "03-", "04-", "05-", "06-")) {
    $directory = @($officialDirectories | Where-Object { ([string]$_).StartsWith($prefix) } | Select-Object -First 1)
    if ($directory.Count -eq 0 -or -not (Test-Path -LiteralPath (Join-Path $stage $directory[0]) -PathType Container)) {
      Fail "missing official submission directory with prefix: $prefix"
    }
    $officialRoots[$prefix] = Join-Path $stage $directory[0]
  }

  $sourcePage = @(Get-ChildItem -LiteralPath $officialRoots["04-"] -Recurse -File -Filter "AIAnnotationAgent.tsx")
  $sourceRules = @(Get-ChildItem -LiteralPath $officialRoots["04-"] -Recurse -File -Filter "aiAnnotationRules.ts")
  $knowledgeSource = @(Get-ChildItem -LiteralPath $officialRoots["04-"] -Recurse -File -Filter "aiAnnotationKnowledge.ts")
  $officialWebRoot = Join-Path $officialRoots["04-"] "source\a3-student-react-web"
  $officialStartScript = Join-Path $officialRoots["04-"] "source\scripts\start-ai-annotation.ps1"
  $projectDoc = @(Get-ChildItem -LiteralPath $officialRoots["03-"] -Recurse -File -Filter "*.docx")
  $deck = @(Get-ChildItem -LiteralPath $officialRoots["03-"] -Recurse -File -Filter "*.pptx")
  $demoRecordings = @(Get-ChildItem -LiteralPath $officialRoots["02-"] -Recurse -File | Where-Object {
    ($_.Extension -in @(".mp4", ".webm")) -and $_.Length -gt 1000
  })
  # The package layout reserves the 06- directory for the declaration and
  # evidence index. Requiring at least two Markdown files there catches a
  # missing declaration without embedding locale-dependent Chinese literals.
  $declaration = @(Get-ChildItem -LiteralPath $officialRoots["06-"] -Recurse -File -Filter "*.md")
  # Find the gap-audit document by a runtime Unicode needle instead of a
  # locale-sensitive filename literal.
  $gapNeedle = [string]([char]0x7F3A) + [string]([char]0x53E3)
  $gapPlan = @(Get-ChildItem -LiteralPath $stage -Recurse -File -Filter "*.md" | Where-Object {
    ([IO.File]::ReadAllText($_.FullName, [Text.Encoding]::UTF8)).Contains($gapNeedle)
  })
  if ($sourcePage.Count -eq 0) { Fail "missing AIAnnotationAgent.tsx" }
  if ($sourceRules.Count -eq 0) { Fail "missing aiAnnotationRules.ts" }
  if ($knowledgeSource.Count -eq 0) { Fail "missing aiAnnotationKnowledge.ts" }
  if (-not (Test-Path -LiteralPath (Join-Path $officialWebRoot "package.json") -PathType Leaf)) {
    Fail "official source tree is not runnable at 04-作品代码/source/a3-student-react-web"
  }
  if (-not (Test-Path -LiteralPath $officialStartScript -PathType Leaf)) {
    Fail "missing official start script"
  }
  if (Test-Path -LiteralPath (Join-Path $officialRoots["04-"] "source\source")) {
    Fail "unexpected nested source/source directory"
  }
  if ($projectDoc.Count -eq 0) { Fail "missing project DOCX" }
  if ($deck.Count -eq 0) { Fail "missing presentation PPTX" }
  if ($demoRecordings.Count -eq 0) { Fail "missing non-empty internal demo recording" }
  if ($declaration.Count -lt 2) { Fail "missing external evidence declaration/index files" }
  if ($gapPlan.Count -eq 0) { Fail "missing gap audit plan" }
  if (($deck | Where-Object { $_.Length -gt 100MB }).Count -gt 0) { Fail "presentation exceeds 100 MB" }

  $knowledgeText = [IO.File]::ReadAllText($knowledgeSource[0].FullName, [Text.Encoding]::UTF8)
  $knowledgeIdCount = ([regex]::Matches($knowledgeText, 'candidate\(\s*"K\d{3}"')).Count
  if ($knowledgeIdCount -lt 50) { Fail "knowledge catalogue has fewer than 50 entries: $knowledgeIdCount" }
  $catalog = @(Get-ChildItem -LiteralPath $officialRoots["06-"] -Recurse -File -Filter "*.md" | Where-Object {
    $catalogCandidate = [IO.File]::ReadAllText($_.FullName, [Text.Encoding]::UTF8)
    ([regex]::Matches($catalogCandidate, '(?m)^## K\d{3}\b')).Count -ge 50
  } | Select-Object -First 1)
  if ($catalog.Count -eq 0) { Fail "missing readable knowledge catalogue" }
  $catalogText = [IO.File]::ReadAllText($catalog[0].FullName, [Text.Encoding]::UTF8)
  if (([regex]::Matches($catalogText, '(?m)^## K\d{3}\b')).Count -lt 50) { Fail "readable knowledge catalogue has fewer than 50 headings" }

  $forbidden = @(Get-ChildItem -LiteralPath $stage -Recurse -Force | Where-Object {
    $_.FullName -match "\\node_modules(\\|$)|\\dist(\\|$)|\.env($|\.)|\.sqlite($|\.)|\.db($|\.)|\.log($|\.)|uploaded|upload-temp|secret|token"
  })
  if ($forbidden.Count -gt 0) {
    $names = ($forbidden | Select-Object -ExpandProperty FullName) -join "; "
    Fail "forbidden content found: $names"
  }

  $sumFile = Join-Path $stage "SHA256SUMS.txt"
  if (-not (Test-Path -LiteralPath $sumFile -PathType Leaf)) { Fail "missing SHA256SUMS.txt" }
  $sumLines = @([IO.File]::ReadAllLines($sumFile, [Text.Encoding]::UTF8) | Where-Object { $_.Trim() })
  $listed = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
  foreach ($line in $sumLines) {
    if ($line -notmatch "^([0-9A-Fa-f]{64})\s{2}(.+)$") {
      Fail "unparseable SHA256SUMS line"
    }
    $expected = $Matches[1].ToUpperInvariant()
    $relative = $Matches[2].Replace("/", [IO.Path]::DirectorySeparatorChar)
    if (-not $listed.Add($relative)) { Fail "duplicate hash-list entry: $relative" }
    $file = Join-Path $stage $relative
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
      Fail "hash list references missing file: $relative"
    }
    $actual = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToUpperInvariant()
    if ($actual -ne $expected) { Fail "hash mismatch: $relative" }
  }
  $actualFiles = @(Get-ChildItem -LiteralPath $stage -Recurse -File | Where-Object { $_.FullName -ne $sumFile })
  $actualRelative = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
  foreach ($file in $actualFiles) {
    [void]$actualRelative.Add($file.FullName.Substring($stage.Length + 1))
  }
  foreach ($relative in $listed) {
    if (-not $actualRelative.Contains($relative)) { Fail "hash list contains a path not present in package: $relative" }
  }
  if ($actualRelative.Count -ne $listed.Count) {
    Fail "SHA256SUMS does not cover every package file (listed=$($listed.Count), actual=$($actualRelative.Count))"
  }

  Write-Host "PASS archive: $archive"
  Write-Host "PASS hashes: $($sumLines.Count)"
  Write-Host "PASS required artifacts"
  Write-Host "PASS forbidden-content scan"
} finally {
  if (Test-Path -LiteralPath $temp) {
    $resolvedTemp = [IO.Path]::GetFullPath($temp)
    $pathSeparator = [IO.Path]::DirectorySeparatorChar
    $tempPrefix = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd($pathSeparator) + $pathSeparator
    $tempLeaf = Split-Path -Leaf $resolvedTemp
    if (-not $resolvedTemp.StartsWith($tempPrefix, [StringComparison]::OrdinalIgnoreCase) -or
        -not $tempLeaf.StartsWith("ai-annotation-package-")) {
      throw "Refusing to remove an unvalidated temporary path: $resolvedTemp"
    }
    Remove-Item -LiteralPath $resolvedTemp -Recurse -Force
  }
}
