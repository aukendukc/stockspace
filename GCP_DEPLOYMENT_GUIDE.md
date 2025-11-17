# StockSpace GCPデプロイガイド

## GCPで使用するサービス

### 1. Cloud Run（FastAPIバックエンド）
- ✅ サーバーレス、自動スケーリング
- ✅ 従量課金（使った分だけ）
- ✅ 無料枠あり（月200万リクエストまで）
- 💰 無料枠後: $0.40/100万リクエスト

### 2. Cloud SQL（PostgreSQL）
- ✅ フルマネージドPostgreSQL
- ✅ 自動バックアップ
- 💰 無料枠なし、$7.67/月〜（db-f1-micro）

### 3. Cloud Storage（画像ストレージ）
- ✅ 画像・ファイル保存
- ✅ CDN配信可能
- 💰 無料枠あり（5GB、1ヶ月）

### 4. Cloud Build（CI/CD）
- ✅ GitHub連携で自動デプロイ
- 💰 無料枠あり（1日120分）

### 5. Vercel/Netlify（Next.jsフロントエンド）
- ✅ GCPでも可能だが、Vercelの方が簡単
- または Cloud Run でNext.jsもデプロイ可能

---

## セットアップ手順

### 前提条件

1. Google Cloudアカウント作成
   - https://cloud.google.com
   - クレジットカード登録必要（無料トライアル$300分）

2. Google Cloud CLIインストール
   ```bash
   # Windows (PowerShell)
   (New-Object Net.WebClient).DownloadFile("https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe", "$env:Temp\GoogleCloudSDKInstaller.exe")
   & $env:Temp\GoogleCloudSDKInstaller.exe
   
   # または Chocolatey
   choco install gcloudsdk
   ```

3. 初期設定
   ```bash
   gcloud init
   gcloud auth login
   ```

---

## ステップ1: プロジェクト作成

```bash
# プロジェクト作成
gcloud projects create stockspace-prod --name="StockSpace Production"

# プロジェクト選択
gcloud config set project stockspace-prod

# 請求先アカウント設定（必須）
# GCPコンソールから設定: https://console.cloud.google.com/billing
```

---

## ステップ2: 必要なAPI有効化

```bash
# Cloud Run API
gcloud services enable run.googleapis.com

# Cloud SQL API
gcloud services enable sqladmin.googleapis.com

# Cloud Storage API
gcloud services enable storage-component.googleapis.com

# Cloud Build API
gcloud services enable cloudbuild.googleapis.com

# Container Registry API
gcloud services enable containerregistry.googleapis.com

# Artifact Registry API（推奨）
gcloud services enable artifactregistry.googleapis.com
```

---

## ステップ3: Cloud SQL（PostgreSQL）セットアップ

### 3.1 インスタンス作成

```bash
# PostgreSQLインスタンス作成（最小構成）
gcloud sql instances create stockspace-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=asia-northeast1 \
  --root-password=YOUR_SECURE_PASSWORD

# データベース作成
gcloud sql databases create stockspace \
  --instance=stockspace-db

# 接続情報確認
gcloud sql instances describe stockspace-db
```

### 3.2 接続文字列取得

```bash
# 接続文字列を取得
gcloud sql instances describe stockspace-db --format="value(connectionName)"
# 出力例: stockspace-prod:asia-northeast1:stockspace-db
```

接続文字列は後で使用します。

---

## ステップ4: Cloud Storage（画像ストレージ）セットアップ

```bash
# バケット作成
gsutil mb -p stockspace-prod -c STANDARD -l asia-northeast1 gs://stockspace-images

# 公開アクセス設定（画像を公開する場合）
gsutil iam ch allUsers:objectViewer gs://stockspace-images

# または認証付きアクセス（推奨）
# バケットは非公開のまま、署名付きURLでアクセス
```

---

## ステップ5: バックエンド（FastAPI）デプロイ

### 5.1 Dockerfile作成

プロジェクトルートに `Dockerfile` を作成：

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# 依存関係インストール
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# アプリケーションコードコピー
COPY . .

# ポート公開
EXPOSE 8080

