from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import SessionLocal
from backend import models, schemas
from backend.auth import get_current_user

router = APIRouter(prefix="/portfolios", tags=["portfolios"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("", response_model=schemas.PortfolioResponse)
def create_portfolio(
    portfolio: schemas.PortfolioCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db_portfolio = models.Portfolio(
        user_id=current_user.id,
        name=portfolio.name,
        is_public=portfolio.is_public,
    )
    db.add(db_portfolio)
    db.commit()
    db.refresh(db_portfolio)
    
    # Holdingsを追加
    for holding in portfolio.holdings:
        db_holding = models.PortfolioHolding(
            portfolio_id=db_portfolio.id,
            stock_id=holding.stock_id,
            shares=holding.shares,
            purchase_price=holding.purchase_price,
        )
        db.add(db_holding)
    
    db.commit()
    db.refresh(db_portfolio)
    
    # リレーションを読み込む
    db.refresh(db_portfolio, ["holdings", "holdings.stock"])
    
    return schemas.PortfolioResponse(
        id=db_portfolio.id,
        user_id=db_portfolio.user_id,
        name=db_portfolio.name,
        is_public=db_portfolio.is_public,
        created_at=db_portfolio.created_at,
        holdings=[
            schemas.PortfolioHoldingResponse(
                id=h.id,
                stock_id=h.stock_id,
                shares=h.shares,
                purchase_price=h.purchase_price,
                stock=schemas.StockResponse.model_validate(h.stock),
            )
            for h in db_portfolio.holdings
        ],
    )


@router.get("", response_model=List[schemas.PortfolioResponse])
def get_portfolios(
    user_id: int = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(models.Portfolio)
    
    # 自分のポートフォリオまたは公開されているポートフォリオのみ
    if user_id:
        query = query.filter(
            (models.Portfolio.user_id == user_id) &
            ((models.Portfolio.user_id == current_user.id) | (models.Portfolio.is_public == True))
        )
    else:
        query = query.filter(
            (models.Portfolio.user_id == current_user.id) | (models.Portfolio.is_public == True)
        )
    
    portfolios = query.all()
    
    result = []
    for portfolio in portfolios:
        db.refresh(portfolio, ["holdings", "holdings.stock"])
        result.append(schemas.PortfolioResponse(
            id=portfolio.id,
            user_id=portfolio.user_id,
            name=portfolio.name,
            is_public=portfolio.is_public,
            created_at=portfolio.created_at,
            holdings=[
                schemas.PortfolioHoldingResponse(
                    id=h.id,
                    stock_id=h.stock_id,
                    shares=h.shares,
                    purchase_price=h.purchase_price,
                    stock=schemas.StockResponse.model_validate(h.stock),
                )
                for h in portfolio.holdings
            ],
        ))
    
    return result


@router.get("/{portfolio_id}", response_model=schemas.PortfolioResponse)
def get_portfolio(
    portfolio_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    portfolio = db.query(models.Portfolio).filter(models.Portfolio.id == portfolio_id).first()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    
    # 自分のポートフォリオまたは公開されているポートフォリオのみ
    if portfolio.user_id != current_user.id and not portfolio.is_public:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    db.refresh(portfolio, ["holdings", "holdings.stock"])
    
    return schemas.PortfolioResponse(
        id=portfolio.id,
        user_id=portfolio.user_id,
        name=portfolio.name,
        is_public=portfolio.is_public,
        created_at=portfolio.created_at,
        holdings=[
            schemas.PortfolioHoldingResponse(
                id=h.id,
                stock_id=h.stock_id,
                shares=h.shares,
                purchase_price=h.purchase_price,
                stock=schemas.StockResponse.model_validate(h.stock),
            )
            for h in portfolio.holdings
        ],
    )


@router.delete("/{portfolio_id}")
def delete_portfolio(
    portfolio_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    portfolio = db.query(models.Portfolio).filter(models.Portfolio.id == portfolio_id).first()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    if portfolio.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    db.delete(portfolio)
    db.commit()
    return {"message": "Portfolio deleted"}

