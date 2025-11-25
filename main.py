import os
import logging
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from backend.database import SessionLocal, engine, Base
from backend.routers import auth, posts, stocks, portfolios, follows
from backend.routers import uploads
from backend import models
from backend.services.stock_data import fetch_stock_data

logger = logging.getLogger(__name__)

# データベーステーブル作成（開発環境のみ自動実行）
# 本番環境では migrate_db.py を使用
if os.getenv("AUTO_CREATE_TABLES", "false").lower() == "true":
    Base.metadata.create_all(bind=engine)


def refresh_all_stocks():
    """全銘柄の株価を更新するジョブ"""
    try:
        db = SessionLocal()
        try:
            stocks = db.query(models.Stock).all()
            if not stocks:
                logger.info("No stocks to refresh")
                return
            
            symbols = [s.symbol for s in stocks]
            logger.info(f"Refreshing {len(symbols)} stocks...")
            
            external_data = fetch_stock_data(symbols)
            if not external_data:
                logger.warning("Failed to fetch stock data from external provider")
                return
            
            updated = 0
            for stock in stocks:
                metrics = external_data.get(stock.symbol)
                if not metrics:
                    continue
                
                if "price" in metrics:
                    stock.price = metrics["price"]
                if "change" in metrics:
                    stock.change = metrics["change"]
                if "change_pct" in metrics:
                    stock.change_pct = metrics["change_pct"]
                if "high" in metrics:
                    stock.high = metrics["high"]
                if "low" in metrics:
                    stock.low = metrics["low"]
                if "per" in metrics:
                    stock.per = metrics["per"]
                if "pbr" in metrics:
                    stock.pbr = metrics["pbr"]
                if "dividend_yield" in metrics:
                    stock.dividend_yield = metrics["dividend_yield"]
                if "dividend_payout_ratio" in metrics:
                    stock.dividend_payout_ratio = metrics["dividend_payout_ratio"]
                if "market_cap" in metrics:
                    stock.market_cap = metrics["market_cap"]
                
                updated += 1
            
            db.commit()
            logger.info(f"Successfully updated {updated} stocks")
        except Exception as e:
            logger.error(f"Error refreshing stocks: {e}", exc_info=True)
            db.rollback()
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error in refresh_all_stocks: {e}", exc_info=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """アプリケーションのライフサイクル管理"""
    # 起動時
    logger.info("Starting StockSpace API...")
    
    # スケジューラーは無効化（すべてリアルタイム取得のため）
    # データベースに銘柄を保存しないため、定期更新は不要
    enable_scheduler = os.getenv("ENABLE_STOCK_SCHEDULER", "false").lower() == "true"
    refresh_interval = int(os.getenv("STOCK_REFRESH_INTERVAL_MINUTES", "5"))
    
    scheduler = None
    if enable_scheduler:
        scheduler = BackgroundScheduler()
        scheduler.add_job(
            refresh_all_stocks,
            trigger=IntervalTrigger(minutes=refresh_interval),
            id="refresh_stocks",
            name="Refresh all stock prices",
            replace_existing=True,
        )
        scheduler.start()
        logger.info(f"Stock price scheduler started (interval: {refresh_interval} minutes)")
        
        # 起動時に一度実行
        refresh_all_stocks()
    else:
        logger.info("Stock price scheduler disabled (using real-time fetching)")
    
    yield
    
    # シャットダウン時
    if scheduler:
        scheduler.shutdown()
        logger.info("Stock price scheduler stopped")


app = FastAPI(
    title="StockSpace API",
    version="1.0.0",
    lifespan=lifespan
)

upload_dir = Path("uploads")
upload_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=upload_dir), name="uploads")

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
app.include_router(uploads.router)


@app.get("/")
def home():
    return {"msg": "Hello StockSpace API"}
