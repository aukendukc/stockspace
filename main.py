import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.database import engine, Base
from backend.routers import auth, posts, stocks, portfolios, follows

# データベーステーブル作成（開発環境のみ自動実行）
# 本番環境では migrate_db.py を使用
if os.getenv("AUTO_CREATE_TABLES", "false").lower() == "true":
    Base.metadata.create_all(bind=engine)

app = FastAPI(title="StockSpace API", version="1.0.0")

# CORS設定
# 環境変数から許可オリジンを取得、なければ開発環境用の設定
allowed_origins_str = os.getenv("ALLOWED_ORIGINS", "*")
if allowed_origins_str == "*":
    # すべてのオリジンを許可（モバイルアプリ対応）
    allowed_origins = ["*"]
else:
    allowed_origins = allowed_origins_str.split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ルーター登録
app.include_router(auth.router)
app.include_router(posts.router)
app.include_router(stocks.router)
app.include_router(portfolios.router)
app.include_router(follows.router)


@app.get("/")
def home():
    return {"msg": "Hello StockSpace API"}
