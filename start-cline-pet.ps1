$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Cline 桌面电子宠物 一键启动" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Host "未找到 npm。请先安装 Node.js：https://nodejs.org/" -ForegroundColor Red
  exit 1
}

if (-not (Test-Path "node_modules")) {
  Write-Host "首次启动：正在安装依赖 npm install ..." -ForegroundColor Yellow
  npm install
}

if (-not (Test-Path "node_modules\electron")) {
  Write-Host "正在安装 Electron。首次下载可能较慢，请耐心等待..." -ForegroundColor Yellow
  npm install --include=optional electron
}

Write-Host "正在启动桌宠..." -ForegroundColor Green
npm run dev:electron