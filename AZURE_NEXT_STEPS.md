# Azure デプロイ - 次のステップ

## 現在の進捗確認

以下が完了していることを確認してください：
- [x] リソースグループ作成
- [x] PostgreSQL作成（リソースプロバイダー登録済み）
- [x] ストレージ作成（リソースプロバイダー登録済み）
- [x] Container Registry作成
- [x] Dockerイメージビルド＆プッシュ

---

## ステップ8: App Service作成

### 8.1 App Serviceプラン作成

```powershell
# 無料プランで作成
az appservice plan create `
  --name stockspace-plan `
  --resource-group stockspace-rg `
  --location japaneast `
  --sku FREE `
  --is-linux
```

**注意**: 無料プラン（FREE）は制限があります。本番環境では有料プラン（B1など）を推奨します。

### 8.2 Web App作成

```powershell
az webapp create `
  --resource-group stockspace-rg `
  --plan stockspace-plan `
  --name stockspace-api `
  --deployment-container-image-name stockspaceregistry.azurecr.io/backend:latest
```

**注意**: `stockspace-api` という名前が既に使用されている場合は、別の名前に変更してください（例: `stockspace-api-2024`）。

### 8.3 ACR認証設定

```powershell
# ACRのパスワードを取得
$acrPassword = (az acr credential show --name stockspaceregistry --query "passwords[0].value" -o tsv)

# コンテナ設定
az webapp config container set `
  --name stockspace-api `
  --resource-group stockspace-rg `
  --docker-custom-image-name stockspaceregistry.azurecr.io/backend:latest `
  --docker-registry-server-url https://stockspaceregistry.azurecr.io `
  --docker-registry-server-user stockspaceregistry `
  --docker-registry-server-password $acrPassword
```

---

## ステップ9: 環境変数設定

### 9.1 データベース接続文字列を取得

まず、PostgreSQLの接続文字列を取得します：

```powershell
# PostgreSQLサーバーのホスト名を確認
az postgres flexible-server show `
  --resource-group stockspace-rg `
  --name stockspace-db `
  --query fullyQualifiedDomainName `
  --output tsv
```

出力例: `stockspace-db.postgres.database.azure.com`

### 9.2 環境変数を設定

```powershell
# データベース接続文字列を設定
# YOUR_PASSWORD を実際のPostgreSQLパスワードに置き換える
az webapp config appsettings set `
  --resource-group stockspace-rg `
  --name stockspace-api `
  --settings `
    DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@stockspace-db.postgres.database.azure.com:5432/stockspace?sslmode=require" `
    ALLOWED_ORIGINS="*" `
    AUTO_CREATE_TABLES="false" `
    SECRET_KEY="your-secret-key-here-change-this" `
    ALGORITHM="HS256" `
    ACCESS_TOKEN_EXPIRE_MINUTES="30"
```

**重要**: 
- `YOUR_PASSWORD` を実際のPostgreSQLパスワードに置き換えてください
- `SECRET_KEY` はランダムな文字列に変更してください（JWTトークン用）

---

## ステップ10: PostgreSQLファイアウォール設定

App ServiceからPostgreSQLにアクセスできるようにファイアウォールを設定します。

### 方法1: すべてのAzureサービスからのアクセスを許可（簡単）

```powershell
az postgres flexible-server firewall-rule create `
  --resource-group stockspace-rg `
  --name stockspace-db `
  --rule-name AllowAzureServices `
  --start-ip-address 0.0.0.0 `
  --end-ip-address 0.0.0.0
```

### 方法2: App ServiceのIPアドレスのみ許可（セキュア）

```powershell
# App Serviceの送信IPアドレスを取得
$appServiceIPs = (az webapp show --resource-group stockspace-rg --name stockspace-api --query outboundIpAddresses -o tsv).Split(',')

# 各IPアドレスに対してファイアウォールルールを作成
foreach ($ip in $appServiceIPs) {
    az postgres flexible-server firewall-rule create `
      --resource-group stockspace-rg `
      --name stockspace-db `
      --rule-name "AllowAppService-$($ip.Replace('.', '-'))" `
      --start-ip-address $ip `
      --end-ip-address $ip
}
```

---

## ステップ11: デプロイURL確認

```powershell
az webapp show --resource-group stockspace-rg --name stockspace-api --query defaultHostName -o tsv
```

出力例: `https://stockspace-api.azurewebsites.net`

このURLでAPIにアクセスできるか確認してください：
- API: `https://stockspace-api.azurewebsites.net`
- API Docs: `https://stockspace-api.azurewebsites.net/docs`

---

## ステップ12: データベースマイグレーション

### 12.1 ローカルからマイグレーション実行

```powershell
# 環境変数設定
$env:DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@stockspace-db.postgres.database.azure.com:5432/stockspace?sslmode=require"

# マイグレーション実行
python migrate_db.py
```

**注意**: ローカルからPostgreSQLに接続するには、ファイアウォールで自分のIPアドレスを許可する必要があります。

### 12.2 自分のIPアドレスを許可

```powershell
# 自分のIPアドレスを取得（外部サービスを使用）
$myIP = (Invoke-WebRequest -Uri "https://api.ipify.org").Content

# ファイアウォールルール追加
az postgres flexible-server firewall-rule create `
  --resource-group stockspace-rg `
  --name stockspace-db `
  --rule-name AllowMyIP `
  --start-ip-address $myIP `
  --end-ip-address $myIP
```

---

## ステップ13: モバイルアプリのAPI URL更新

`mobile/services/api.ts` を編集：

```typescript
const API_BASE_URL = __DEV__ 
  ? "http://localhost:8000"
  : "https://stockspace-api.azurewebsites.net";  // 上記で取得したURL
```

---

## 動作確認

1. **API動作確認**
   - ブラウザで `https://stockspace-api.azurewebsites.net/docs` にアクセス
   - Swagger UIが表示されれば成功

2. **データベース接続確認**
   - API Docsから `/auth/register` エンドポイントをテスト
   - ユーザー登録が成功すれば、データベース接続も成功

3. **ログ確認**
   ```powershell
   az webapp log tail --resource-group stockspace-rg --name stockspace-api
   ```

---

## トラブルシューティング

### App Serviceが起動しない

```powershell
# ログを確認
az webapp log tail --resource-group stockspace-rg --name stockspace-api

# コンテナログを確認
az webapp log show --resource-group stockspace-rg --name stockspace-api
```

### データベース接続エラー

1. ファイアウォールルールを確認
2. 接続文字列を確認（パスワードが正しいか）
3. SSL接続が有効か確認（`?sslmode=require`）

### コンテナイメージが見つからない

1. ACRにイメージがプッシュされているか確認
2. ACR認証設定を確認
3. イメージ名が正しいか確認

---

## 次のステップ

デプロイが完了したら：
1. ✅ API動作確認
2. ✅ モバイルアプリのAPI URL更新
3. ✅ テスト実行
4. ✅ 本番環境での動作確認