# 起動コマンド
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
```

### 5.2 .dockerignore作成

```
venv/
__pycache__/
*.pyc
*.db
.env
.git/
node_modules/
```

### 5.3 データベース接続設定変更

`backend/database.py` を修正：

```python
import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# 環境変数から取得
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    # 開発環境（SQLite）
    SQLALCHEMY_DATABASE_URL = "sqlite:///./stockspace.db"
else:
    # 本番環境（PostgreSQL）
    # Cloud SQL接続文字列をそのまま使用
    SQLALCHEMY_DATABASE_URL = DATABASE_URL

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in SQLALCHEMY_DATABASE_URL else {}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
```

### 5.4 Cloud Runにデプロイ

```bash
# Artifact Registryリポジトリ作成
gcloud artifacts repositories create stockspace-repo \
  --repository-format=docker \
  --location=asia-northeast1

# イメージビルド
gcloud builds submit --tag asia-northeast1-docker.pkg.dev/stockspace-prod/stockspace-repo/backend:latest

# Cloud Runにデプロイ
gcloud run deploy stockspace-api \
  --image asia-northeast1-docker.pkg.dev/stockspace-prod/stockspace-repo/backend:latest \
  --platform managed \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --set-env-vars DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@/stockspace?host=/cloudsql/stockspace-prod:asia-northeast1:stockspace-db" \
  --add-cloudsql-instances stockspace-prod:asia-northeast1:stockspace-db \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10
```

**注意**: Cloud SQL接続にはCloud SQL Proxyが必要です。上記の `--add-cloudsql-instances` で自動設定されます。

### 5.5 環境変数設定（GCPコンソールから）

1. Cloud Runコンソール: https://console.cloud.google.com/run
2. `stockspace-api` を選択
3. 「編集と新しいリビジョンをデプロイ」をクリック
4. 「変数とシークレット」タブで以下を設定：

```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@/stockspace?host=/cloudsql/stockspace-prod:asia-northeast1:stockspace-db
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

### 5.6 デプロイURL確認

```bash
# URL取得
gcloud run services describe stockspace-api --region asia-northeast1 --format="value(status.url)"
# 出力例: https://stockspace-api-xxxxx-an.a.run.app
```

---

## ステップ6: データベースマイグレーション

### 6.1 ローカルからマイグレーション

```bash
# Cloud SQL Proxyインストール（Windows）
# https://cloud.google.com/sql/docs/postgres/sql-proxy からダウンロード

# Cloud SQL Proxy起動（別ターミナル）
cloud_sql_proxy.exe -instances=stockspace-prod:asia-northeast1:stockspace-db=tcp:5432

# 環境変数設定
$env:DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/stockspace"

# マイグレーション実行（Pythonスクリプト作成が必要）
python migrate_db.py
```

または、Cloud Runのコンテナ内で実行：

```bash
# Cloud Run Job作成（一時的なタスク実行用）
gcloud run jobs create migrate-db \
  --image asia-northeast1-docker.pkg.dev/stockspace-prod/stockspace-repo/backend:latest \
  --region asia-northeast1 \
  --set-env-vars DATABASE_URL="..." \
  --add-cloudsql-instances stockspace-prod:asia-northeast1:stockspace-db \
  --command python \
  --args migrate_db.py

# 実行
gcloud run jobs execute migrate-db --region asia-northeast1
```

### 6.2 マイグレーションスクリプト作成

`migrate_db.py` を作成：

```python
from backend.database import engine, Base
from backend import models

if __name__ == "__main__":
    # テーブル作成
    Base.metadata.create_all(bind=engine)
    print("Database tables created successfully!")
```

---

## ステップ7: CORS設定更新

`main.py` のCORS設定を本番環境用に更新：

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

app = FastAPI(title="StockSpace API", version="1.0.0")

# CORS設定（本番環境）
allowed_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:8081"  # 開発環境用
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

環境変数に追加：
```
ALLOWED_ORIGINS=https://your-frontend.vercel.app,exp://your-expo-app
```

---

## ステップ8: モバイルアプリのAPI URL更新

`mobile/services/api.ts` を更新：

