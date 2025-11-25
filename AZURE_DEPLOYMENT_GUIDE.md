# StockSpace Azureデプロイガイド（Students向け）

## Azure Studentsの特典

- ✅ **$100の無料クレジット**（12ヶ月間）
- ✅ **無料サービス多数**（App Service、PostgreSQL、Storageなど）
- ✅ **学生向けの追加特典**

---

## Azureで使用するサービス

### 1. Azure App Service（FastAPIバックエンド）
- ✅ サーバーレス、自動スケーリング
- ✅ 無料プランあり（F1: 無料）
- 💰 無料プラン後: $13/月〜（B1 Basic）

### 2. Azure Database for PostgreSQL
- ✅ フルマネージドPostgreSQL
- ✅ 無料プランあり（Basic Tier）
- 💰 無料プラン後: $25/月〜

### 3. Azure Blob Storage（画像ストレージ）
- ✅ 画像・ファイル保存
- ✅ CDN配信可能
- 💰 無料枠あり（5GB、1ヶ月）

### 4. Azure Container Registry（Dockerイメージ）
- ✅ Dockerイメージ保存
- ✅ 無料プランあり（Basic: 10GB）
- 💰 無料プラン後: $5/月〜

---

## セットアップ手順

### 前提条件

1. Azure Studentsアカウント確認
   - https://azure.microsoft.com/ja-jp/free/students/
   - $100クレジットが有効か確認

2. Azure CLIインストール
   ```powershell
   # Windows (PowerShell)
   # Chocolatey使用
   choco install azure-cli
   
   # または直接ダウンロード
   # https://aka.ms/installazurecliwindows
   ```

3. 初期設定
   ```powershell
   # ログイン
   az login
   
   # サブスクリプション確認
   az account list --output table
   
   # サブスクリプション選択（Studentsアカウント）
   az account set --subscription "Your Subscription Name"
   ```

---

## ステップ1: リソースグループ作成

```powershell
# リソースグループ作成
az group create --name stockspace-rg --location japaneast

# 確認
az group show --name stockspace-rg
```

---

## ステップ2: Azure Database for PostgreSQL作成

### 2.1 PostgreSQLサーバー作成

```powershell
# PostgreSQLサーバー作成（Basic Tier、無料プラン）
az postgres flexible-server create `
  --resource-group stockspace-rg `
  --name stockspace-db `
  --location japaneast `
  --admin-user postgres `
  --admin-password YOUR_SECURE_PASSWORD `
  --sku-name Standard_B1ms `
  --tier Burstable `
  --version 15 `
  --storage-size 32 `
  --public-access 0.0.0.0

# データベース作成
az postgres flexible-server db create `
  --resource-group stockspace-rg `
  --server-name stockspace-db `
  --database-name stockspace

# ファイアウォールルール追加（App Serviceからアクセス許可）
# 後でApp ServiceのIPアドレスを追加
```

**注意**: パスワードは安全なものを設定してください（大文字、小文字、数字、記号を含む12文字以上）

### 2.2 接続文字列取得

```powershell
# 接続文字列を取得
az postgres flexible-server show-connection-string `
  --server-name stockspace-db `
  --database-name stockspace `
  --admin-user postgres `
  --admin-password YOUR_SECURE_PASSWORD
```

出力例:
```
postgresql://postgres:YOUR_PASSWORD@stockspace-db.postgres.database.azure.com:5432/stockspace?sslmode=require
```

---

## ステップ3: Azure Blob Storage作成

```powershell
# ストレージアカウント作成
az storage account create `
  --name stockspacestorage `
  --resource-group stockspace-rg `
  --location japaneast `
  --sku Standard_LRS `
  --kind StorageV2

# コンテナ作成（画像用）
az storage container create `
  --name images `
  --account-name stockspacestorage `
  --public-access blob

# 接続文字列取得
az storage account show-connection-string `
  --name stockspacestorage `
  --resource-group stockspace-rg
```

---

## ステップ4: Azure Container Registry作成

```powershell
# Container Registry作成
az acr create `
  --resource-group stockspace-rg `
  --name stockspaceregistry `
  --sku Basic `
  --admin-enabled true

# ログイン
az acr login --name stockspaceregistry

# 管理者パスワード取得
az acr credential show --name stockspaceregistry
```

---

## ステップ5: Dockerイメージビルド＆プッシュ

### 5.1 ローカルでビルド

```powershell
# イメージビルド
docker build -t stockspaceregistry.azurecr.io/backend:latest .

# ACRにログイン
az acr login --name stockspaceregistry

# イメージプッシュ
docker push stockspaceregistry.azurecr.io/backend:latest
```

### 5.2 またはAzure Cloud Build使用

```powershell
# ACRでビルド（クラウドでビルド）
az acr build `
  --registry stockspaceregistry `
  --image backend:latest .
```

---

## ステップ6: Azure App Service作成

### 6.1 App Serviceプラン作成

```powershell
# App Serviceプラン作成（無料プラン）
az appservice plan create `
  --name stockspace-plan `
  --resource-group stockspace-rg `
  --location japaneast `
  --sku FREE `
  --is-linux

# または有料プラン（推奨）
az appservice plan create `
  --name stockspace-plan `
  --resource-group stockspace-rg `
  --location japaneast `
  --sku B1 `
  --is-linux
```

### 6.2 Web App作成

```powershell
# Web App作成
az webapp create `
  --resource-group stockspace-rg `
  --plan stockspace-plan `
  --name stockspace-api `
  --deployment-container-image-name stockspaceregistry.azurecr.io/backend:latest

