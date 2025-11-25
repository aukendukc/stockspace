# Azure App Service デプロイ状態確認スクリプト

Write-Host "=== Azure App Service デプロイ状態確認 ===" -ForegroundColor Cyan

$resourceGroup = "stockspace-rg"
$appServiceName = "stockspace-api-01"

# 1. App Serviceの基本情報
Write-Host "`n[1/4] App Serviceの基本情報を確認中..." -ForegroundColor Yellow
$appInfo = az webapp show --resource-group $resourceGroup --name $appServiceName --query "{state:state, defaultHostName:defaultHostName, httpsOnly:httpsOnly, kind:kind}" -o json 2>$null
if ($appInfo) {
    $appInfo | ConvertFrom-Json | Format-List
} else {
    Write-Host "App Serviceが見つかりません" -ForegroundColor Red
    exit 1
}

# 2. 環境変数を確認
Write-Host "`n[2/4] 環境変数を確認中..." -ForegroundColor Yellow
az webapp config appsettings list --resource-group $resourceGroup --name $appServiceName --query "[].{name:name, value:value}" -o table

# 3. コンテナ設定を確認
Write-Host "`n[3/4] コンテナ設定を確認中..." -ForegroundColor Yellow
az webapp config container show --resource-group $resourceGroup --name $appServiceName -o json | ConvertFrom-Json | Format-List

# 4. ログを確認
Write-Host "`n[4/4] 最新のログを確認中..." -ForegroundColor Yellow
Write-Host "(最新10行を表示)" -ForegroundColor Gray
az webapp log tail --resource-group $resourceGroup --name $appServiceName --lines 10 2>$null

Write-Host "`n=== 確認完了 ===" -ForegroundColor Green
Write-Host "`n詳細なログを確認する場合:" -ForegroundColor Yellow
Write-Host "az webapp log tail --resource-group $resourceGroup --name $appServiceName" -ForegroundColor White
Write-Host "`nブラウザで確認:" -ForegroundColor Yellow
$baseUrl = "https://" + $appServiceName + ".azurewebsites.net"
Write-Host ($baseUrl + "/") -ForegroundColor White
Write-Host ($baseUrl + "/docs") -ForegroundColor White
