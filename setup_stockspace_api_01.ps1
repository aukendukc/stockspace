# stockspace-api-01 の設定スクリプト

Write-Host "=== stockspace-api-01 設定 ===" -ForegroundColor Cyan

$resourceGroup = "stockspace-rg"
$appServiceName = "stockspace-api-01"
$acrName = "stockspaceregistry"

# 1. ACRのパスワードを取得
Write-Host "`n[1/5] ACRのパスワードを取得中..." -ForegroundColor Yellow
$acrPassword = (az acr credential show --name $acrName --query "passwords[0].value" -o tsv)
if (-not $acrPassword) {
    Write-Host "ACRパスワードの取得に失敗しました" -ForegroundColor Red
    exit 1
}
Write-Host "ACRパスワードを取得しました" -ForegroundColor Green

# 2. コンテナ設定を更新（Dockerコンテナを使用）
Write-Host "`n[2/5] コンテナ設定を更新中..." -ForegroundColor Yellow
$customImageName = "DOCKER|" + $acrName + ".azurecr.io/backend:latest"
$registryUrl = "https://" + $acrName + ".azurecr.io"

# コンテナ設定を設定
az webapp config container set `
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

# 3. データベース接続文字列を取得
Write-Host "`n[3/5] データベース接続文字列を取得中..." -ForegroundColor Yellow
$dbHost = (az postgres flexible-server show --resource-group $resourceGroup --name stockspace-db --query fullyQualifiedDomainName -o tsv 2>$null)
if (-not $dbHost) {
    Write-Host "データベースが見つかりません。PostgreSQLのパスワードを入力してください:" -ForegroundColor Yellow
    $dbPassword = Read-Host -AsSecureString
    $dbPasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($dbPassword))
} else {
    Write-Host "データベースホスト: $dbHost" -ForegroundColor Green
    Write-Host "PostgreSQLのパスワードを入力してください:" -ForegroundColor Yellow
    $dbPassword = Read-Host -AsSecureString
    $dbPasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($dbPassword))
}

# 4. 環境変数を設定
Write-Host "`n[4/5] 環境変数を設定中..." -ForegroundColor Yellow
$dbUrl = "postgresql://postgres:" + $dbPasswordPlain + "@" + $dbHost + ":5432/stockspace?sslmode=require"
$secretKey = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})

az webapp config appsettings set `
  --resource-group $resourceGroup `
  --name $appServiceName `
  --settings `
    DATABASE_URL=$dbUrl `
    ALLOWED_ORIGINS="*" `
    AUTO_CREATE_TABLES="false" `
    SECRET_KEY=$secretKey `
    ALGORITHM="HS256" `
    ACCESS_TOKEN_EXPIRE_MINUTES="30"

if ($LASTEXITCODE -ne 0) {
    Write-Host "環境変数の設定に失敗しました" -ForegroundColor Red
    exit 1
}
Write-Host "環境変数を設定しました" -ForegroundColor Green

# 5. App Serviceを再起動
Write-Host "`n[5/5] App Serviceを再起動中..." -ForegroundColor Yellow
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



