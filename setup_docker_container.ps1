# Dockerコンテナ設定スクリプト（stockspace-api-01用）

Write-Host "=== Dockerコンテナ設定 ===" -ForegroundColor Cyan

$resourceGroup = "stockspace-rg"
$appServiceName = "stockspace-api-01"
$acrName = "stockspaceregistry"

# 1. ACRのパスワードを取得
Write-Host "`n[1/3] ACRのパスワードを取得中..." -ForegroundColor Yellow
$acrPassword = (az acr credential show --name $acrName --query "passwords[0].value" -o tsv)
if (-not $acrPassword) {
    Write-Host "ACRパスワードの取得に失敗しました" -ForegroundColor Red
    exit 1
}
Write-Host "ACRパスワードを取得しました" -ForegroundColor Green

# 2. Dockerコンテナを設定
Write-Host "`n[2/3] Dockerコンテナを設定中..." -ForegroundColor Yellow
# バッチファイル経由で実行（PowerShellのパイプ文字問題を回避）
$batchContent = "@echo off`naz webapp config set --resource-group $resourceGroup --name $appServiceName --linux-fx-version `"DOCKER|$acrName.azurecr.io/backend:latest`""
$batchContent | Out-File -FilePath "temp_set_docker.bat" -Encoding ASCII
& .\temp_set_docker.bat
Remove-Item "temp_set_docker.bat" -ErrorAction SilentlyContinue

if ($LASTEXITCODE -ne 0) {
    Write-Host "Dockerコンテナの設定に失敗しました" -ForegroundColor Red
    exit 1
}
Write-Host "Dockerコンテナを設定しました: $dockerImage" -ForegroundColor Green

# 3. ACR認証情報を設定
Write-Host "`n[3/3] ACR認証情報を設定中..." -ForegroundColor Yellow
az webapp config appsettings set `
  --resource-group $resourceGroup `
  --name $appServiceName `
  --settings `
    DOCKER_REGISTRY_SERVER_URL="https://$acrName.azurecr.io" `
    DOCKER_REGISTRY_SERVER_USERNAME="$acrName" `
    DOCKER_REGISTRY_SERVER_PASSWORD="$acrPassword"

if ($LASTEXITCODE -ne 0) {
    Write-Host "ACR認証情報の設定に失敗しました" -ForegroundColor Red
    exit 1
}
Write-Host "ACR認証情報を設定しました" -ForegroundColor Green

# 4. App Serviceを再起動
Write-Host "`n[4/4] App Serviceを再起動中..." -ForegroundColor Yellow
az webapp restart --resource-group $resourceGroup --name $appServiceName
if ($LASTEXITCODE -ne 0) {
    Write-Host "App Serviceの再起動に失敗しました" -ForegroundColor Red
    exit 1
}
Write-Host "App Serviceを再起動しました" -ForegroundColor Green

Write-Host "`n=== 完了 ===" -ForegroundColor Green
Write-Host "設定を確認:" -ForegroundColor Cyan
az webapp config show --resource-group $resourceGroup --name $appServiceName --query "{linuxFxVersion:linuxFxVersion}" -o json

Write-Host "`n2-3分待ってから、以下にアクセスしてください:" -ForegroundColor Cyan
$baseUrl = "https://" + $appServiceName + ".azurewebsites.net"
Write-Host ($baseUrl + "/") -ForegroundColor White
Write-Host ($baseUrl + "/docs") -ForegroundColor White

