# Azure App Service Deploy Script

Write-Host "=== Azure App Service Deploy ===" -ForegroundColor Cyan

$resourceGroup = "stockspace-rg"
$appServiceName = "stockspace-api-01"
$acrName = "stockspaceregistry"

Write-Host "`n[1/5] Logging in to ACR..." -ForegroundColor Yellow
az acr login --name $acrName
if ($LASTEXITCODE -ne 0) {
    Write-Host "ACR login failed" -ForegroundColor Red
    exit 1
}

Write-Host "`n[2/5] Building Docker image..." -ForegroundColor Yellow
$imageTag = "$acrName.azurecr.io/backend:latest"
docker build -t $imageTag .
if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker build failed" -ForegroundColor Red
    exit 1
}

Write-Host "`n[3/5] Pushing image to ACR..." -ForegroundColor Yellow
docker push $imageTag
if ($LASTEXITCODE -ne 0) {
    Write-Host "Image push failed" -ForegroundColor Red
    exit 1
}

Write-Host "`n[4/5] Checking App Service status..." -ForegroundColor Yellow
$appService = az webapp show --resource-group $resourceGroup --name $appServiceName 2>$null
if (-not $appService) {
    Write-Host "App Service not found" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n[5/5] Restarting App Service..." -ForegroundColor Yellow
az webapp restart --resource-group $resourceGroup --name $appServiceName
if ($LASTEXITCODE -ne 0) {
    Write-Host "App Service restart failed" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== Deploy Complete ===" -ForegroundColor Green
Write-Host "Wait 2-3 minutes, then access:" -ForegroundColor Cyan
$url1 = "https://$appServiceName.azurewebsites.net/"
$url2 = "https://$appServiceName.azurewebsites.net/docs"
Write-Host $url1 -ForegroundColor White
Write-Host $url2 -ForegroundColor White

Write-Host "`nTo check logs:" -ForegroundColor Yellow
$logCmd = "az webapp log tail --resource-group $resourceGroup --name $appServiceName"
Write-Host $logCmd -ForegroundColor White