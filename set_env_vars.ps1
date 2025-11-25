# Set environment variables for Azure App Service

$resourceGroup = "stockspace-rg"
$appServiceName = "stockspace-api-01"

$dbUrl = "postgresql://postgres:Tomokin1225@stockspace-db.postgres.database.azure.com:5432/stockspace?sslmode=require"
$secretKey = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})

Write-Host "Setting environment variables..." -ForegroundColor Yellow

az webapp config appsettings set `
  --resource-group $resourceGroup `
  --name $appServiceName `
  --settings `
    "DATABASE_URL=$dbUrl" `
    "SECRET_KEY=$secretKey" `
    "ALGORITHM=HS256" `
    "ACCESS_TOKEN_EXPIRE_MINUTES=30" `
    "ALLOWED_ORIGINS=*" `
    "AUTO_CREATE_TABLES=false"

if ($LASTEXITCODE -eq 0) {
    Write-Host "Environment variables set successfully" -ForegroundColor Green
} else {
    Write-Host "Failed to set environment variables" -ForegroundColor Red
    exit 1
}

Write-Host "`nRestarting App Service..." -ForegroundColor Yellow
az webapp restart --resource-group $resourceGroup --name $appServiceName

Write-Host "`nDone! Wait 2-3 minutes, then check:" -ForegroundColor Green
Write-Host "https://$appServiceName.azurewebsites.net/docs" -ForegroundColor Cyan


