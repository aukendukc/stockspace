from typing import List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from backend.database import SessionLocal
from backend import models, schemas
from backend.services.stock_data import fetch_stock_data

router = APIRouter(prefix="/stocks", tags=["stocks"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("", response_model=List[schemas.StockResponse])
def get_stocks(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    stocks = db.query(models.Stock).offset(skip).limit(limit).all()
    return stocks


@router.get("/{symbol}", response_model=schemas.StockResponse)
def get_stock(symbol: str, db: Session = Depends(get_db)):
    stock = db.query(models.Stock).filter(models.Stock.symbol == symbol).first()
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")
    return stock


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

