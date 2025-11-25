"""
データベースから全銘柄を削除するスクリプト
これ以降、すべての銘柄情報はネットからリアルタイムで取得されます。
"""
import os
from backend.database import SessionLocal
from backend import models

if __name__ == "__main__":
    db = SessionLocal()
    try:
        # 全銘柄を削除
        deleted_count = db.query(models.Stock).delete()
        db.commit()
        print(f"✅ {deleted_count}件の銘柄データを削除しました")
        print("これ以降、すべての銘柄情報はネットからリアルタイムで取得されます。")
    except Exception as e:
        db.rollback()
        print(f"❌ エラーが発生しました: {e}")
        raise
    finally:
        db.close()

