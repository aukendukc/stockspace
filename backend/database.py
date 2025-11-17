import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# 環境変数からデータベースURLを取得
# 本番環境（GCP Cloud SQL）: DATABASE_URL環境変数を使用
# 開発環境: SQLiteを使用
DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL:
    # 本番環境（PostgreSQL）
    # Cloud SQL接続文字列をそのまま使用
    SQLALCHEMY_DATABASE_URL = DATABASE_URL
    connect_args = {}
else:
    # 開発環境（SQLite）
    SQLALCHEMY_DATABASE_URL = "sqlite:///./stockspace.db"
    connect_args = {"check_same_thread": False}

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,  # 接続の有効性をチェック
    pool_size=5,  # PostgreSQL用の接続プールサイズ
    max_overflow=10,  # 最大オーバーフロー接続数
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
