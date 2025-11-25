# Azure App Service トラブルシューティング

## Application Error の解決方法

### ステップ1: ログを確認

```powershell
# リアルタイムログを表示
az webapp log tail --resource-group stockspace-rg --name stockspace-api

# または、ログファイルをダウンロード
az webapp log download `
  --resource-group stockspace-rg `
  --name stockspace-api `
  --log-file app-logs.zip
```

### ステップ2: よくある原因と解決方法

#### 1. 環境変数が設定されていない

```powershell
# 現在の環境変数を確認
az webapp config appsettings list `
  --resource-group stockspace-rg `
  --name stockspace-api `
  --output table

# DATABASE_URLが設定されているか確認
az webapp config appsettings show `
  --resource-group stockspace-rg `
  --name stockspace-api `
  --query "[?name=='DATABASE_URL'].value" `
  --output tsv
```

**解決方法**: 環境変数を正しく設定する

```powershell
# PostgreSQLのホスト名を取得
$dbHost = (az postgres flexible-server show `
  --resource-group stockspace-rg `
  --name stockspace-db `
  --query fullyQualifiedDomainName `
  --output tsv)

# 環境変数を設定（YOUR_PASSWORDを実際のパスワードに置き換える）
az webapp config appsettings set `
  --resource-group stockspace-rg `
  --name stockspace-api `
  --settings `
    DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@$dbHost:5432/stockspace?sslmode=require" `
    ALLOWED_ORIGINS="*" `
    AUTO_CREATE_TABLES="false" `
    SECRET_KEY="your-secret-key-change-this" `
    ALGORITHM="HS256" `
    ACCESS_TOKEN_EXPIRE_MINUTES="30"
```

#### 2. データベース接続エラー

**確認事項**:
- PostgreSQLファイアウォールが正しく設定されているか
- 接続文字列のパスワードが正しいか
- SSL接続が有効か（`?sslmode=require`）

```powershell
# ファイアウォールルールを確認
az postgres flexible-server firewall-rule list `
  --resource-group stockspace-rg `
  --name stockspace-db `
  --output table

# すべてのAzureサービスからのアクセスを許可（まだ設定していない場合）
az postgres flexible-server firewall-rule create `
  --resource-group stockspace-rg `
  --name stockspace-db `
  --rule-name AllowAzureServices `
  --start-ip-address 0.0.0.0 `
  --end-ip-address 0.0.0.0
```

#### 3. コンテナイメージの問題

```powershell
# コンテナ設定を確認
az webapp config container show `
  --resource-group stockspace-rg `
  --name stockspace-api

# コンテナログを確認
az webapp log show `
  --resource-group stockspace-rg `
  --name stockspace-api `
  --log-file container-logs.txt
```

**解決方法**: コンテナイメージを再ビルド＆プッシュ

```powershell
# ACRにログイン
az acr login --name stockspaceregistry

# イメージを再ビルド
docker build -t stockspaceregistry.azurecr.io/backend:latest .

# イメージをプッシュ
docker push stockspaceregistry.azurecr.io/backend:latest

# App Serviceを再起動
az webapp restart `
  --resource-group stockspace-rg `
  --name stockspace-api
```

#### 4. ポート設定の問題

App Serviceは環境変数 `PORT` を自動設定しますが、アプリケーションが8080ポートでリッスンしていることを確認：

```powershell
# 環境変数にPORTを追加（App Serviceが自動設定するが、明示的に設定）
az webapp config appsettings set `
  --resource-group stockspace-rg `
  --name stockspace-api `
  --settings PORT=8080
```

#### 5. 起動コマンドの問題

Dockerfileの起動コマンドを確認：

```dockerfile
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
```

App Service用に環境変数からポートを取得するように変更する場合：

```dockerfile
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}
```

### ステップ3: App Serviceの詳細診断

```powershell
# App Serviceの状態を確認
az webapp show `
  --resource-group stockspace-rg `
  --name stockspace-api `
  --query "{state:state, defaultHostName:defaultHostName, httpsOnly:httpsOnly}"

# 診断ログを有効化
az webapp log config `
  --resource-group stockspace-rg `
  --name stockspace-api `
  --application-logging filesystem `
  --detailed-error-messages true `
  --failed-request-tracing true `
  --web-server-logging filesystem
```

### ステップ4: 簡単なテスト

```powershell
# ヘルスチェックエンドポイントにアクセス
curl https://stockspace-api.azurewebsites.net/

# またはPowerShellで
Invoke-WebRequest -Uri "https://stockspace-api.azurewebsites.net/" -UseBasicParsing
```

### ステップ5: Azure Portalで確認

1. https://portal.azure.com にアクセス
2. App Service → `stockspace-api` を選択
3. 「診断と問題の解決」をクリック
4. 「Application Logs」を確認
5. 「Log stream」でリアルタイムログを確認

### よくあるエラーメッセージ

#### "ModuleNotFoundError"
- `requirements.txt`に必要なパッケージが含まれているか確認
- Dockerイメージを再ビルド

#### "Connection refused" または "Database connection error"
- データベース接続文字列を確認
- ファイアウォールルールを確認

#### "Port already in use"
- ポート設定を確認（App Serviceは自動でPORT環境変数を設定）

#### "Container failed to start"
- DockerfileのCMDを確認
- ログを確認して具体的なエラーを特定

### デバッグのヒント

1. **ローカルでテスト**: まずローカルでDockerイメージをテスト
   ```powershell
   docker run -p 8080:8080 -e DATABASE_URL="your-connection-string" stockspaceregistry.azurecr.io/backend:latest
   ```

2. **環境変数を確認**: すべての環境変数が正しく設定されているか確認

3. **ログを詳しく見る**: エラーメッセージの最初の数行が重要

4. **段階的に確認**: 
   - まずコンテナが起動するか
   - 次にデータベースに接続できるか
   - 最後にAPIが応答するか








