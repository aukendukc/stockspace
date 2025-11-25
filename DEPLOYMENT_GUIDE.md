# StockSpace 本番環境デプロイガイド

## 必要なサービス一覧

### 1. バックエンドサーバー（FastAPI）

#### 推奨サービス

**A. Railway（推奨）**
- ✅ Python/FastAPI対応
- ✅ 自動デプロイ（GitHub連携）
- ✅ PostgreSQL無料プランあり
- ✅ 環境変数管理が簡単
- 💰 無料プランあり、その後$5/月〜
- 🔗 https://railway.app

**B. Render**
- ✅ Python/FastAPI対応
- ✅ 無料プランあり（スリープあり）
- ✅ PostgreSQL対応
- 💰 無料プランあり、その後$7/月〜
- 🔗 https://render.com

**C. Fly.io**
- ✅ グローバルCDN
- ✅ 無料プランあり
- ✅ PostgreSQL対応
- 💰 無料プランあり、その後$5/月〜
- 🔗 https://fly.io

**D. Heroku**
- ✅ 簡単デプロイ
- ⚠️ 無料プラン廃止（有料のみ）
- 💰 $7/月〜
- 🔗 https://heroku.com

**E. AWS/GCP/Azure（エンタープライズ向け）**
- ✅ スケーラブル
- ⚠️ 設定が複雑
- 💰 従量課金

---

### 2. データベース

現在はSQLiteですが、本番環境ではPostgreSQL推奨

#### 推奨サービス

**A. Railway PostgreSQL（Railway使用時）**
- ✅ Railwayと統合
- ✅ 自動バックアップ
- 💰 無料プランあり

**B. Supabase**
- ✅ PostgreSQL（無料プランあり）
- ✅ リアルタイム機能
- ✅ 認証機能も提供
- 💰 無料プランあり（500MB）
- 🔗 https://supabase.com

**C. Neon**
- ✅ サーバーレスPostgreSQL
- ✅ 無料プランあり
- 💰 無料プランあり（3GB）
- 🔗 https://neon.tech

**D. PlanetScale**
- ✅ MySQL互換（PostgreSQLではない）
- ✅ スケーラブル
- 💰 無料プランあり
- 🔗 https://planetscale.com

---

### 3. 株価データAPI（未実装機能）

#### 推奨サービス

**A. Alpha Vantage（無料）**
- ✅ 無料プランあり（1日500リクエスト）
- ✅ リアルタイム株価
- 🔗 https://www.alphavantage.co

**B. Yahoo Finance API（無料）**
- ✅ 無料
- ✅ yfinanceライブラリで簡単
- ⚠️ 非公式API（利用規約注意）

**C. Polygon.io**
- ✅ リアルタイムデータ
- ✅ 無料プランあり（1分5リクエスト）
- 💰 無料プランあり、その後$29/月〜
- 🔗 https://polygon.io

**D. IEX Cloud**
- ✅ 無料プランあり
- ✅ リアルタイムデータ
- 💰 無料プランあり（50万メッセージ/月）
- 🔗 https://iexcloud.io

**E. 日本株価データ（日本語銘柄用）**
- **Yahoo Finance Japan**（yfinanceで取得可能）
- **kabuステーションAPI**（SBI証券）
- **楽天証券API**

---

### 4. 画像ストレージ（チャート画像アップロード用）

#### 推奨サービス

**A. Cloudinary（推奨）**
- ✅ 無料プランあり（25GB）
- ✅ 画像最適化自動
- ✅ CDN配信
- 🔗 https://cloudinary.com

**B. AWS S3**
- ✅ 低コスト
- ⚠️ 設定がやや複雑
- 💰 従量課金（最初の1年は無料）

**C. Cloudflare R2**
- ✅ S3互換
- ✅ 無料プランあり（10GB）
- 🔗 https://www.cloudflare.com/products/r2

**D. Supabase Storage**
- ✅ Supabase使用時は統合しやすい
- ✅ 無料プランあり（1GB）
- 🔗 https://supabase.com/storage

