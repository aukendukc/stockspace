"""
データベースマイグレーションスクリプト
GCP Cloud SQLにテーブルを作成する際に使用
"""
from backend.database import engine, Base
from backend import models

if __name__ == "__main__":
    print("Creating database tables...")
    try:
        # すべてのテーブルを作成
        Base.metadata.create_all(bind=engine)
        print("Database tables created successfully!")
    except Exception as e:
        print(f"Error creating tables: {e}")
        raise

