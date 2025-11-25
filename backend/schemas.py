from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime


# User schemas
class UserBase(BaseModel):
    email: EmailStr
    username: str
    name: str
    handle: str
    bio: Optional[str] = None


class UserCreate(UserBase):
    password: str


class UserResponse(UserBase):
    id: int
    icon_url: Optional[str] = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# Stock schemas
class StockBase(BaseModel):
    symbol: str
    name: str
    price: float
    change: float = 0
    change_pct: float = 0


class StockCreate(StockBase):
    high: Optional[float] = None
    low: Optional[float] = None
    per: Optional[float] = None
    pbr: Optional[float] = None
    dividend_yield: Optional[float] = None
    dividend_payout_ratio: Optional[float] = None
    market_cap: Optional[float] = None
    revenue: Optional[float] = None
    profit: Optional[float] = None


class StockResponse(StockCreate):
    id: int
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# Post schemas
class PostBase(BaseModel):
    text: str
    post_type: str = "user"
    stock_id: Optional[int] = None
    chart_image_url: Optional[str] = None


class PostCreate(PostBase):
    pass


class BotPostCreate(BaseModel):
    text: str
    stock_symbol: Optional[str] = None
    chart_image_url: Optional[str] = None
    event: Optional[str] = None


class PostResponse(PostBase):
    id: int
    user_id: int
    user: UserResponse
    stock: Optional[StockResponse] = None
    likes_count: int = 0
    retweets_count: int = 0
    comments_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


# Portfolio schemas
class PortfolioHoldingBase(BaseModel):
    stock_id: int
    shares: float
    purchase_price: Optional[float] = None


class PortfolioHoldingResponse(PortfolioHoldingBase):
    id: int
    stock: StockResponse

    model_config = {"from_attributes": True}


class PortfolioBase(BaseModel):
    name: str
    is_public: bool = False


class PortfolioCreate(PortfolioBase):
    holdings: List[PortfolioHoldingBase] = []


class PortfolioResponse(PortfolioBase):
    id: int
    user_id: int
    holdings: List[PortfolioHoldingResponse] = []
    created_at: datetime

    model_config = {"from_attributes": True}


# Auth schemas
class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    user_id: Optional[int] = None


# Follow schemas
class FollowCreate(BaseModel):
    following_id: int


class FollowResponse(BaseModel):
    id: int
    follower_id: int
    following_id: int
    created_at: datetime

    model_config = {"from_attributes": True}


# Comment schemas
class CommentBase(BaseModel):
    text: str


class CommentCreate(CommentBase):
    pass


class CommentResponse(CommentBase):
    id: int
    user_id: int
    post_id: int
    user: UserResponse
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class UserIconUpdate(BaseModel):
    icon_url: str
