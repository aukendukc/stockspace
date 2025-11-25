# Azure App Service デプロイ修正ガイド

## 修正済みの内容

1. **Dockerfile**: Azure App Serviceの`PORT`環境変数に対応
2. **backend/auth.py**: `SECRET_KEY`、`ALGORITHM`、`ACCESS_TOKEN_EXPIRE_MINUTES`を環境変数から取得するように修正

## 現在の問題

1. **コンテナ設定**: `DOCKER_CUSTOM_IMAGE_NAME`が`sitecontainers`になっている（正しくは`DOCKER|stockspaceregistry.azurecr.io/backend:latest`）
2. **Dockerデーモン**: Docker Desktopが起動していない

## 解決手順

### ステップ1: Docker Desktopを起動

1. Docker Desktopを起動
2. 起動が完了するまで待つ（システムトレイにDockerアイコンが表示される）

### ステップ2: Dockerイメージをビルド＆プッシュ

```powershell
# ACRにログイン
az acr login --name stockspaceregistry

# イメージをビルド
docker build -t stockspaceregistry.azurecr.io/backend:latest .

# イメージをプッシュ
docker push stockspaceregistry.azurecr.io/backend:latest
```

### ステップ3: コンテナ設定を修正（Azure Portalから）

1. https://portal.azure.com にアクセス
2. リソースグループ `stockspace-rg` → App Service `stockspace-api-01` を選択
3. 左メニューから「設定」→「全般設定」→「コンテナの設定」をクリック
4. 以下の設定を確認・修正：
   - **イメージとタグ**: `DOCKER|stockspaceregistry.azurecr.io/backend:latest`
   - **レジストリ サーバー URL**: `https://stockspaceregistry.azurecr.io`
   - **ユーザー名**: `stockspaceregistry`
   - **パスワード**: （ACRのパスワードを取得して設定）
     ```powershell
     az acr credential show --name stockspaceregistry --query "passwords[0].value" -o tsv
     ```
5. 「保存」をクリック

### ステップ4: App Serviceを再起動

```powershell
az webapp restart --resource-group stockspace-rg --name stockspace-api-01
```

### ステップ5: 動作確認

2-3分待ってから、以下にアクセス：
- https://stockspace-api-01.azurewebsites.net/
- https://stockspace-api-01.azurewebsites.net/docs

## トラブルシューティング

### ログを確認

```powershell
az webapp log tail --resource-group stockspace-rg --name stockspace-api-01
```

### 環境変数を確認

```powershell
az webapp config appsettings list --resource-group stockspace-rg --name stockspace-api-01
```

### コンテナ設定を確認

```powershell
az webapp config container show --resource-group stockspace-rg --name stockspace-api-01
```

## 注意事項

- Docker Desktopが起動していないと、Dockerコマンドは実行できません
- コンテナ設定の変更後は、App Serviceの再起動が必要です
- デプロイには数分かかる場合があります