# コンテナレジストリ認証設定
az webapp config container set `
  --name stockspace-api `
  --resource-group stockspace-rg `
  --docker-custom-image-name stockspaceregistry.azurecr.io/backend:latest `
  --docker-registry-server-url https://stockspaceregistry.azurecr.io `
  --docker-registry-server-user stockspaceregistry `
  --docker-registry-server-password YOUR_ACR_PASSWORD
```

### 6.3 環境変数設定

```powershell
# データベース接続文字列設定
az webapp config appsettings set `
  --resource-group stockspace-rg `
  --name stockspace-api `
  --settings DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@stockspace-db.postgres.database.azure.com:5432/stockspace?sslmode=require"

# その他の環境変数
az webapp config appsettings set `
  --resource-group stockspace-rg `
  --name stockspace-api `
  --settings `
    ALLOWED_ORIGINS="https://your-frontend.vercel.app,exp://your-expo-app" `
    AUTO_CREATE_TABLES="false" `
    SECRET_KEY="your-secret-key-here" `
    ALGORITHM="HS256" `
    ACCESS_TOKEN_EXPIRE_MINUTES="30"
```

### 6.4 PostgreSQLファイアウォール設定

```powershell
# App Serviceの送信IPアドレスを取得
az webapp show `
  --resource-group stockspace-rg `
  --name stockspace-api `
  --query outboundIpAddresses `
  --output tsv

# 出力されたIPアドレスをPostgreSQLのファイアウォールに追加
# Azure Portalから設定するか、以下で設定
az postgres flexible-server firewall-rule create `
  --resource-group stockspace-rg `
  --name stockspace-db `
  --rule-name AllowAppService `
  --start-ip-address YOUR_APP_SERVICE_IP `
  --end-ip-address YOUR_APP_SERVICE_IP
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

---

## ステップ7: データベースマイグレーション

### 7.1 ローカルからマイグレーション

```powershell
# 環境変数設定
$env:DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@stockspace-db.postgres.database.azure.com:5432/stockspace?sslmode=require"

# マイグレーション実行
python migrate_db.py
```

### 7.2 またはApp Serviceから実行

```powershell
# App ServiceのSSH接続で実行
az webapp ssh `
  --resource-group stockspace-rg `
  --name stockspace-api

# SSH接続後
python migrate_db.py
```

---

## ステップ8: デプロイURL確認

```powershell
# URL取得
az webapp show `
  --resource-group stockspace-rg `
  --name stockspace-api `
  --query defaultHostName `
  --output tsv
```

出力例: `https://stockspace-api.azurewebsites.net`

---

## ステップ9: CORS設定更新

Azure Portalから設定するか、以下で設定：

```powershell
# CORS設定（Azure Portal推奨）
# https://portal.azure.com → App Service → CORS
```

または環境変数で設定（既に設定済み）:
```
ALLOWED_ORIGINS=https://your-frontend.vercel.app,exp://your-expo-app
```

---

## ステップ10: モバイルアプリのAPI URL更新

`mobile/services/api.ts` を更新：

```typescript
const API_BASE_URL = __DEV__ 
  ? "http://localhost:8000"
  : "https://stockspace-api.azurewebsites.net";  // App ServiceのURL
```

---

## コスト見積もり（Azure Students）

### 無料プラン構成

- **App Service (F1)**: 無料
- **PostgreSQL (Basic)**: 無料（制限あり）
- **Blob Storage**: 無料（5GBまで）
- **Container Registry (Basic)**: 無料（10GBまで）

**合計: $0/月**（無料枠内）

### 推奨構成（$100クレジット内）

- **App Service (B1)**: $13/月
- **PostgreSQL (Basic)**: $25/月
- **Blob Storage**: $1-5/月
- **Container Registry**: $5/月

**合計: 約$45/月**（$100クレジットで約2ヶ月分）

---

## トラブルシューティング

### データベース接続エラー

```powershell
# ファイアウォールルール確認
az postgres flexible-server firewall-rule list `
  --resource-group stockspace-rg `
  --name stockspace-db

# 接続テスト
az postgres flexible-server connect `
  --name stockspace-db `
  --admin-user postgres `
  --admin-password YOUR_PASSWORD `
  --database-name stockspace
```

### ログ確認

```powershell
# App Serviceログ確認
az webapp log tail `
  --resource-group stockspace-rg `
  --name stockspace-api

# またはAzure Portalから
# https://portal.azure.com → App Service → ログストリーム
```

### デプロイエラー

```powershell
# デプロイログ確認
az webapp log deployment show `
  --resource-group stockspace-rg `
  --name stockspace-api
```

---

## セキュリティベストプラクティス

1. **Key Vault**: シークレット管理（オプション）
2. **Managed Identity**: 認証情報の自動管理
3. **HTTPS**: 自動で有効
4. **ファイアウォール**: PostgreSQLのアクセス制限
5. **環境変数**: 機密情報は環境変数で管理

---

## 次のステップ

1. ✅ リソースグループ作成
2. ✅ PostgreSQL作成
3. ✅ App Service作成
4. ✅ デプロイ
5. ✅ データベースマイグレーション
6. ✅ テスト

---

## 参考リンク

- Azure Students: https://azure.microsoft.com/ja-jp/free/students/
- Azure Portal: https://portal.azure.com
- Azure CLI ドキュメント: https://docs.microsoft.com/ja-jp/cli/azure/








