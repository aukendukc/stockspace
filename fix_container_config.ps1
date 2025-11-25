# Azure App Service コンテナ設定修正スクリプト

Write-Host "=== Azure App Service コンテナ設定修正 ===" -ForegroundColor Cyan

$resourceGroup = "stockspace-rg"
$appServiceName = "stockspace-api-01"
$acrName = "stockspaceregistry"

# ACRのパスワードを取得
Write-Host "`n[1/3] ACRのパスワードを取得中..." -ForegroundColor Yellow
$acrPassword = (az acr credential show --name $acrName --query "passwords[0].value" -o tsv)
if (-not $acrPassword) {
    Write-Host "ACRパスワードの取得に失敗しました" -ForegroundColor Red
    exit 1
}
Write-Host "ACRパスワードを取得しました" -ForegroundColor Green

# コンテナ設定を更新
Write-Host "`n[2/3] コンテナ設定を更新中..." -ForegroundColor Yellow
$customImageName = "DOCKER|" + $acrName + ".azurecr.io/backend:latest"
$registryUrl = "https://" + $acrName + ".azurecr.io"
& az webapp config container set `
  --name $appServiceName `
  --resource-group $resourceGroup `
  --docker-custom-image-name $customImageName `
  --docker-registry-server-url $registryUrl `
  --docker-registry-server-user $acrName `
  --docker-registry-server-password $acrPassword

if ($LASTEXITCODE -ne 0) {
    Write-Host "コンテナ設定の更新に失敗しました" -ForegroundColor Red
    exit 1
}
Write-Host "コンテナ設定を更新しました" -ForegroundColor Green

# App Serviceを再起動
Write-Host "`n[3/3] App Serviceを再起動中..." -ForegroundColor Yellow
az webapp restart --resource-group $resourceGroup --name $appServiceName
if ($LASTEXITCODE -ne 0) {
    Write-Host "App Serviceの再起動に失敗しました" -ForegroundColor Red
    exit 1
}
Write-Host "App Serviceを再起動しました" -ForegroundColor Green

Write-Host "`n=== 完了 ===" -ForegroundColor Green
Write-Host "2-3分待ってから、以下にアクセスしてください:" -ForegroundColor Cyan
$baseUrl = "https://" + $appServiceName + ".azurewebsites.net"
Write-Host ($baseUrl + "/") -ForegroundColor White
Write-Host ($baseUrl + "/docs") -ForegroundColor White

