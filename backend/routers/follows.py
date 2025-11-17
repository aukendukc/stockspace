from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import SessionLocal
from backend import models, schemas
from backend.auth import get_current_user

router = APIRouter(prefix="/follows", tags=["follows"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("", response_model=schemas.FollowResponse)
def follow_user(
    follow: schemas.FollowCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 自分自身をフォローできない
    if follow.following_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")
    
    # フォロー対象のユーザーが存在するかチェック
    following_user = db.query(models.User).filter(models.User.id == follow.following_id).first()
    if not following_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # 既にフォローしているかチェック
    existing_follow = db.query(models.Follow).filter(
        models.Follow.follower_id == current_user.id,
        models.Follow.following_id == follow.following_id
    ).first()
    
    if existing_follow:
        raise HTTPException(status_code=400, detail="Already following this user")
    
    db_follow = models.Follow(
        follower_id=current_user.id,
        following_id=follow.following_id,
    )
    db.add(db_follow)
    db.commit()
    db.refresh(db_follow)
    return db_follow


@router.delete("/{following_id}")
def unfollow_user(
    following_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    follow = db.query(models.Follow).filter(
        models.Follow.follower_id == current_user.id,
        models.Follow.following_id == following_id
    ).first()
    
    if not follow:
        raise HTTPException(status_code=404, detail="Follow relationship not found")
    
    db.delete(follow)
    db.commit()
    return {"message": "Unfollowed user"}


@router.get("/following", response_model=List[schemas.UserResponse])
def get_following(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    follows = db.query(models.Follow).filter(models.Follow.follower_id == current_user.id).all()
    following_ids = [f.following_id for f in follows]
    users = db.query(models.User).filter(models.User.id.in_(following_ids)).all()
    return users


@router.get("/followers", response_model=List[schemas.UserResponse])
def get_followers(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    follows = db.query(models.Follow).filter(models.Follow.following_id == current_user.id).all()
    follower_ids = [f.follower_id for f in follows]
    users = db.query(models.User).filter(models.User.id.in_(follower_ids)).all()
    return users

