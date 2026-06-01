# Railway Volume 一次性配置（需已安装 CLI 并 login：npx @railway/cli login）
# 用法：在项目根目录执行 .\scripts\setup-railway-volume.ps1

$ErrorActionPreference = 'Stop'
$cli = 'npx --yes @railway/cli@latest'

Write-Host 'Setting PERSISTENT_DATA_DIR=/data ...'
Invoke-Expression "$cli variables set PERSISTENT_DATA_DIR=/data"

Write-Host 'Adding volume mount at /data (skip if already exists) ...'
Invoke-Expression "$cli volume add --mount-path /data"

Write-Host 'Done. Redeploy the service, then open:'
Write-Host '  https://telegram-novel-app-production-7f1e.up.railway.app/api/health/persistence'
