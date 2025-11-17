# Azure クイックスタートガイド（Students向け）

## 5分で始めるAzureデプロイ

### 1. 前提条件チェック

- [ ] Azure Studentsアカウント作成済み
- [ ] $100クレジット確認済み
- [ ] Azure CLIインストール済み

### 2. 初期設定（初回のみ）

```powershell
# Azure CLIログイン
az login

# サブスクリプション確認
az account list --output table

# サブスクリプション選択
az account set --subscription "Your Subscription Name"
```

### 3. リソースグループ作成

```powershell
az group create --name stockspace-rg --location japaneast
```

### 4. PostgreSQL作成

**重要**: まずリソースプロバイダーを登録する必要があります。

```powershell
# PostgreSQLリソースプロバイダーを登録
az provider register --namespace Microsoft.DBforPostgreSQL

# 登録状況を確認（完了するまで数分かかる場合があります）
az provider show --namespace Microsoft.DBforPostgreSQL --query "registrationState"

# 登録が完了したら（"Registered"と表示される）、PostgreSQLサーバー作成
az postgres flexible-server create `
  --resource-group stockspace-rg `
  --name stockspace-db `
  --location japaneast `
  --admin-user postgres `
  --admin-password YOUR_SECURE_PASSWORD `
  --sku-name Standard_B1ms `
  --tier Burstable `
  --version 15 `
  --public-access 0.0.0.0

# データベース作成
az postgres flexible-server db create `
  --resource-group stockspace-rg `
  --server-name stockspace-db `
  --database-name stockspace

# 接続文字列確認（後で使用）
az postgres flexible-server show-connection-string `
  --server-name stockspace-db `
  --database-name stockspace `
  --admin-user postgres `
  --admin-password YOUR_SECURE_PASSWORD
```

### 5. ストレージ作成

**重要**: まずストレージ用のリソースプロバイダーを登録する必要があります。

```powershell
# ストレージリソースプロバイダーを登録
az provider register --namespace Microsoft.Storage

# 登録状況を確認
az provider show --namespace Microsoft.Storage --query "registrationState"

# 登録が完了したら（"Registered"と表示される）、ストレージアカウント作成
az storage account create `
  --name stockspacestorage `
  --resource-group stockspace-rg `
  --location japaneast `
  --sku Standard_LRS

# コンテナ作成
az storage container create `
  --name images `
  --account-name stockspacestorage `
  --public-access blob
```

**注意**: ストレージアカウント名はグローバルで一意である必要があります。`stockspacestorage`が既に使用されている場合は、別の名前に変更してください（例: `stockspacestorage123`）。

### 6. Container Registry作成

```powershell
# ACR作成
az acr create `
  --resource-group stockspace-rg `
  --name stockspaceregistry `
  --sku Basic `
  --admin-enabled true

# ログイン
az acr login --name stockspaceregistry
```

### 7. Dockerイメージビルド＆プッシュ

**重要**: Azure StudentsアカウントではACR Tasks（クラウドビルド）が制限されているため、ローカルでビルドしてプッシュします。

```powershell
# ACRにログイン
az acr login --name stockspaceregistry

# ローカルでDockerイメージをビルド
docker build -t stockspaceregistry.azurecr.io/backend:latest .

# イメージをACRにプッシュ
docker push stockspaceregistry.azurecr.io/backend:latest
```

**注意**: Docker Desktopがインストールされ、起動している必要があります。
もしDockerがインストールされていない場合は、以下からインストールしてください：
https://www.docker.com/products/docker-desktop/

### 8. App Service作成

**重要**: まずApp Service用のリソースプロバイダーを登録する必要があります。

```powershell
# App Serviceリソースプロバイダーを登録
az provider register --namespace Microsoft.Web

# 登録状況を確認（完了するまで数分かかる場合があります）
az provider show --namespace Microsoft.Web --query "registrationState"

