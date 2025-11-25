# Fix CORS settings for mobile app

Write-Host "=== Fixing CORS Settings ===" -ForegroundColor Cyan

# CORS設定を更新（モバイルアプリからのアクセスを許可）
az webapp config appsettings set `
  --resource-group stockspace-rg `
  --name stockspace-api `
  --settings ALLOWED_ORIGINS="*"

Write-Host "CORS settings updated to allow all origins" -ForegroundColor Green
Write-Host "Restarting App Service..." -ForegroundColor Yellow

az webapp restart --resource-group stockspace-rg --name stockspace-api

Write-Host ""
Write-Host "=== DONE ===" -ForegroundColor Green
Write-Host "Note: Make sure mobile app is running in production mode (not __DEV__)" -ForegroundColor Yellow