```typescript
const API_BASE_URL = __DEV__ 
  ? "http://localhost:8000"
  : "https://stockspace-api-xxxxx-an.a.run.app";  // Cloud RunのURL
```

---

## ステップ9: 画像アップロード機能実装（オプション）

### 9.1 Cloud Storage用の設定

`requirements.txt` に追加：
```
google-cloud-storage==2.10.0
```

### 9.2 画像アップロードエンドポイント追加

`backend/routers/posts.py` に追加：

```python
from google.cloud import storage
import os
from fastapi import UploadFile, File

# Cloud Storageクライアント初期化
storage_client = storage.Client()
bucket_name = os.getenv("GCS_BUCKET_NAME", "stockspace-images")
bucket = storage_client.bucket(bucket_name)

@router.post("/upload-image")
async def upload_image(
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user)
):
    # ファイルアップロード
    blob = bucket.blob(f"images/{current_user.id}/{file.filename}")
    blob.upload_from_file(file.file, content_type=file.content_type)
    blob.make_public()
    
    return {"url": blob.public_url}
```

環境変数に追加：
```
GCS_BUCKET_NAME=stockspace-images
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

---

## ステップ10: 自動デプロイ設定（GitHub Actions）

`.github/workflows/deploy.yml` を作成：

```yaml
name: Deploy to Cloud Run

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - id: 'auth'
        uses: 'google-github-actions/auth@v1'
        with:
          credentials_json: '${{ secrets.GCP_SA_KEY }}'
      
      - name: 'Set up Cloud SDK'
        uses: 'google-github-actions/setup-gcloud@v1'
      
      - name: 'Build and push'
        run: |-
          gcloud builds submit --tag asia-northeast1-docker.pkg.dev/${{ secrets.GCP_PROJECT_ID }}/stockspace-repo/backend:latest
      
      - name: 'Deploy to Cloud Run'
        run: |-
          gcloud run deploy stockspace-api \
            --image asia-northeast1-docker.pkg.dev/${{ secrets.GCP_PROJECT_ID }}/stockspace-repo/backend:latest \
            --region asia-northeast1 \
            --platform managed
```

GitHub Secretsに設定：
- `GCP_SA_KEY`: サービスアカウントのJSONキー
- `GCP_PROJECT_ID`: プロジェクトID

---

## コスト見積もり

### 最小構成（低トラフィック）

- **Cloud Run**: 無料枠内（月200万リクエストまで）
- **Cloud SQL (db-f1-micro)**: $7.67/月
- **Cloud Storage**: 無料枠内（5GBまで）
- **Cloud Build**: 無料枠内（1日120分まで）

**合計: 約$8/月**

### 中規模（中トラフィック）

- **Cloud Run**: $5-10/月
- **Cloud SQL (db-g1-small)**: $25/月
- **Cloud Storage**: $1-5/月
- **ネットワーク**: $5-10/月

**合計: 約$40-50/月**

---

## トラブルシューティング

### Cloud SQL接続エラー

```bash
# Cloud SQL Proxyで接続テスト
cloud_sql_proxy.exe -instances=stockspace-prod:asia-northeast1:stockspace-db=tcp:5432

# 接続文字列確認
gcloud sql instances describe stockspace-db
```

### ログ確認

```bash
# Cloud Runログ
gcloud run services logs read stockspace-api --region asia-northeast1 --limit 50
```

### 環境変数確認

```bash
# Cloud Run環境変数確認
gcloud run services describe stockspace-api --region asia-northeast1 --format="value(spec.template.spec.containers[0].env)"
```

---

## セキュリティベストプラクティス

1. **シークレット管理**: Secret Managerを使用
2. **IAM**: 最小権限の原則
3. **VPC**: プライベートIP使用（オプション）
4. **HTTPS**: 自動で有効
5. **認証**: Cloud Run認証を有効化（必要に応じて）

---

## 次のステップ

1. ✅ GCPプロジェクト作成
2. ✅ Cloud SQLセットアップ
3. ✅ Cloud Runデプロイ
4. ✅ データベースマイグレーション
5. ✅ モバイルアプリのAPI URL更新
6. ✅ テスト



