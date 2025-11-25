# Run Database Migration

Write-Host "=== Running Database Migration ===" -ForegroundColor Cyan

# 自分のIPアドレスを取得
Write-Host "Getting your IP address..." -ForegroundColor Yellow
$myIP = (Invoke-WebRequest -Uri "https://api.ipify.org" -UseBasicParsing).Content
Write-Host "Your IP: $myIP" -ForegroundColor Green

# ファイアウォールルールを追加
Write-Host "Adding firewall rule..." -ForegroundColor Yellow
az postgres flexible-server firewall-rule create `
  --resource-group stockspace-rg `
  --name stockspace-db `
  --rule-name AllowMyIP `
  --start-ip-address $myIP `
  --end-ip-address $myIP

Write-Host ""
Write-Host "Setting DATABASE_URL environment variable..." -ForegroundColor Yellow
$env:DATABASE_URL="postgresql://postgres:tomokin1225@stockspace-db.postgres.database.azure.com:5432/stockspace?sslmode=require"

Write-Host "Running migration..." -ForegroundColor Yellow
python migrate_db.py

Write-Host ""
Write-Host "=== Migration Complete ===" -ForegroundColor Green
Write-Host "You can now test the API at: https://stockspace-api.azurewebsites.net/docs" -ForegroundColor Cyan








