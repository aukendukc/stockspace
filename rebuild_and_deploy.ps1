# Rebuild and Deploy Docker Image

Write-Host "=== Rebuilding Docker Image ===" -ForegroundColor Cyan

# ACRにログイン
Write-Host "Logging into ACR..." -ForegroundColor Yellow
az acr login --name stockspaceregistry

# イメージをビルド
Write-Host "Building Docker image..." -ForegroundColor Yellow
docker build -t stockspaceregistry.azurecr.io/backend:latest .

# イメージをプッシュ
Write-Host "Pushing image to ACR..." -ForegroundColor Yellow
docker push stockspaceregistry.azurecr.io/backend:latest

# App Serviceを再起動
Write-Host "Restarting App Service..." -ForegroundColor Yellow
az webapp restart --resource-group stockspace-rg --name stockspace-api

Write-Host ""
Write-Host "=== DONE ===" -ForegroundColor Green
Write-Host "Wait 2-3 minutes, then check: https://stockspace-api.azurewebsites.net/docs" -ForegroundColor Cyan



