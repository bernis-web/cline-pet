$source = Join-Path $PSScriptRoot "..\docs\cline-global-rule.md"
$targetDir = "C:\Users\28417\Documents\Cline\Rules"
$target = Join-Path $targetDir "cline-desktop-pet.md"
$answer = Read-Host "Install Cline Desktop Pet global rule to $target ? (y/N)"
if ($answer -eq "y" -or $answer -eq "Y") {
  New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
  Copy-Item -Path $source -Destination $target -Force
  Write-Host "Installed: $target"
} else {
  Write-Host "Cancelled."
}