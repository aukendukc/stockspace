from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.database import SessionLocal
from backend import models, schemas
from backend.auth import get_current_user

router = APIRouter(prefix="/posts", tags=["posts"])


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
    
    # リレーションを読み込む
    db.refresh(db_post, ["user", "stock"])
    
    # カウントを取得
    likes_count = db.query(func.count(models.Like.id)).filter(
        models.Like.post_id == db_post.id
    ).scalar() or 0
    retweets_count = db.query(func.count(models.Retweet.id)).filter(
        models.Retweet.post_id == db_post.id
    ).scalar() or 0
    comments_count = db.query(func.count(models.Comment.id)).filter(
        models.Comment.post_id == db_post.id
    ).scalar() or 0
    
    response = schemas.PostResponse(
        id=db_post.id,
        user_id=db_post.user_id,
        text=db_post.text,
        post_type=db_post.post_type,
        stock_id=db_post.stock_id,
        chart_image_url=db_post.chart_image_url,
        created_at=db_post.created_at,
        user=schemas.UserResponse.model_validate(db_post.user),
        stock=schemas.StockResponse.model_validate(db_post.stock) if db_post.stock else None,
        likes_count=likes_count,
        retweets_count=retweets_count,
        comments_count=comments_count,
    )
    return response


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
    
    result = []
    for post in posts:
        likes_count = db.query(func.count(models.Like.id)).filter(
            models.Like.post_id == post.id
        ).scalar() or 0
        retweets_count = db.query(func.count(models.Retweet.id)).filter(
            models.Retweet.post_id == post.id
        ).scalar() or 0
        comments_count = db.query(func.count(models.Comment.id)).filter(
            models.Comment.post_id == post.id
        ).scalar() or 0
        
        result.append(schemas.PostResponse(
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
        ))
    
    return result


@router.get("/{post_id}", response_model=schemas.PostResponse)
def get_post(post_id: int, db: Session = Depends(get_db)):
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
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
