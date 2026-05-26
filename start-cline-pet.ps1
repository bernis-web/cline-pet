$ErrorActionPreference = 'Stop'

Set-Location -Path $PSScriptRoot
$env:ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/'
$env:npm_config_electron_mirror = 'https://npmmirror.com/mirrors/electron/'

function Stop-CurrentProjectPetProcesses {
  $projectPath = (Resolve-Path $PSScriptRoot).Path.ToLowerInvariant()
  $processes = Get-CimInstance Win32_Process | Where-Object {
    ($_.Name -eq 'electron.exe' -or $_.Name -eq 'node.exe') -and
    $_.CommandLine -and
    $_.CommandLine.ToLowerInvariant().Contains($projectPath)
  }
  foreach ($process in $processes) {
    Write-Host "Stopping stale process $($process.ProcessId) $($process.Name) ..." -ForegroundColor Yellow
    Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
  }
}

Write-Host '========================================' -ForegroundColor Cyan
Write-Host ' Cline Desktop Pet launcher' -ForegroundColor Cyan
Write-Host '========================================' -ForegroundColor Cyan

$bridgeUrl = 'http://127.0.0.1:37621'
$existingApp = $false
try {
  $diagnostics = Invoke-WebRequest -UseBasicParsing -Uri "$bridgeUrl/diagnostics" -TimeoutSec 1
  if ($diagnostics.StatusCode -eq 200) { $existingApp = $true }
} catch {
  $existingApp = $false
}

if ($existingApp) {
  Write-Host 'Cline Desktop Pet is already running. Showing existing window ...' -ForegroundColor Green
  try {
    Invoke-WebRequest -UseBasicParsing -Method Post -Uri "$bridgeUrl/show" -TimeoutSec 2 | Out-Null
    Write-Host 'Existing window show request sent. If you still cannot see it, check the tray icon or restart electron.exe from Task Manager.' -ForegroundColor Green
    exit 0
  } catch {
    Write-Host 'Existing bridge did not support /show. Restarting stale local pet processes ...' -ForegroundColor Yellow
    Stop-CurrentProjectPetProcesses
    Start-Sleep -Seconds 2
  }
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Host 'npm was not found. Please install Node.js first: https://nodejs.org/' -ForegroundColor Red
  exit 1
}

if (-not (Test-Path 'node_modules')) {
  Write-Host 'First run: installing dependencies with npm install ...' -ForegroundColor Yellow
  npm install
}

$electronVersion = (node -p "require('./package-lock.json').packages['node_modules/electron'].version" 2>$null)
if (-not $electronVersion) {
  $electronVersion = (node -p "require('./package.json').optionalDependencies.electron" 2>$null)
}
Write-Host "Electron version target: $electronVersion" -ForegroundColor Cyan

if ((Test-Path 'node_modules\electron') -and -not (Test-Path 'node_modules\electron\dist\electron.exe')) {
  Write-Host 'Detected incomplete Electron install. Removing node_modules/electron ...' -ForegroundColor Yellow
  Remove-Item 'node_modules\electron' -Recurse -Force
}

if (-not (Test-Path 'node_modules\electron\dist\electron.exe')) {
  Write-Host 'Installing Electron via npmmirror. First download may take a while ...' -ForegroundColor Yellow
  npm install --save-optional "electron@$electronVersion"
}

if (-not (Test-Path 'node_modules\electron\dist\electron.exe')) {
  Write-Host 'npm did not finish Electron binary install. Trying install-electron directly ...' -ForegroundColor Yellow
  $env:npm_config_platform = 'win32'
  $env:npm_config_arch = 'x64'
  npx --yes install-electron --mirror=https://npmmirror.com/mirrors/electron/ --no
}

if (-not (Test-Path 'node_modules\electron\dist\electron.exe')) {
  Write-Host 'Electron is still not installed correctly. Check network and retry.' -ForegroundColor Red
  Write-Host 'Manual command: npx install-electron --mirror=https://npmmirror.com/mirrors/electron/ --no' -ForegroundColor Red
  exit 1
}

Write-Host 'Starting Cline Desktop Pet ...' -ForegroundColor Green
npm run dev:electron
