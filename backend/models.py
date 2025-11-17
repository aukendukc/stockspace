from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from backend.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    handle = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    bio = Column(Text, nullable=True)
    icon_url = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    posts = relationship("Post", back_populates="user")
    portfolios = relationship("Portfolio", back_populates="user")
    following = relationship(
        "Follow",
        foreign_keys="Follow.follower_id",
        back_populates="follower"
    )
    followers = relationship(
        "Follow",
        foreign_keys="Follow.following_id",
        back_populates="following"
    )
    likes = relationship("Like", back_populates="user")
    retweets = relationship("Retweet", back_populates="user")


class Stock(Base):
    __tablename__ = "stocks"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    price = Column(Float, nullable=False)
    change = Column(Float, default=0)
    change_pct = Column(Float, default=0)
    high = Column(Float, nullable=True)
    low = Column(Float, nullable=True)
    per = Column(Float, nullable=True)
    pbr = Column(Float, nullable=True)
    dividend_yield = Column(Float, nullable=True)
    dividend_payout_ratio = Column(Float, nullable=True)
    market_cap = Column(Float, nullable=True)
    revenue = Column(Float, nullable=True)
    profit = Column(Float, nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    posts = relationship("Post", back_populates="stock")
    portfolio_holdings = relationship("PortfolioHolding", back_populates="stock")


class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    stock_id = Column(Integer, ForeignKey("stocks.id"), nullable=True)
    text = Column(Text, nullable=False)
    post_type = Column(String, default="user")  # user, bot, purchase, sale
    chart_image_url = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="posts")
    stock = relationship("Stock", back_populates="posts")
    likes = relationship("Like", back_populates="post", cascade="all, delete-orphan")
    retweets = relationship("Retweet", back_populates="post", cascade="all, delete-orphan")
    comments = relationship("Comment", back_populates="post", cascade="all, delete-orphan")


class Portfolio(Base):
    __tablename__ = "portfolios"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    is_public = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="portfolios")
    holdings = relationship("PortfolioHolding", back_populates="portfolio", cascade="all, delete-orphan")


class PortfolioHolding(Base):
    __tablename__ = "portfolio_holdings"

    id = Column(Integer, primary_key=True, index=True)
    portfolio_id = Column(Integer, ForeignKey("portfolios.id"), nullable=False)
    stock_id = Column(Integer, ForeignKey("stocks.id"), nullable=False)
    shares = Column(Float, nullable=False)
    purchase_price = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    portfolio = relationship("Portfolio", back_populates="holdings")
    stock = relationship("Stock", back_populates="portfolio_holdings")


class Follow(Base):
    __tablename__ = "follows"

    id = Column(Integer, primary_key=True, index=True)
    follower_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    following_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    follower = relationship("User", foreign_keys=[follower_id], back_populates="following")
    following = relationship("User", foreign_keys=[following_id], back_populates="followers")


class Like(Base):
    __tablename__ = "likes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="likes")
    post = relationship("Post", back_populates="likes")


class Retweet(Base):
    __tablename__ = "retweets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="retweets")
    post = relationship("Post", back_populates="retweets")


class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False)
    text = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    user = relationship("User")
    post = relationship("Post", back_populates="comments")

