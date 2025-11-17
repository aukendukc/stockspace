"""
APIテストスクリプト
バックエンドAPIが正常に動作するかテストします
"""
import requests
import json

BASE_URL = "http://localhost:8000"

def test_home():
    """ホームエンドポイントのテスト"""
    print("=== ホームエンドポイントのテスト ===")
    response = requests.get(f"{BASE_URL}/")
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
    print()

def test_register():
    """ユーザー登録のテスト"""
    print("=== ユーザー登録のテスト ===")
    user_data = {
        "email": "test@example.com",
        "username": "testuser",
        "name": "テストユーザー",
        "handle": "@testuser",
        "password": "test123",
        "bio": "テスト用のユーザーです"
    }
    response = requests.post(f"{BASE_URL}/auth/register", json=user_data)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        print(f"User created: {response.json()}")
        return response.json()
    else:
        print(f"Error: {response.text}")
    print()
    return None

def test_login():
    """ログインのテスト"""
    print("=== ログインのテスト ===")
    login_data = {
        "username": "test@example.com",  # email or username
        "password": "test123"
    }
    response = requests.post(
        f"{BASE_URL}/auth/token",
        data=login_data,
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        token_data = response.json()
        print(f"Token received: {token_data['access_token'][:20]}...")
        return token_data["access_token"]
    else:
        print(f"Error: {response.text}")
    print()
    return None

def test_get_me(token):
    """現在のユーザー情報取得のテスト"""
    print("=== 現在のユーザー情報取得のテスト ===")
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(f"{BASE_URL}/auth/me", headers=headers)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        print(f"User info: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
    else:
        print(f"Error: {response.text}")
    print()

def test_create_stock(token):
    """銘柄作成のテスト"""
    print("=== 銘柄作成のテスト ===")
    stock_data = {
        "symbol": "7203",
        "name": "トヨタ自動車",
        "price": 3500.0,
        "change": 50.0,
        "change_pct": 1.45,
        "high": 3600.0,
        "low": 3400.0,
        "per": 12.5,
        "pbr": 1.2,
        "dividend_yield": 2.5,
        "dividend_payout_ratio": 30.0,
        "market_cap": 25000000000000.0,
        "revenue": 35000000000000.0,
        "profit": 2800000000000.0
    }
    response = requests.post(f"{BASE_URL}/stocks", json=stock_data)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        print(f"Stock created: {response.json()}")
    else:
        print(f"Error: {response.text}")
    print()

def test_get_stocks():
    """銘柄一覧取得のテスト"""
    print("=== 銘柄一覧取得のテスト ===")
    response = requests.get(f"{BASE_URL}/stocks")
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        stocks = response.json()
        print(f"Found {len(stocks)} stocks")
        if stocks:
            print(f"First stock: {stocks[0]}")
    else:
        print(f"Error: {response.text}")
    print()

def test_create_post(token):
    """投稿作成のテスト"""
    print("=== 投稿作成のテスト ===")
    post_data = {
        "text": "トヨタの決算が良さそう。長期保有を続けます。",
        "post_type": "user",
        "stock_id": 1
    }
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.post(f"{BASE_URL}/posts", json=post_data, headers=headers)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        print(f"Post created: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
        return response.json()
    else:
        print(f"Error: {response.text}")
    print()
    return None

def test_get_posts():
    """投稿一覧取得のテスト"""
    print("=== 投稿一覧取得のテスト ===")
    response = requests.get(f"{BASE_URL}/posts")
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        posts = response.json()
        print(f"Found {len(posts)} posts")
        if posts:
            print(f"First post: {json.dumps(posts[0], indent=2, ensure_ascii=False)}")
    else:
        print(f"Error: {response.text}")
    print()

def test_create_portfolio(token):
    """ポートフォリオ作成のテスト"""
    print("=== ポートフォリオ作成のテスト ===")
    portfolio_data = {
        "name": "メインポートフォリオ",
        "is_public": False,
        "holdings": [
            {
                "stock_id": 1,
                "shares": 10.0,
                "purchase_price": 3400.0
            }
        ]
    }
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.post(f"{BASE_URL}/portfolios", json=portfolio_data, headers=headers)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        print(f"Portfolio created: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
    else:
        print(f"Error: {response.text}")
    print()

def main():
    print("=" * 50)
    print("StockSpace API テスト開始")
    print("=" * 50)
    print()
    
    try:
        # 1. ホームエンドポイント
        test_home()
        
        # 2. ユーザー登録
        user = test_register()
        
        # 3. ログイン
        token = test_login()
        if not token:
            print("ログインに失敗しました。テストを終了します。")
            return
        
        # 4. 現在のユーザー情報取得
        test_get_me(token)
        
        # 5. 銘柄作成
        test_create_stock(token)
        
        # 6. 銘柄一覧取得
        test_get_stocks()
        
        # 7. 投稿作成
        test_create_post(token)
        
        # 8. 投稿一覧取得
        test_get_posts()
        
        # 9. ポートフォリオ作成
        test_create_portfolio(token)
        
        print("=" * 50)
        print("すべてのテストが完了しました！")
        print("=" * 50)
        print()
        print("APIドキュメント: http://localhost:8000/docs")
        print("ReDoc: http://localhost:8000/redoc")
        
    except requests.exceptions.ConnectionError:
        print("エラー: サーバーに接続できません。")
        print("バックエンドサーバーが起動しているか確認してください。")
        print("起動コマンド: uvicorn main:app --reload")
    except Exception as e:
        print(f"エラーが発生しました: {e}")

if __name__ == "__main__":
    main()


