from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_
from backend.database import SessionLocal
from backend import models, schemas
from backend.services.stock_data import fetch_stock_data, fetch_stock_data_detailed

router = APIRouter(prefix="/stocks", tags=["stocks"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("", response_model=List[schemas.StockResponse])
def get_stocks(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = Query(None, description="銘柄コードまたは名前で検索（必須）"),
    db: Session = Depends(get_db)
):
    """
    銘柄を検索。常にネットからリアルタイムで取得します。
    searchパラメータが必須です。
    """
    if not search:
        # 検索クエリがない場合は空のリストを返す
        return []
    
    # 常にネットからリアルタイムで取得
    import logging
    logger = logging.getLogger(__name__)
    
    if search.isdigit():
        # 銘柄コードで検索
        logger.info(f"Searching for stock: {search}")
        realtime_data = fetch_stock_data_detailed(search)
        if realtime_data:
            logger.info(f"Found stock: {realtime_data.get('name')} ({realtime_data.get('symbol')})")
            return [schemas.StockResponse(
                id=0,
                symbol=realtime_data["symbol"],
                name=realtime_data["name"],
                price=realtime_data["price"] or 0,
                change=realtime_data["change"] or 0,
                change_pct=realtime_data["change_pct"] or 0,
                high=realtime_data.get("high"),
                low=realtime_data.get("low"),
                per=realtime_data.get("per"),
                pbr=realtime_data.get("pbr"),
                dividend_yield=realtime_data.get("dividend_yield"),
                dividend_payout_ratio=realtime_data.get("dividend_payout_ratio"),
                market_cap=realtime_data.get("market_cap"),
                revenue=realtime_data.get("revenue"),
                profit=realtime_data.get("profit"),
                updated_at=None,
            )]
        else:
            logger.warning(f"Stock not found: {search}")
            raise HTTPException(status_code=404, detail=f"銘柄が見つかりませんでした: {search}")
    
    # 名前で検索する場合は、データベースを参照せず空を返す
    # （yfinanceでは名前検索ができないため）
    raise HTTPException(status_code=400, detail="銘柄コード（数字）で検索してください")


@router.get("/{symbol}", response_model=schemas.StockResponse)
def get_stock(symbol: str, db: Session = Depends(get_db)):
    """
    銘柄の詳細情報を取得。常にネットからリアルタイムで取得します。
    """
    # 常にネットからリアルタイムで取得
    realtime_data = fetch_stock_data_detailed(symbol)
    if not realtime_data:
        raise HTTPException(status_code=404, detail="Stock not found")
    
    # リアルタイムデータをStockResponse形式に変換
    return schemas.StockResponse(
        id=0,
        symbol=realtime_data["symbol"],
        name=realtime_data["name"],
        price=realtime_data["price"] or 0,
        change=realtime_data["change"] or 0,
        change_pct=realtime_data["change_pct"] or 0,
        high=realtime_data.get("high"),
        low=realtime_data.get("low"),
        per=realtime_data.get("per"),
        pbr=realtime_data.get("pbr"),
        dividend_yield=realtime_data.get("dividend_yield"),
        dividend_payout_ratio=realtime_data.get("dividend_payout_ratio"),
        market_cap=realtime_data.get("market_cap"),
        revenue=realtime_data.get("revenue"),
        profit=realtime_data.get("profit"),
        updated_at=None,
    )


@router.post("", response_model=schemas.StockResponse)
def create_stock(stock: schemas.StockCreate, db: Session = Depends(get_db)):
    db_stock = models.Stock(**stock.dict())
    db.add(db_stock)
    db.commit()
    db.refresh(db_stock)
    return db_stock


class StockRefreshRequest(BaseModel):
    symbols: List[str] | None = None


@router.post("/refresh")
def refresh_stocks(
    payload: StockRefreshRequest = StockRefreshRequest(symbols=None),
    db: Session = Depends(get_db),
):
    query = db.query(models.Stock)
    if payload.symbols:
        query = query.filter(models.Stock.symbol.in_(payload.symbols))

    stocks = query.all()
    if not stocks:
        raise HTTPException(status_code=404, detail="No stocks found to refresh")

    external_data = fetch_stock_data([s.symbol for s in stocks])
    if not external_data:
        raise HTTPException(
            status_code=502,
            detail="Failed to fetch stock data from external provider",
        )

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

    if updated == 0:
        raise HTTPException(
            status_code=502,
            detail="External provider did not return data for the requested symbols",
        )

    db.commit()
    return {"updated": updated}


@router.delete("/all")
def delete_all_stocks(db: Session = Depends(get_db)):
    """
    データベースに保存されている全銘柄を削除します。
    これ以降、すべての銘柄情報はネットからリアルタイムで取得されます。
    """
    try:
        deleted_count = db.query(models.Stock).delete()
        db.commit()
        return {"message": f"Deleted {deleted_count} stocks from database", "deleted": deleted_count}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error deleting stocks: {str(e)}")


@router.delete("/{symbol}")
def delete_stock(symbol: str, db: Session = Depends(get_db)):
    """
    指定された銘柄をデータベースから削除します。
    """
    stock = db.query(models.Stock).filter(models.Stock.symbol == symbol).first()
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found in database")
    
    db.delete(stock)
    db.commit()
    return {"message": f"Stock {symbol} deleted from database"}


@router.put("/{symbol}", response_model=schemas.StockResponse)
def update_stock(symbol: str, stock: schemas.StockCreate, db: Session = Depends(get_db)):
    db_stock = db.query(models.Stock).filter(models.Stock.symbol == symbol).first()
    if not db_stock:
        raise HTTPException(status_code=404, detail="Stock not found")
    
    for key, value in stock.dict().items():
        setattr(db_stock, key, value)
    
    db.commit()
    db.refresh(db_stock)
    return db_stock

