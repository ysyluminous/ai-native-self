param(
  [Parameter(Mandatory = $true)][string]$Vault
)

$ErrorActionPreference = 'Stop'
$Vault = (Resolve-Path -LiteralPath $Vault).Path
$sync = Join-Path $Vault 'scripts\sync-all.ps1'
$digest = Join-Path $Vault 'scripts\digest.py'
$flywheel = Join-Path $Vault 'scripts\flywheel.py'
$python = (Get-Command python).Source

foreach ($f in @($sync, $digest)) {
  if (-not (Test-Path -LiteralPath $f)) { throw "缺少脚本: $f" }
}

$syncAction = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "{0}"' -f $sync)
$syncTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(10) -RepetitionInterval (New-TimeSpan -Hours 1)
Register-ScheduledTask -TaskName 'ai-native-mem-sync' -Action $syncAction -Trigger $syncTrigger -Description 'omnihist sync + vault/conv to PG mem' -Force | Out-Null

$digestAction = New-ScheduledTaskAction -Execute $python -Argument ('"{0}"' -f $digest)
$digestTrigger = New-ScheduledTaskTrigger -Daily -At 07:00
Register-ScheduledTask -TaskName 'ai-native-daily-digest' -Action $digestAction -Trigger $digestTrigger -Description 'write daily memory digest' -Force | Out-Null

if (Test-Path -LiteralPath $flywheel) {
  $flyAction = New-ScheduledTaskAction -Execute $python -Argument ('"{0}" --vault "{1}"' -f $flywheel, $Vault)
  $flyTrigger = New-ScheduledTaskTrigger -Daily -At 07:30
  Register-ScheduledTask -TaskName 'ai-native-daily-flywheel' -Action $flyAction -Trigger $flyTrigger -Description 'daily flywheel self-test' -Force | Out-Null
}

Get-ScheduledTask -TaskName 'ai-native-mem-sync', 'ai-native-daily-digest' | Select-Object TaskName, State
Write-Output 'tasks registered'
