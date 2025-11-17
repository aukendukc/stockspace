# Azure App Service ログ確認スクリプト

Write-Host "=== App Service ログ確認 ===" -ForegroundColor Cyan
Write-Host ""

# 診断ログを有効化
Write-Host "診断ログを有効化中..." -ForegroundColor Yellow
az webapp log config `
  --resource-group stockspace-rg `
  --name stockspace-api `
  --application-logging filesystem `
  --detailed-error-messages true `
  --failed-request-tracing true `
  --web-server-logging filesystem `
  --docker-container-logging filesystem

Write-Host ""
Write-Host "=== リアルタイムログを表示します（Ctrl+Cで終了） ===" -ForegroundColor Green
Write-Host ""

# リアルタイムログを表示
az webapp log tail `
  --resource-group stockspace-rg `
  --name stockspace-api



