# ACR認証設定を修正するスクリプト

Write-Host "=== ACR認証設定を修正 ===" -ForegroundColor Cyan
Write-Host ""

# ACRのパスワードを取得
Write-Host "ACRの認証情報を取得中..." -ForegroundColor Yellow
$acrPassword = (az acr credential show --name stockspaceregistry --query "passwords[0].value" -o tsv)

if ([string]::IsNullOrEmpty($acrPassword)) {
    Write-Host "エラー: ACRのパスワードを取得できませんでした" -ForegroundColor Red
    exit 1
}

Write-Host "ACRパスワードを取得しました" -ForegroundColor Green
Write-Host ""

# コンテナ設定を更新（新しいコマンド形式を使用）
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

