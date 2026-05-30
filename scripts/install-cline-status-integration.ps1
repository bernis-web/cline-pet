param(
  [string]$RulesDir = 'C:\Users\28417\Documents\Cline\Rules',
  [string]$McpSettingsPath = 'C:\Users\28417\AppData\Roaming\Code\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json',
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'

$ruleSource = Join-Path $ProjectRoot 'docs\cline-global-rule.md'
$ruleTarget = Join-Path $RulesDir 'cline-desktop-pet.md'

if (-not (Test-Path -LiteralPath $ruleSource)) {
  throw "Rule source does not exist: $ruleSource"
}

New-Item -ItemType Directory -Force -Path $RulesDir | Out-Null
Copy-Item -LiteralPath $ruleSource -Destination $ruleTarget -Force

$settingsDir = Split-Path -Parent $McpSettingsPath
New-Item -ItemType Directory -Force -Path $settingsDir | Out-Null

if (Test-Path -LiteralPath $McpSettingsPath) {
  $settingsText = Get-Content -LiteralPath $McpSettingsPath -Raw
  if ([string]::IsNullOrWhiteSpace($settingsText)) {
    $settings = [pscustomobject]@{}
  } else {
    $settings = $settingsText | ConvertFrom-Json
  }
} else {
  $settings = [pscustomobject]@{}
}

if (-not $settings.PSObject.Properties['mcpServers']) {
  $settings | Add-Member -MemberType NoteProperty -Name 'mcpServers' -Value ([pscustomobject]@{})
}

$server = [ordered]@{
  command = 'cmd'
  args = @('/c', 'npm', '--prefix', $ProjectRoot, 'run', 'dev:mcp')
  disabled = $false
  autoApprove = @('update_pet_status', 'pet_status_check')
}

if ($settings.mcpServers.PSObject.Properties['cline-desktop-pet']) {
  $settings.mcpServers.'cline-desktop-pet' = $server
} else {
  $settings.mcpServers | Add-Member -MemberType NoteProperty -Name 'cline-desktop-pet' -Value $server
}

$settingsJson = $settings | ConvertTo-Json -Depth 20
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($McpSettingsPath, $settingsJson, $utf8NoBom)

Write-Host "Installed Cline Desktop Pet rule: $ruleTarget"
Write-Host "Updated Cline MCP settings: $McpSettingsPath"
Write-Host "Please reload VS Code/Cline so the MCP server and global rule are picked up."