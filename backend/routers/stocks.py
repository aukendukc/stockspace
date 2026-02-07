import os
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_

from backend.database import SessionLocal
from backend import models, schemas
from backend.services.stock_data import (
    fetch_stock_data,
    fetch_stock_data_detailed,
    get_listed_stocks,
)

router = APIRouter(prefix="/stocks", tags=["stocks"])

DEFAULT_POPULAR_SYMBOLS = [
    "7203",  # Toyota
    "6758",  # Sony
    "9984",  # Softbank G
    "9434",  # KDDI
    "6861",  # Keyence
    "9983",  # Fast Retailing
    "8035",  # Tokyo Electron
    "4063",  # Shin-Etsu Chemical
    "8267",  # Aeon
    "4503",  # Astellas Pharma
]

POPULAR_STOCK_SYMBOLS = [
    symbol.strip()
    for symbol in os.getenv("POPULAR_STOCK_SYMBOLS", ",".join(DEFAULT_POPULAR_SYMBOLS)).split(",")
    if symbol.strip()
]


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# モックデータは削除 - 常にYahoo Finance APIからリアルタイムデータを取得

@router.get("", response_model=List[schemas.StockResponse])
def get_stocks(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = Query(None, description="銘柄コードで検索（必須）"),
    db: Session = Depends(get_db)
):
    """
    銘柄を検索。Yahoo Finance APIからリアルタイムで取得。
    searchパラメータは銘柄コード（数字）である必要があります。
    """
    import logging
    logger = logging.getLogger(__name__)
    
    if not search:
        # 検索クエリがない場合は空のリストを返す
        return []

    search = search.strip()
    if not search:
        return []

    # 銘柄コードで検索（数字）
    if search.isdigit():
        logger.info(f"Searching for stock by code: {search}")
        realtime_data = None
        try:
            realtime_data = fetch_stock_data_detailed(search)
        except Exception as e:
            logger.warning(f"Yahoo Finance API failed for {search}: {e}")

        if not realtime_data:
            raise HTTPException(
                status_code=404,
                detail=f"銘柄が見つかりませんでした: {search}",
            )

        logger.info(f"Found stock: {realtime_data.get('name')} ({realtime_data.get('symbol')})")
        return [
            schemas.StockResponse(
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
        ]

    # 銘柄名で検索（J-Quantsの上場銘柄リスト）
    listed_matches = get_listed_stocks(search)
    if not listed_matches:
        raise HTTPException(status_code=404, detail=f"銘柄が見つかりませんでした: {search}")

    symbols = [item["symbol"] for item in listed_matches][:limit]
    if not symbols:
        raise HTTPException(status_code=404, detail=f"銘柄が見つかりませんでした: {search}")

    realtime_data_map = fetch_stock_data(symbols)
    results: List[schemas.StockResponse] = []
    for symbol in symbols:
        metrics = realtime_data_map.get(symbol)
        if not metrics:
            continue
        results.append(
            schemas.StockResponse(
                id=0,
                symbol=symbol,
                name=metrics.get("name", symbol),
                price=metrics.get("price") or 0,
                change=metrics.get("change") or 0,
                change_pct=metrics.get("change_pct") or 0,
                high=metrics.get("high"),
                low=metrics.get("low"),
                per=metrics.get("per"),
                pbr=metrics.get("pbr"),
                dividend_yield=metrics.get("dividend_yield"),
                dividend_payout_ratio=metrics.get("dividend_payout_ratio"),
                market_cap=metrics.get("market_cap"),
                revenue=metrics.get("revenue"),
                profit=metrics.get("profit"),
                updated_at=None,
            )
        )

    if not results:
        raise HTTPException(status_code=404, detail=f"銘柄が見つかりませんでした: {search}")

    return results


@router.get("/rankings", response_model=schemas.StockRankingResponse)
def get_stock_rankings(
    limit: int = Query(5, ge=1, le=50),
    scope: str = Query("popular", description="popular or all"),
    db: Session = Depends(get_db),
):
    """
    人気銘柄のリアルタイムランキングを取得。
    Yahoo Finance APIから常にリアルタイムデータを取得します。
    """
    import logging
    logger = logging.getLogger(__name__)
    
    symbols_to_use = POPULAR_STOCK_SYMBOLS if POPULAR_STOCK_SYMBOLS else DEFAULT_POPULAR_SYMBOLS

    if scope == "all":
        try:
            from backend.services.stock_data import get_market_movers_all
            movers = get_market_movers_all(limit=limit)
            return schemas.StockRankingResponse(
                updated_at=datetime.utcnow(),
                top_gainers=[
                    schemas.StockRankingEntry(**item) for item in movers.get("top_gainers", [])
                ],
                top_losers=[
                    schemas.StockRankingEntry(**item) for item in movers.get("top_losers", [])
                ],
            )
        except Exception as e:
            logger.error(f"Failed to build all-market rankings: {e}")
            raise HTTPException(
                status_code=503,
                detail="全銘柄ランキングの取得に失敗しました。しばらく待ってから再度お試しください。"
            )

    # Yahoo Finance APIからデータ取得
    realtime_data = {}
    try:
        realtime_data = fetch_stock_data(symbols_to_use)
        logger.info(f"Fetched {len(realtime_data)} stocks from Yahoo Finance")
    except Exception as e:
        logger.error(f"Yahoo Finance API failed: {e}")
        raise HTTPException(
            status_code=503,
            detail="株価データの取得に失敗しました。しばらく待ってから再度お試しください。"
        )

    if not realtime_data:
        raise HTTPException(
            status_code=503,
            detail="株価データを取得できませんでした。"
        )

    entries = []
    for symbol in symbols_to_use:
        metrics = realtime_data.get(symbol)
        if not metrics:
            logger.warning(f"No data for symbol: {symbol}")
            continue

        name = metrics.get("name", symbol)
        price = metrics.get("price") or 0.0
        change = metrics.get("change") or 0.0
        change_pct = metrics.get("change_pct") or 0.0

        entries.append(
            schemas.StockRankingEntry(
                symbol=symbol,
                name=name,
                price=float(price),
                change=float(change),
                change_pct=float(change_pct),
            )
        )

    if not entries:
        raise HTTPException(
            status_code=503,
            detail="ランキングデータを取得できませんでした。"
        )

    top_gainers = sorted(entries, key=lambda item: item.change_pct, reverse=True)[:limit]
    top_losers = sorted(entries, key=lambda item: item.change_pct)[:limit]

    return schemas.StockRankingResponse(
        updated_at=datetime.utcnow(),
        top_gainers=top_gainers,
        top_losers=top_losers,
    )


@router.get("/listed", response_model=List[schemas.StockListedInfo])
def get_listed_stocks_api(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = Query(None, description="銘柄コードまたは会社名で検索"),
):
    """
    日本の上場銘柄リストを取得（J-Quants）。
    価格は含まず、銘柄コードと会社名のみ返します。
    """
    items = get_listed_stocks(search)
    if not items:
        raise HTTPException(
            status_code=503,
            detail="上場銘柄リストを取得できませんでした。J-Quantsトークンを確認してください。",
        )

    sliced = items[skip : skip + limit]
    return [
        schemas.StockListedInfo(
            symbol=item.get("symbol"),
            name=item.get("name"),
            market=item.get("market"),
        )
        for item in sliced
    ]


@router.get("/{symbol}", response_model=schemas.StockResponse)
def get_stock(symbol: str, db: Session = Depends(get_db)):
    """
    銘柄の詳細情報を取得。常にネットからリアルタイムで取得します。
    """
    # 常にネットからリアルタイムで取得
    # 会社名が入ってきた場合はJ-Quantsリストから銘柄コードを解決
    resolved_symbol = symbol
    if not symbol.isdigit():
        matches = get_listed_stocks(symbol)
        if matches:
            resolved_symbol = matches[0]["symbol"]

    realtime_data = fetch_stock_data_detailed(resolved_symbol)
    if not realtime_data:
        # 詳細取得に失敗した場合は、簡易データでフォールバックする
        logger.warning(f"Detailed fetch failed for {resolved_symbol}, trying fallback")
        fallback_map = fetch_stock_data([resolved_symbol])
        realtime_data = fallback_map.get(resolved_symbol) if fallback_map else None
        if not realtime_data:
            logger.error(f"Stock not found: {resolved_symbol}")
            raise HTTPException(status_code=404, detail="Stock not found")
    
    # データソースをログ出力
    logger.info(f"Returning stock data for {resolved_symbol}: source={realtime_data.get('source', 'unknown')}, "
               f"has_revenue_history={bool(realtime_data.get('revenue_history'))}, "
               f"has_price_history={bool(realtime_data.get('price_history'))}")
    
    # リアルタイムデータをStockResponse形式に変換
    return schemas.StockResponse(
        id=0,
        symbol=realtime_data.get("symbol", resolved_symbol),
        name=realtime_data.get("name", resolved_symbol),
        price=realtime_data.get("price") or 0,
        change=realtime_data.get("change") or 0,
        change_pct=realtime_data.get("change_pct") or 0,
        high=realtime_data.get("high"),
        low=realtime_data.get("low"),
        per=realtime_data.get("per"),
        pbr=realtime_data.get("pbr"),
        dividend_yield=realtime_data.get("dividend_yield"),
        dividend_payout_ratio=realtime_data.get("dividend_payout_ratio"),
        market_cap=realtime_data.get("market_cap"),
        revenue=realtime_data.get("revenue"),
        profit=realtime_data.get("profit"),
        price_history=realtime_data.get("price_history"),
        price_history_labels=realtime_data.get("price_history_labels"),
        revenue_history=realtime_data.get("revenue_history"),
        profit_history=realtime_data.get("profit_history"),
        dividend_history=realtime_data.get("dividend_history"),
        dividend_labels=realtime_data.get("dividend_labels"),
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

