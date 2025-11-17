# Azure App Service 環境変数設定スクリプト
# 使用方法: .\fix_env_vars.ps1 -PostgresPassword "your-actual-password"

param(
    [Parameter(Mandatory=$true)]
    [string]$PostgresPassword
)

# PostgreSQLのホスト名を取得
Write-Host "PostgreSQLのホスト名を取得中..." -ForegroundColor Yellow
$dbHost = (az postgres flexible-server show `
  --resource-group stockspace-rg `
  --name stockspace-db `
  --query fullyQualifiedDomainName `
  --output tsv)

Write-Host "データベースホスト: $dbHost" -ForegroundColor Green

# ランダムなSECRET_KEYを生成
$secretKey = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})

Write-Host "環境変数を設定中..." -ForegroundColor Yellow

# 環境変数を設定
az webapp config appsettings set `
  --resource-group stockspace-rg `
  --name stockspace-api `
  --settings `
    DATABASE_URL="postgresql://postgres:$PostgresPassword@$dbHost:5432/stockspace?sslmode=require" `
    ALLOWED_ORIGINS="*" `
    AUTO_CREATE_TABLES="false" `
    SECRET_KEY="$secretKey" `
    ALGORITHM="HS256" `
    ACCESS_TOKEN_EXPIRE_MINUTES="30"

Write-Host "環境変数の設定が完了しました！" -ForegroundColor Green
Write-Host "App Serviceを再起動します..." -ForegroundColor Yellow

# App Serviceを再起動
az webapp restart `
  --resource-group stockspace-rg `
  --name stockspace-api

Write-Host "完了しました！数分待ってから https://stockspace-api.azurewebsites.net/docs にアクセスしてください。" -ForegroundColor Green