---

### 5. フロントエンド（Next.js）

#### 推奨サービス

**A. Vercel（推奨）**
- ✅ Next.js開発元が運営
- ✅ 自動デプロイ
- ✅ 無料プランあり
- 🔗 https://vercel.com

**B. Netlify**
- ✅ 簡単デプロイ
- ✅ 無料プランあり
- 🔗 https://netlify.com

**C. Railway/Render**
- ✅ バックエンドと同じサービスで管理可能

---

### 6. モバイルアプリ（Expo）

#### デプロイ方法

**A. Expo Application Services (EAS)**
- ✅ Expo公式サービス
- ✅ iOS/Android両対応
- ✅ 無料プランあり
- 🔗 https://expo.dev

**B. App Store / Google Play**
- ✅ 通常のアプリストア配布
- 💰 開発者登録料必要（Apple: $99/年、Google: $25/一回）

---

### 7. その他の推奨サービス

#### モニタリング・ログ

**A. Sentry**
- ✅ エラー追跡
- ✅ 無料プランあり
- 🔗 https://sentry.io

**B. LogRocket**
- ✅ ユーザーセッション記録
- 💰 有料のみ

#### 認証（オプション）

**A. Auth0**
- ✅ 認証サービス
- ✅ 無料プランあり（7000ユーザーまで）
- 🔗 https://auth0.com

**B. Firebase Auth**
- ✅ Google提供
- ✅ 無料プランあり
- 🔗 https://firebase.google.com

---

## 推奨構成（コスト最小）

### 最小構成（無料〜低コスト）

1. **バックエンド**: Railway（無料プラン）
2. **データベース**: Railway PostgreSQL（無料プラン）またはSupabase
3. **フロントエンド**: Vercel（無料プラン）
4. **画像ストレージ**: Cloudinary（無料プラン）
5. **株価API**: Alpha Vantage（無料）またはYahoo Finance
6. **モバイル**: Expo EAS（無料プラン）

**月額コスト**: $0〜$10程度

---

### 中規模構成（安定運用）

1. **バックエンド**: Railway（$5/月）
2. **データベース**: Supabase（無料〜$25/月）
3. **フロントエンド**: Vercel（無料〜$20/月）
4. **画像ストレージ**: Cloudinary（無料〜$99/月）
5. **株価API**: Polygon.io（$29/月）
6. **モニタリング**: Sentry（無料〜$26/月）

**月額コスト**: $30〜$100程度

---

## セットアップ手順（Railway例）

### 1. Railwayでバックエンドデプロイ

```bash
# Railway CLIインストール
npm i -g @railway/cli

# ログイン
railway login

# プロジェクト作成
railway init

# PostgreSQL追加
railway add postgresql

# 環境変数設定
railway variables set DATABASE_URL=${{Postgres.DATABASE_URL}}

# デプロイ
railway up
```

### 2. データベース接続設定変更

`backend/database.py`を修正：

```python
import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# 環境変数から取得、なければSQLite
SQLALCHEMY_DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "sqlite:///./stockspace.db"
).replace("postgres://", "postgresql://")  # Railway用

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
```

### 3. モバイルアプリのAPI URL更新

`mobile/services/api.ts`を修正：

```typescript
const API_BASE_URL = __DEV__ 
  ? "http://localhost:8000"
  : "https://your-app.railway.app";  // RailwayのURL
```

---

## 注意事項

1. **CORS設定**: 本番環境では`allow_origins=["*"]`を変更
2. **環境変数**: シークレットキーは環境変数で管理
3. **データベースバックアップ**: 定期バックアップ設定
4. **レート制限**: APIレート制限の実装
5. **HTTPS**: 必ずHTTPSを使用

---

## 次のステップ

1. Railwayアカウント作成
2. バックエンドデプロイ
3. データベース移行（SQLite → PostgreSQL）
4. 環境変数設定
5. モバイルアプリのAPI URL更新
6. テスト








