from pydantic import BaseModel, EmailStr
from typing import Optional, List, Any
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
    price_history: Optional[List[float]] = None
    price_history_labels: Optional[List[str]] = None
    revenue_history: Optional[List[float]] = None
    profit_history: Optional[List[float]] = None
    dividend_history: Optional[List[Any]] = None
    dividend_labels: Optional[List[str]] = None


class StockResponse(StockCreate):
    id: int
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class StockRankingEntry(BaseModel):
    symbol: str
    name: str
    price: float
    change: float
    change_pct: float


class StockRankingResponse(BaseModel):
    updated_at: datetime
    top_gainers: List[StockRankingEntry]
    top_losers: List[StockRankingEntry]


class StockListedInfo(BaseModel):
    symbol: str
    name: str
    market: Optional[str] = None


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
    is_liked: bool = False
    is_retweeted: bool = False
    retweeted_by: Optional[UserResponse] = None  # リツイートした人
    retweeted_at: Optional[datetime] = None  # リツイートした日時
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


# DM (Direct Message) schemas
class DirectMessageCreate(BaseModel):
    text: str


class DirectMessageResponse(BaseModel):
    id: int
    conversation_id: int
    sender_id: int
    sender: UserResponse
    text: str
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ConversationCreate(BaseModel):
    user_id: int  # 会話相手のユーザーID
    initial_message: str  # 最初のメッセージ


class ConversationResponse(BaseModel):
    id: int
    other_user: UserResponse  # 相手ユーザー
    last_message: Optional[DirectMessageResponse] = None
    unread_count: int = 0
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ConversationDetailResponse(BaseModel):
    id: int
    other_user: UserResponse
    messages: List[DirectMessageResponse] = []
    created_at: datetime

    model_config = {"from_attributes": True}
