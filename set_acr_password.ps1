# ACRパスワードを環境変数として設定

Write-Host "=== ACR認証情報を設定 ===" -ForegroundColor Cyan
Write-Host ""

# ACRのパスワードを取得
Write-Host "ACRの認証情報を取得中..." -ForegroundColor Yellow
$acrPassword = (az acr credential show --name stockspaceregistry --query "passwords[0].value" -o tsv)

if ([string]::IsNullOrEmpty($acrPassword)) {
    Write-Host "エラー: ACRのパスワードを取得できませんでした" -ForegroundColor Red
    exit 1
}

Write-Host "ACRパスワードを取得しました（長さ: $($acrPassword.Length)文字）" -ForegroundColor Green
Write-Host ""

# 環境変数として設定（1行で実行）
Write-Host "環境変数を設定中..." -ForegroundColor Yellow
az webapp config appsettings set --resource-group stockspace-rg --name stockspace-api --settings DOCKER_REGISTRY_SERVER_URL="https://stockspaceregistry.azurecr.io" DOCKER_REGISTRY_SERVER_USERNAME="stockspaceregistry" DOCKER_REGISTRY_SERVER_PASSWORD="$acrPassword" DOCKER_CUSTOM_IMAGE_NAME="DOCKER|stockspaceregistry.azurecr.io/backend:latest"

Write-Host ""
Write-Host "環境変数を設定しました" -ForegroundColor Green
Write-Host ""

# 設定を確認
Write-Host "設定を確認中..." -ForegroundColor Yellow
az webapp config appsettings list --resource-group stockspace-rg --name stockspace-api --query "[?name=='DOCKER_REGISTRY_SERVER_PASSWORD']" --output table

Write-Host ""
Write-Host "App Serviceを再起動中..." -ForegroundColor Yellow
az webapp restart --resource-group stockspace-rg --name stockspace-api

Write-Host ""
Write-Host "=== 完了しました ===" -ForegroundColor Green
Write-Host "数分待ってから https://stockspace-api.azurewebsites.net/docs にアクセスしてください" -ForegroundColor Yellow








