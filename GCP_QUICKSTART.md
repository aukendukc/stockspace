# GCP クイックスタートガイド

## 5分で始めるGCPデプロイ

### 1. 前提条件チェック

- [ ] Google Cloudアカウント作成済み
- [ ] クレジットカード登録済み（無料トライアル$300分）
- [ ] Google Cloud CLIインストール済み

### 2. 初期設定（初回のみ）

```powershell
# Google Cloud CLIログイン
gcloud init

# プロジェクト作成
gcloud projects create stockspace-prod --name="StockSpace Production"

# プロジェクト選択
gcloud config set project stockspace-prod

# 請求先アカウント設定（GCPコンソールから）
# https://console.cloud.google.com/billing
```

### 3. API有効化

```powershell
# 必要なAPIを一括有効化
gcloud services enable run.googleapis.com
gcloud services enable sqladmin.googleapis.com
gcloud services enable storage-component.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable artifactregistry.googleapis.com
```

### 4. Cloud SQL作成

```powershell
# PostgreSQLインスタンス作成（パスワードは安全なものを設定）
gcloud sql instances create stockspace-db `
  --database-version=POSTGRES_15 `
  --tier=db-f1-micro `
  --region=asia-northeast1 `
  --root-password=YOUR_SECURE_PASSWORD

# データベース作成
gcloud sql databases create stockspace --instance=stockspace-db

# 接続名を確認（後で使用）
gcloud sql instances describe stockspace-db --format="value(connectionName)"
```

### 5. Cloud Storage作成

```powershell
# バケット作成
gsutil mb -p stockspace-prod -c STANDARD -l asia-northeast1 gs://stockspace-images
```

### 6. Dockerイメージビルド＆デプロイ

```powershell
# Artifact Registryリポジトリ作成
gcloud artifacts repositories create stockspace-repo `
  --repository-format=docker `
  --location=asia-northeast1

# イメージビルド＆プッシュ
gcloud builds submit --tag asia-northeast1-docker.pkg.dev/stockspace-prod/stockspace-repo/backend:latest

# Cloud Runにデプロイ
# 注意: YOUR_PASSWORD と CONNECTION_NAME を実際の値に置き換える
gcloud run deploy stockspace-api `
  --image asia-northeast1-docker.pkg.dev/stockspace-prod/stockspace-repo/backend:latest `
  --platform managed `
  --region asia-northeast1 `
  --allow-unauthenticated `
  --set-env-vars "DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@/stockspace?host=/cloudsql/CONNECTION_NAME" `
  --add-cloudsql-instances stockspace-prod:asia-northeast1:stockspace-db `
  --memory 512Mi `
  --cpu 1 `
  --min-instances 0 `
  --max-instances 10
```

### 7. デプロイURL確認

```powershell
# URL取得
gcloud run services describe stockspace-api --region asia-northeast1 --format="value(status.url)"
```

出力例: `https://stockspace-api-xxxxx-an.a.run.app`

### 8. データベースマイグレーション

```powershell
# Cloud Run Jobでマイグレーション実行
gcloud run jobs create migrate-db `
  --image asia-northeast1-docker.pkg.dev/stockspace-prod/stockspace-repo/backend:latest `
  --region asia-northeast1 `
  --set-env-vars "DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@/stockspace?host=/cloudsql/CONNECTION_NAME" `
  --add-cloudsql-instances stockspace-prod:asia-northeast1:stockspace-db `
  --command python `
  --args migrate_db.py

# 実行
gcloud run jobs execute migrate-db --region asia-northeast1
```

### 9. モバイルアプリのAPI URL更新

`mobile/services/api.ts` を編集：

```typescript
const API_BASE_URL = __DEV__ 
  ? "http://localhost:8000"
  : "https://stockspace-api-xxxxx-an.a.run.app";  // 上記で取得したURL
```

### 10. 動作確認

ブラウザで以下にアクセス：
- API: `https://stockspace-api-xxxxx-an.a.run.app`
- API Docs: `https://stockspace-api-xxxxx-an.a.run.app/docs`

---

## よくある問題

### Cloud SQL接続エラー

**解決策**: 接続文字列を確認
```powershell
# 正しい接続文字列形式
postgresql://postgres:PASSWORD@/DATABASE_NAME?host=/cloudsql/PROJECT_ID:REGION:INSTANCE_NAME
```

### メモリ不足エラー

**解決策**: Cloud Runのメモリを増やす
```powershell
gcloud run services update stockspace-api `
  --region asia-northeast1 `
  --memory 1Gi
```

### ビルドエラー

**解決策**: ログを確認
```powershell
gcloud builds list --limit=1
gcloud builds log BUILD_ID
```

---

## 次のステップ

詳細は `GCP_DEPLOYMENT_GUIDE.md` を参照してください。



