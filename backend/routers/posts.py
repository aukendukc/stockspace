import os
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.database import SessionLocal
from backend import models, schemas
from backend.auth import get_current_user

router = APIRouter(prefix="/posts", tags=["posts"])
BOT_API_KEY = os.getenv("BOT_API_KEY")
BOT_USER_ID = os.getenv("BOT_USER_ID")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("", response_model=schemas.PostResponse)
def create_post(
    post: schemas.PostCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db_post = models.Post(
        user_id=current_user.id,
        text=post.text,
        post_type=post.post_type,
        stock_id=post.stock_id,
        chart_image_url=post.chart_image_url,
    )
    db.add(db_post)
    db.commit()
    db.refresh(db_post)

    return serialize_post(db_post, db)


@router.get("", response_model=List[schemas.PostResponse])
def get_posts(
    skip: int = 0,
    limit: int = 20,
    stock_id: Optional[int] = None,
    user_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.Post)
    
    if stock_id:
        query = query.filter(models.Post.stock_id == stock_id)
    if user_id:
        query = query.filter(models.Post.user_id == user_id)
    
    posts = query.order_by(models.Post.created_at.desc()).offset(skip).limit(limit).all()
    return [serialize_post(post, db) for post in posts]


@router.get("/{post_id}", response_model=schemas.PostResponse)
def get_post(post_id: int, db: Session = Depends(get_db)):
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    return serialize_post(post, db)


@router.delete("/{post_id}")
def delete_post(
    post_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    db.delete(post)
    db.commit()
    return {"message": "Post deleted"}


@router.post("/{post_id}/like")
def like_post(
    post_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # 既にいいねしているかチェック
    existing_like = db.query(models.Like).filter(
        models.Like.user_id == current_user.id,
        models.Like.post_id == post_id
    ).first()
    
    if existing_like:
        db.delete(existing_like)
        db.commit()
        return {"message": "Like removed"}
    else:
        like = models.Like(user_id=current_user.id, post_id=post_id)
        db.add(like)
        db.commit()
        return {"message": "Post liked"}


@router.post("/{post_id}/retweet")
def retweet_post(
    post_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # 既にリツイートしているかチェック
    existing_retweet = db.query(models.Retweet).filter(
        models.Retweet.user_id == current_user.id,
        models.Retweet.post_id == post_id
    ).first()
    
    if existing_retweet:
        db.delete(existing_retweet)
        db.commit()
        return {"message": "Retweet removed"}
    else:
        retweet = models.Retweet(user_id=current_user.id, post_id=post_id)
        db.add(retweet)
        db.commit()
        return {"message": "Post retweeted"}


# Comment endpoints
@router.post("/{post_id}/comments", response_model=schemas.CommentResponse)
def create_comment(
    post_id: int,
    comment: schemas.CommentCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 投稿が存在するかチェック
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # コメント作成
    db_comment = models.Comment(
        user_id=current_user.id,
        post_id=post_id,
        text=comment.text,
    )
    db.add(db_comment)
    db.commit()
    db.refresh(db_comment)
    
    # リレーションを読み込む
    db.refresh(db_comment, ["user"])
    
    return schemas.CommentResponse(
        id=db_comment.id,
        user_id=db_comment.user_id,
        post_id=db_comment.post_id,
        text=db_comment.text,
        created_at=db_comment.created_at,
        updated_at=db_comment.updated_at,
        user=schemas.UserResponse.model_validate(db_comment.user),
    )


@router.get("/{post_id}/comments", response_model=List[schemas.CommentResponse])
def get_comments(
    post_id: int,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    # 投稿が存在するかチェック
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # コメント一覧取得
    comments = db.query(models.Comment).filter(
        models.Comment.post_id == post_id
    ).order_by(models.Comment.created_at.asc()).offset(skip).limit(limit).all()
    
    result = []
    for comment in comments:
        db.refresh(comment, ["user"])
        result.append(schemas.CommentResponse(
            id=comment.id,
            user_id=comment.user_id,
            post_id=comment.post_id,
            text=comment.text,
            created_at=comment.created_at,
            updated_at=comment.updated_at,
            user=schemas.UserResponse.model_validate(comment.user),
        ))
    
    return result


@router.put("/{post_id}/comments/{comment_id}", response_model=schemas.CommentResponse)
def update_comment(
    post_id: int,
    comment_id: int,
    comment: schemas.CommentCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # コメントが存在するかチェック
    db_comment = db.query(models.Comment).filter(
        models.Comment.id == comment_id,
        models.Comment.post_id == post_id
    ).first()
    
    if not db_comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    # 自分のコメントのみ編集可能
    if db_comment.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # コメント更新
    db_comment.text = comment.text
    db.commit()
    db.refresh(db_comment)
    db.refresh(db_comment, ["user"])
    
    return schemas.CommentResponse(
        id=db_comment.id,
        user_id=db_comment.user_id,
        post_id=db_comment.post_id,
        text=db_comment.text,
        created_at=db_comment.created_at,
        updated_at=db_comment.updated_at,
        user=schemas.UserResponse.model_validate(db_comment.user),
    )


@router.delete("/{post_id}/comments/{comment_id}")
def delete_comment(
    post_id: int,
    comment_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # コメントが存在するかチェック
    db_comment = db.query(models.Comment).filter(
        models.Comment.id == comment_id,
        models.Comment.post_id == post_id
    ).first()
    
    if not db_comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    # 自分のコメントのみ削除可能
    if db_comment.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    db.delete(db_comment)
    db.commit()
    return {"message": "Comment deleted"}


@router.post("/bot/publish", response_model=schemas.PostResponse)
def publish_bot_post(
    payload: schemas.BotPostCreate,
    x_bot_key: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    enforce_bot_key(x_bot_key)
    bot_user = get_bot_user(db)

    stock = None
    if payload.stock_symbol:
        stock = db.query(models.Stock).filter(models.Stock.symbol == payload.stock_symbol).first()
        if not stock:
            raise HTTPException(status_code=404, detail="Stock not found")

    text = payload.text
    if payload.event and stock:
        text = f"[{payload.event}] {stock.name}({stock.symbol}) {payload.text}"

    db_post = models.Post(
        user_id=bot_user.id,
        text=text,
        post_type="bot",
        stock_id=stock.id if stock else None,
        chart_image_url=payload.chart_image_url,
    )
    db.add(db_post)
    db.commit()
    db.refresh(db_post)

    return serialize_post(db_post, db)


@router.post("/bot/summary", response_model=schemas.PostResponse)
def publish_market_summary(
    x_bot_key: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    enforce_bot_key(x_bot_key)
    bot_user = get_bot_user(db)

    top_gainer = (
        db.query(models.Stock)
        .filter(models.Stock.change_pct.isnot(None))
        .order_by(models.Stock.change_pct.desc())
        .first()
    )
    top_loser = (
        db.query(models.Stock)
        .filter(models.Stock.change_pct.isnot(None))
        .order_by(models.Stock.change_pct.asc())
        .first()
    )

    if not top_gainer:
        raise HTTPException(status_code=404, detail="No stocks available")

    summary_lines = ["📊 今日のマーケットダイジェスト"]
    summary_lines.append(
        f"📈 {top_gainer.name}({top_gainer.symbol}) {top_gainer.change_pct:.2f}% / ¥{top_gainer.price:,.0f}"
    )

    if top_loser and top_loser.id != top_gainer.id:
        summary_lines.append(
            f"📉 {top_loser.name}({top_loser.symbol}) {top_loser.change_pct:.2f}% / ¥{top_loser.price:,.0f}"
        )

    text = "\n".join(summary_lines)

    db_post = models.Post(
        user_id=bot_user.id,
        text=text,
        post_type="bot",
        stock_id=top_gainer.id,
    )
    db.add(db_post)
    db.commit()
    db.refresh(db_post)

    return serialize_post(db_post, db)


def serialize_post(post: models.Post, db: Session) -> schemas.PostResponse:
    db.refresh(post, ["user", "stock"])

    likes_count = db.query(func.count(models.Like.id)).filter(
        models.Like.post_id == post.id
    ).scalar() or 0
    retweets_count = db.query(func.count(models.Retweet.id)).filter(
        models.Retweet.post_id == post.id
    ).scalar() or 0
    comments_count = db.query(func.count(models.Comment.id)).filter(
        models.Comment.post_id == post.id
    ).scalar() or 0

    return schemas.PostResponse(
        id=post.id,
        user_id=post.user_id,
        text=post.text,
        post_type=post.post_type,
        stock_id=post.stock_id,
        chart_image_url=post.chart_image_url,
        created_at=post.created_at,
        user=schemas.UserResponse.model_validate(post.user),
        stock=schemas.StockResponse.model_validate(post.stock) if post.stock else None,
        likes_count=likes_count,
        retweets_count=retweets_count,
        comments_count=comments_count,
    )


def enforce_bot_key(header_value: Optional[str]):
    if BOT_API_KEY and header_value != BOT_API_KEY:
        raise HTTPException(status_code=403, detail="Invalid bot key")


def get_bot_user(db: Session) -> models.User:
    if not BOT_USER_ID:
        raise HTTPException(status_code=500, detail="BOT_USER_ID is not configured")
    try:
        bot_id = int(BOT_USER_ID)
    except ValueError:
        raise HTTPException(status_code=500, detail="BOT_USER_ID must be an integer")
    bot_user = db.query(models.User).filter(models.User.id == bot_id).first()
    if not bot_user:
        raise HTTPException(status_code=404, detail="Bot user not found")
    return bot_user
