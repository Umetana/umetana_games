param(
    [Parameter(Mandatory = $false)]
    [ValidatePattern('^[A-Za-z0-9_-]+$')]
    [string]$WorkId = 'sansu-quest'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$workRoot = Join-Path $projectRoot "works\$WorkId"
$outputRoot = Join-Path $projectRoot "dist\$WorkId"

if (-not (Test-Path -LiteralPath (Join-Path $workRoot 'game.json'))) {
    throw "作品が見つかりません: $WorkId"
}

$resolvedProject = [IO.Path]::GetFullPath($projectRoot)
$resolvedOutput = [IO.Path]::GetFullPath($outputRoot)
if (-not $resolvedOutput.StartsWith(($resolvedProject + [IO.Path]::DirectorySeparatorChar), [StringComparison]::OrdinalIgnoreCase)) {
    throw '出力先がプロジェクト外です。'
}

if (Test-Path -LiteralPath $resolvedOutput) {
    Remove-Item -LiteralPath $resolvedOutput -Recurse -Force
}
New-Item -ItemType Directory -Path $resolvedOutput -Force | Out-Null

$game = Get-Content -LiteralPath (Join-Path $workRoot 'game.json') -Raw | ConvertFrom-Json
$eventMap = @{
    multiplicationQuiz = 'multiplication-quiz'
}
$usedEvents = @($game.scenes.PSObject.Properties.Value | ForEach-Object {
    $_ | Where-Object { $_.type -eq 'event' } | ForEach-Object { $_.event }
} | Sort-Object -Unique)

Copy-Item -LiteralPath (Join-Path $workRoot 'game.json') -Destination $resolvedOutput
Copy-Item -LiteralPath (Join-Path $workRoot 'theme.css') -Destination $resolvedOutput
Copy-Item -LiteralPath (Join-Path $workRoot 'assets') -Destination $resolvedOutput -Recurse
Copy-Item -LiteralPath (Join-Path $projectRoot 'engine\event-registry.js') -Destination $resolvedOutput
Copy-Item -LiteralPath (Join-Path $projectRoot 'engine\validator.js') -Destination $resolvedOutput
Copy-Item -LiteralPath (Join-Path $projectRoot 'engine\player.js') -Destination $resolvedOutput
Copy-Item -LiteralPath (Join-Path $projectRoot 'engine\player.css') -Destination $resolvedOutput

$html = Get-Content -LiteralPath (Join-Path $workRoot 'index.html') -Raw
$html = $html.Replace('../../engine/player.css', 'player.css')
$html = $html.Replace('../../engine/event-registry.js', 'event-registry.js')
$html = $html.Replace('../../engine/validator.js', 'validator.js')
$html = $html.Replace('../../engine/player.js', 'player.js')

foreach ($eventId in $usedEvents) {
    if (-not $eventMap.ContainsKey($eventId)) {
        throw "公開処理に未登録のイベントです: $eventId"
    }
    $folder = $eventMap[$eventId]
    $source = Join-Path $projectRoot "events\$folder"
    $scriptName = "event-$folder.js"
    $styleName = "event-$folder.css"
    Copy-Item -LiteralPath (Join-Path $source 'event.js') -Destination (Join-Path $resolvedOutput $scriptName)
    Copy-Item -LiteralPath (Join-Path $source 'event.css') -Destination (Join-Path $resolvedOutput $styleName)
    $html = $html.Replace("../../events/$folder/event.js", $scriptName)
    $html = $html.Replace("../../events/$folder/event.css", $styleName)
}

Set-Content -LiteralPath (Join-Path $resolvedOutput 'index.html') -Value $html -Encoding utf8NoBOM
Write-Output "公開用フォルダを作成しました: $resolvedOutput"