# 登録が完了したら（"Registered"と表示される）、App Serviceプラン作成
az appservice plan create `
  --name stockspace-plan `
  --resource-group stockspace-rg `
  --location japaneast `
  --sku FREE `
  --is-linux

# Web App作成
az webapp create `
  --resource-group stockspace-rg `
  --plan stockspace-plan `
  --name stockspace-api `
  --deployment-container-image-name stockspaceregistry.azurecr.io/backend:latest

# ACR認証設定
$acrPassword = (az acr credential show --name stockspaceregistry --query "passwords[0].value" -o tsv)
az webapp config container set `
  --name stockspace-api `
  --resource-group stockspace-rg `
  --docker-custom-image-name stockspaceregistry.azurecr.io/backend:latest `
  --docker-registry-server-url https://stockspaceregistry.azurecr.io `
  --docker-registry-server-user stockspaceregistry `
  --docker-registry-server-password $acrPassword
```

### 9. 環境変数設定

```powershell
# データベース接続文字列（上記で取得したものを使用）
az webapp config appsettings set `
  --resource-group stockspace-rg `
  --name stockspace-api `
  --settings `
    DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@stockspace-db.postgres.database.azure.com:5432/stockspace?sslmode=require" `
    ALLOWED_ORIGINS="*" `
    AUTO_CREATE_TABLES="false"
```

### 10. PostgreSQLファイアウォール設定

```powershell
# App ServiceのIPアドレスを取得
$appServiceIP = (az webapp show --resource-group stockspace-rg --name stockspace-api --query outboundIpAddresses -o tsv).Split(',')[0]

# ファイアウォールルール追加
az postgres flexible-server firewall-rule create `
  --resource-group stockspace-rg `
  --name stockspace-db `
  --rule-name AllowAppService `
  --start-ip-address $appServiceIP `
  --end-ip-address $appServiceIP
```

または、すべてのAzureサービスからのアクセスを許可：

```powershell
az postgres flexible-server firewall-rule create `
  --resource-group stockspace-rg `
  --name stockspace-db `
  --rule-name AllowAzureServices `
  --start-ip-address 0.0.0.0 `
  --end-ip-address 0.0.0.0
```

### 11. デプロイURL確認

```powershell
az webapp show --resource-group stockspace-rg --name stockspace-api --query defaultHostName -o tsv
```

出力例: `https://stockspace-api.azurewebsites.net`

### 12. データベースマイグレーション

```powershell
# ローカルから実行
$env:DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@stockspace-db.postgres.database.azure.com:5432/stockspace?sslmode=require"
python migrate_db.py
```

### 13. 動作確認

ブラウザで以下にアクセス：
- API: `https://stockspace-api.azurewebsites.net`
- API Docs: `https://stockspace-api.azurewebsites.net/docs`

### 14. モバイルアプリのAPI URL更新

`mobile/services/api.ts` を編集：

```typescript
const API_BASE_URL = __DEV__ 
  ? "http://localhost:8000"
  : "https://stockspace-api.azurewebsites.net";
```

---

## よくある問題

### データベース接続エラー

**解決策1**: ファイアウォールルール確認
```powershell
az postgres flexible-server firewall-rule list `
  --resource-group stockspace-rg `
  --name stockspace-db
```

**解決策2**: SSL接続を確認
接続文字列に `?sslmode=require` が含まれているか確認

### コンテナ起動エラー

**解決策**: ログを確認
```powershell
az webapp log tail --resource-group stockspace-rg --name stockspace-api
```

### メモリ不足

**解決策**: App Serviceプランをアップグレード
```powershell
az appservice plan update `
  --name stockspace-plan `
  --resource-group stockspace-rg `
  --sku B1
```

---

## コスト確認

```powershell
# リソースグループのコスト確認
az consumption usage list `
  --start-date 2024-01-01 `
  --end-date 2024-01-31
```

またはAzure Portalから:
https://portal.azure.com → コスト管理

---

## 次のステップ

詳細は `AZURE_DEPLOYMENT_GUIDE.md` を参照してください。

