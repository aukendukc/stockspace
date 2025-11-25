# ACR認証設定を修正するスクリプト（新しいコマンド形式）

Write-Host "=== ACR認証設定を修正 ===" -ForegroundColor Cyan
Write-Host ""

# ACRのパスワードを取得
Write-Host "ACRの認証情報を取得中..." -ForegroundColor Yellow
$acrPassword = (az acr credential show --name stockspaceregistry --query "passwords[0].value" -o tsv)

if ([string]::IsNullOrEmpty($acrPassword)) {
    Write-Host "エラー: ACRのパスワードを取得できませんでした" -ForegroundColor Red
    Write-Host "ACRの認証情報を確認してください" -ForegroundColor Yellow
    exit 1
}

Write-Host "ACRパスワードを取得しました（長さ: $($acrPassword.Length)文字）" -ForegroundColor Green
Write-Host ""

# 環境変数として直接設定（より確実な方法）
Write-Host "環境変数としてACR認証情報を設定中..." -ForegroundColor Yellow
az webapp config appsettings set `
  --resource-group stockspace-rg `
  --name stockspace-api `
  --settings `
    DOCKER_REGISTRY_SERVER_URL="https://stockspaceregistry.azurecr.io" `
    DOCKER_REGISTRY_SERVER_USERNAME="stockspaceregistry" `
    DOCKER_REGISTRY_SERVER_PASSWORD="$acrPassword" `
    DOCKER_CUSTOM_IMAGE_NAME="DOCKER|stockspaceregistry.azurecr.io/backend:latest"

Write-Host ""
Write-Host "環境変数を設定しました" -ForegroundColor Green
Write-Host ""

# コンテナ設定も更新（新しいコマンド形式）
Write-Host "コンテナ設定を更新中..." -ForegroundColor Yellow
az webapp config container set `
  --name stockspace-api `
  --resource-group stockspace-rg `
  --container-image-name stockspaceregistry.azurecr.io/backend:latest `
  --container-registry-url https://stockspaceregistry.azurecr.io `
  --container-registry-user stockspaceregistry `
  --container-registry-password $acrPassword

Write-Host ""
Write-Host "コンテナ設定を更新しました" -ForegroundColor Green
Write-Host ""

# App Serviceを再起動
Write-Host "App Serviceを再起動中..." -ForegroundColor Yellow
az webapp restart `
  --resource-group stockspace-rg `
  --name stockspace-api

Write-Host ""
Write-Host "=== 完了しました ===" -ForegroundColor Green
Write-Host "数分待ってから https://stockspace-api.azurewebsites.net/docs にアクセスしてください" -ForegroundColor Yellow
Write-Host ""
Write-Host "設定を確認するには:" -ForegroundColor Cyan
Write-Host "az webapp config appsettings list --resource-group stockspace-rg --name stockspace-api --output table" -ForegroundColor Gray








