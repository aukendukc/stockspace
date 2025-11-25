FROM python:3.11-slim

WORKDIR /app

# システム依存関係
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# 依存関係インストール
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# アプリケーションコードコピー
COPY . .

# ポート公開
EXPOSE 8080

# 環境変数設定
ENV PYTHONUNBUFFERED=1

# 起動コマンド（Azure App ServiceのPORT環境変数を使用）
# PORT環境変数が設定されていない場合は8080を使用
CMD sh -c "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}"




