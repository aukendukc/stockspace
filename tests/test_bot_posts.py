import os

os.environ["DATABASE_URL"] = "sqlite:///./test_bot.db"
os.environ["AUTO_CREATE_TABLES"] = "true"
os.environ["BOT_USER_ID"] = "1"
os.environ["BOT_API_KEY"] = "test-key"

import pytest
from fastapi.testclient import TestClient
from backend.database import Base, engine, SessionLocal
from backend import models
from backend.auth import get_password_hash
from main import app


client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_database():
  Base.metadata.drop_all(bind=engine)
  Base.metadata.create_all(bind=engine)

  db = SessionLocal()
  bot_user = models.User(
      email="bot@example.com",
      username="bot",
      name="マーケットBot",
      handle="@market_bot",
      hashed_password=get_password_hash("secret"),
  )
  db.add(bot_user)
  db.flush()

  stock = models.Stock(
      symbol="7203",
      name="トヨタ自動車",
      price=3500,
      change=50,
      change_pct=1.5,
  )
  db.add(stock)
  db.commit()
  db.close()

  yield

  Base.metadata.drop_all(bind=engine)


def test_bot_publish_requires_key():
  response = client.post(
      "/posts/bot/publish",
      json={"text": "テスト投稿", "stock_symbol": "7203"},
      headers={"X-Bot-Key": "invalid"},
  )
  assert response.status_code == 403


def test_bot_publish_creates_post():
  response = client.post(
      "/posts/bot/publish",
      json={
          "text": "決算速報: 売上が市場予想を上回りました。",
          "stock_symbol": "7203",
          "event": "Earnings",
      },
      headers={"X-Bot-Key": "test-key"},
  )
  assert response.status_code == 200
  data = response.json()
  assert data["post_type"] == "bot"
  assert "決算速報" in data["text"]
  assert data["stock"]["symbol"] == "7203"


def test_bot_summary_uses_top_gainer():
  response = client.post("/posts/bot/summary", headers={"X-Bot-Key": "test-key"})
  assert response.status_code == 200
  data = response.json()
  assert data["post_type"] == "bot"
  assert "トヨタ自動車" in data["text"]

