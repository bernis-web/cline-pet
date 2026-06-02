param(
  [string]$SourceDir = 'E:\xwechat_files\wxid_2gvkgptwgs8b22_6b72\msg\file\2026-05\桌宠小人(1)\桌宠小人',
  [string]$TargetRoot = (Join-Path $env:APPDATA 'cline-desktop-pet\pets')
)

$ErrorActionPreference = 'Stop'

$packId = 'kaka-desktop-pet'
$targetDir = Join-Path $TargetRoot $packId

$files = @(
  @{ Source = '01_待机_1024透明PNG_v2.png'; Target = 'idle.png' },
  @{ Source = '02_开心_1024透明PNG_v1.png'; Target = 'happy.png' },
  @{ Source = '03_困困_1024透明PNG_v1.png'; Target = 'sleepy.png' },
  @{ Source = '04_思考_1024透明PNG_v3.png'; Target = 'thinking.png' },
  @{ Source = '05_炸毛_1024透明PNG_v1.png'; Target = 'angry.png' },
  @{ Source = '06_装死404_1024透明PNG_v1.png'; Target = 'not-found.png' },
  @{ Source = '07_收到消息_1024透明PNG_v1.png'; Target = 'message.png' },
  @{ Source = '08_睡觉_1024透明PNG_v1.png'; Target = 'sleeping.png' },
  @{ Source = '09_摸头反应_1024透明PNG_v1.png'; Target = 'head-pat.png' },
  @{ Source = '10_拖拽反应_1024透明PNG_v1.png'; Target = 'dragging.png' },
  @{ Source = '11_加载中_1024透明PNG_v1.png'; Target = 'loading.png' },
  @{ Source = '12_信号弱_1024透明PNG_v1.png'; Target = 'signal-weak.png' }
)

if (-not (Test-Path -LiteralPath $SourceDir)) {
  throw "Source directory does not exist: $SourceDir"
}

$missing = @()
foreach ($file in $files) {
  $sourcePath = Join-Path $SourceDir $file.Source
  if (-not (Test-Path -LiteralPath $sourcePath)) {
    $missing += $file.Source
  }
}

if ($missing.Count -gt 0) {
  throw "Missing source PNG files: $($missing -join ', ')"
}

New-Item -ItemType Directory -Force -Path $targetDir | Out-Null

foreach ($file in $files) {
  Copy-Item -LiteralPath (Join-Path $SourceDir $file.Source) -Destination (Join-Path $targetDir $file.Target) -Force
}

$manifest = [ordered]@{
  id = $packId
  name = '卡卡桌宠小人'
  version = '1.0.0'
  author = 'local'
  description = '用户本机安装的 12 状态透明 PNG 桌宠小人。'
  formatVersion = 2
  states = [ordered]@{
    idle = 'idle.png'
    happy = 'happy.png'
    sleepy = 'sleepy.png'
    thinking = 'thinking.png'
    angry = 'angry.png'
    'not-found' = 'not-found.png'
    message = 'message.png'
    sleeping = 'sleeping.png'
    'head-pat' = 'head-pat.png'
    dragging = 'dragging.png'
    loading = 'loading.png'
    'signal-weak' = 'signal-weak.png'
  }
  metadata = [ordered]@{
    source = 'local-user-assets'
    assetType = 'transparent-png'
    recommendedSize = 1024
  }
}

$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $targetDir 'manifest.json') -Encoding UTF8

Write-Host "Installed Kaka pet pack to: $targetDir"
Write-Host 'PNG assets were copied to APPDATA only and were not written into the repository.'
