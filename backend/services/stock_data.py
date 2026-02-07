"""
Utility functions to fetch up-to-date stock metrics from external data sources.
Primary: Yahoo Finance API (yfinance)
Secondary: J-Quants API (無料版 - 約12週間遅延あり)

Symbols comprised only of digits are assumed to be listed on the Tokyo Stock Exchange.

Includes caching to reduce API calls and avoid rate limiting.
"""

from __future__ import annotations

from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import time
import logging
import os
import requests

import yfinance as yf

logger = logging.getLogger(__name__)

# Simple in-memory cache for stock data
_stock_cache: Dict[str, Dict[str, Any]] = {}
_cache_expiry: Dict[str, datetime] = {}
_CACHE_DURATION = timedelta(minutes=5)  # Cache for 5 minutes

# Listed stocks cache (J-Quants)
_listed_cache: List[Dict[str, Any]] = []
_listed_cache_expiry: Optional[datetime] = None
_LISTED_CACHE_DURATION = timedelta(hours=24)

# Market movers cache (J-Quants)
_market_movers_cache: Dict[str, Any] | None = None
_market_movers_expiry: Optional[datetime] = None
_MARKET_MOVERS_CACHE_DURATION = timedelta(minutes=30)

# Rate limiting
_last_request_time: float = 0
_MIN_REQUEST_INTERVAL = 1.0  # Minimum seconds between requests

# J-Quants API設定
JQUANTS_REFRESH_TOKEN = os.getenv("JQUANTS_REFRESH_TOKEN", "3bDp08T0tEKybd_1uIjjGHQXgweR65h3FaAZ2c8ZFJM")
JQUANTS_BASE_URL = "https://api.jquants.com/v1"
_jquants_id_token: Optional[str] = None
_jquants_token_expiry: Optional[datetime] = None

# 日本語銘柄名マッピング（Yahoo Financeは英語名のみのため）
_JAPANESE_STOCK_NAMES: Dict[str, str] = {
    "7203": "トヨタ自動車",
    "6758": "ソニーグループ",
    "9984": "ソフトバンクグループ",
    "9434": "ソフトバンク",
    "6861": "キーエンス",
    "9983": "ファーストリテイリング",
    "8035": "東京エレクトロン",
    "4063": "信越化学工業",
    "8267": "イオン",
    "4503": "アステラス製薬",
    "6501": "日立製作所",
    "6902": "デンソー",
    "7267": "本田技研工業",
    "7974": "任天堂",
    "8306": "三菱UFJフィナンシャル・グループ",
    "8316": "三井住友フィナンシャルグループ",
    "8411": "みずほフィナンシャルグループ",
    "9432": "日本電信電話",
    "9433": "KDDI",
    "2914": "日本たばこ産業",
    "4502": "武田薬品工業",
    "6954": "ファナック",
    "6367": "ダイキン工業",
    "6098": "リクルートホールディングス",
    "4661": "オリエンタルランド",
    "6273": "SMC",
    "6594": "日本電産",
    "8766": "東京海上ホールディングス",
    "4568": "第一三共",
    "6981": "村田製作所",
    "6857": "アドバンテスト",
    "4519": "中外製薬",
    "8801": "三井不動産",
    "6723": "ルネサスエレクトロニクス",
    "7751": "キヤノン",
    "6971": "京セラ",
    "6702": "富士通",
    "3382": "セブン&アイ・ホールディングス",
    "2802": "味の素",
    "9020": "東日本旅客鉄道",
}

# モックデータは削除 - 常にYahoo Finance APIからリアルタイムデータを取得


def _get_japanese_stock_name(symbol: str, english_name: str) -> str:
    """日本語の銘柄名を取得。マッピングにあれば日本語名を、なければ英語名を返す。"""
    cleaned = _clean_symbol(symbol)
    return _JAPANESE_STOCK_NAMES.get(cleaned, english_name)


# ===========================================
# J-Quants API Functions
# ===========================================

def _get_jquants_token() -> Optional[str]:
    """
    J-Quants APIのIDトークンを取得。
    リフレッシュトークンを使ってIDトークンを取得します。
    トークンは約24時間有効です。
    """
    global _jquants_id_token, _jquants_token_expiry
    
    # 有効なトークンがあればそれを返す
    if _jquants_id_token and _jquants_token_expiry and datetime.now() < _jquants_token_expiry:
        return _jquants_id_token
    
    if not JQUANTS_REFRESH_TOKEN:
        logger.warning("J-Quants refresh token not configured")
        return None
    
    try:
        # リフレッシュトークンでIDトークンを取得
        response = requests.post(
            f"{JQUANTS_BASE_URL}/token/auth_refresh",
            params={"refreshtoken": JQUANTS_REFRESH_TOKEN},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            _jquants_id_token = data.get("idToken")
            # トークンは約24時間有効だが、余裕を持って23時間で期限切れとする
            _jquants_token_expiry = datetime.now() + timedelta(hours=23)
            logger.info("J-Quants IDトークンを取得しました")
            return _jquants_id_token
        else:
            logger.error(f"J-Quants token refresh failed: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        logger.error(f"J-Quants token refresh error: {e}")
        return None


def _fetch_jquants_daily_quotes(symbol: str, from_date: Optional[str] = None, to_date: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    J-Quants APIから株価データを取得。
    無料プランは約12週間のデータ遅延があることに注意。
    
    Args:
        symbol: 銘柄コード (例: "7203")
        from_date: 開始日 (YYYY-MM-DD形式)
        to_date: 終了日 (YYYY-MM-DD形式)
    """
    token = _get_jquants_token()
    if not token:
        return None
    
    try:
        # 日付指定がなければ過去30日分を取得
        if not to_date:
            # 無料版は約12週間遅延があるため、12週間前のデータを取得
            to_date = (datetime.now() - timedelta(weeks=12)).strftime("%Y-%m-%d")
        if not from_date:
            from_date = (datetime.strptime(to_date, "%Y-%m-%d") - timedelta(days=30)).strftime("%Y-%m-%d")
        
        params = {
            "code": symbol,
            "from": from_date,
            "to": to_date,
        }
        
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.get(
            f"{JQUANTS_BASE_URL}/prices/daily_quotes",
            params=params,
            headers=headers,
            timeout=15
        )
        
        if response.status_code == 200:
            data = response.json()
            quotes = data.get("daily_quotes", [])
            if quotes:
                # 日付順に並べ替え
                quotes_sorted = sorted(
                    quotes, key=lambda q: q.get("Date") or q.get("date") or ""
                )
                latest = quotes_sorted[-1]
                previous = quotes_sorted[-2] if len(quotes_sorted) >= 2 else None
                latest_close = _safe_float(latest.get("Close") or latest.get("AdjustmentClose"))
                prev_close = _safe_float(
                    (previous or {}).get("Close")
                    or (previous or {}).get("AdjustmentClose")
                    or latest.get("PreviousClose")
                )
                change = change_pct = None
                if latest_close is not None and prev_close:
                    change = latest_close - prev_close
                    if prev_close != 0:
                        change_pct = (change / prev_close) * 100

                # 直近7本の履歴
                recent = quotes_sorted[-7:]
                price_history = []
                price_history_labels = []
                for q in recent:
                    close = _safe_float(q.get("Close") or q.get("AdjustmentClose"))
                    if close is None:
                        continue
                    price_history.append(close)
                    price_history_labels.append(str((q.get("Date") or q.get("date") or ""))[:10])

                return {
                    "symbol": symbol,
                    "name": latest.get("CompanyName", symbol),
                    "price": latest_close,
                    "previous_close": prev_close,
                    "change": change,
                    "change_pct": change_pct,
                    "high": _safe_float(latest.get("High")),
                    "low": _safe_float(latest.get("Low")),
                    "volume": latest.get("Volume"),
                    "date": latest.get("Date"),
                    "price_history": price_history,
                    "price_history_labels": price_history_labels,
                }
            return None
        else:
            logger.warning(f"J-Quants API error for {symbol}: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        logger.error(f"J-Quants fetch error for {symbol}: {e}")
        return None


def _fetch_jquants_listed_info(symbol: str) -> Optional[Dict[str, Any]]:
    """
    J-Quants APIから銘柄情報を取得。
    """
    token = _get_jquants_token()
    if not token:
        return None
    
    try:
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(
            f"{JQUANTS_BASE_URL}/listed/info",
            params={"code": symbol},
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            info_list = data.get("info", [])
            if info_list:
                info = info_list[0]
                return {
                    "symbol": symbol,
                    "name": info.get("CompanyName", symbol),
                    "market": info.get("MarketCode"),
                    "sector": info.get("Sector17Code"),
                    "industry": info.get("Sector33Code"),
                }
        return None
    except Exception as e:
        logger.error(f"J-Quants listed info error for {symbol}: {e}")
        return None


def _fetch_jquants_listed_all() -> List[Dict[str, Any]]:
    """
    J-Quants APIから全上場銘柄のリストを取得。
    pagination_key などがある場合は追跡して取得。
    """
    token = _get_jquants_token()
    if not token:
        return []

    headers = {"Authorization": f"Bearer {token}"}
    results: List[Dict[str, Any]] = []
    pagination_key: Optional[str] = None

    try:
        for _ in range(500):  # 安全のためページ数を制限（全銘柄取得のため拡大）
            params: Dict[str, Any] = {}
            if pagination_key:
                params["pagination_key"] = pagination_key

            response = requests.get(
                f"{JQUANTS_BASE_URL}/listed/info",
                params=params,
                headers=headers,
                timeout=20,
            )

            if response.status_code != 200:
                logger.warning(
                    f"J-Quants listed info fetch failed: {response.status_code} - {response.text}"
                )
                break

            data = response.json()
            info_list = data.get("info") or []
            if info_list:
                results.extend(info_list)

            pagination_key = (
                data.get("pagination_key")
                or data.get("next_token")
                or data.get("nextPageToken")
            )
            if not pagination_key:
                break
    except Exception as e:
        logger.error(f"J-Quants listed info list error: {e}")

    return results


def _fetch_jquants_statements(symbol: str) -> Optional[Dict[str, Any]]:
    """
    J-Quants APIから財務情報を取得。
    """
    token = _get_jquants_token()
    if not token:
        return None
    
    try:
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(
            f"{JQUANTS_BASE_URL}/fins/statements",
            params={"code": symbol},
            headers=headers,
            timeout=15
        )
        
        if response.status_code == 200:
            data = response.json()
            statements = data.get("statements", [])
            if statements:
                def _statement_date(stmt: Dict[str, Any]) -> str:
                    return (
                        stmt.get("DisclosedDate")
                        or stmt.get("DisclosedDateJP")
                        or stmt.get("DisclosedDateJp")
                        or stmt.get("Date")
                        or ""
                    )

                statements_sorted = sorted(statements, key=_statement_date)
                latest = statements_sorted[-1]
                history = statements_sorted[-6:]

                revenue_history = []
                profit_history = []
                dividend_history = []
                dividend_labels = []
                for stmt in history:
                    revenue_history.append(_safe_float(stmt.get("NetSales")))
                    profit_history.append(_safe_float(stmt.get("NetIncome")))
                    div = _safe_float(stmt.get("DividendPerShare"))
                    if div is not None:
                        dividend_history.append(div)
                    label_date = _statement_date(stmt)
                    if label_date:
                        dividend_labels.append(label_date[:4])

                return {
                    "revenue": _safe_float(latest.get("NetSales")),
                    "profit": _safe_float(latest.get("NetIncome")),
                    "eps": _safe_float(latest.get("EarningsPerShare")),
                    "bps": _safe_float(latest.get("BookValuePerShare")),
                    "revenue_history": [v for v in revenue_history if v is not None],
                    "profit_history": [v for v in profit_history if v is not None],
                    "dividend_history": dividend_history,
                    "dividend_labels": dividend_labels,
                }
        return None
    except Exception as e:
        logger.error(f"J-Quants statements error for {symbol}: {e}")
        return None


# ===========================================
# Common Utility Functions
# ===========================================

def _normalize_symbol(symbol: str) -> str:
    """Convert local symbols to yfinance format."""
    cleaned = symbol.strip().upper()
    if cleaned.isdigit():
        return f"{cleaned}.T"
    return cleaned


def _clean_symbol(symbol: str) -> str:
    """Get clean symbol without exchange suffix."""
    return symbol.strip().upper().replace(".T", "")


def _get_cached_data(symbol: str) -> Dict[str, Any] | None:
    """Get cached data if available and not expired."""
    cleaned = _clean_symbol(symbol)
    if cleaned in _stock_cache:
        if datetime.now() < _cache_expiry.get(cleaned, datetime.min):
            logger.debug(f"Cache hit for {cleaned}")
            return _stock_cache[cleaned]
    return None


def _set_cache(symbol: str, data: Dict[str, Any]) -> None:
    """Cache stock data."""
    cleaned = _clean_symbol(symbol)
    _stock_cache[cleaned] = data
    _cache_expiry[cleaned] = datetime.now() + _CACHE_DURATION


def _normalize_listed_item(info: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    symbol = str(
        info.get("Code")
        or info.get("code")
        or info.get("symbol")
        or info.get("Symbol")
        or ""
    ).strip()
    if not symbol:
        return None
    cleaned = _clean_symbol(symbol)
    name = (
        info.get("CompanyName")
        or info.get("Name")
        or info.get("name")
        or cleaned
    )
    name_en = (
        info.get("CompanyNameEnglish")
        or info.get("NameEnglish")
        or info.get("name_en")
        or ""
    )
    market = info.get("MarketName") or info.get("market") or info.get("MarketCode")
    return {"symbol": cleaned, "name": name, "name_en": name_en, "market": market}


def get_listed_stocks(search: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    J-Quantsの上場銘柄リストをキャッシュ付きで取得。
    searchがある場合は銘柄コードまたは会社名で部分一致検索。
    """
    global _listed_cache, _listed_cache_expiry

    if not _listed_cache or not _listed_cache_expiry or datetime.now() >= _listed_cache_expiry:
        listed_raw = _fetch_jquants_listed_all()
        normalized: List[Dict[str, Any]] = []
        for item in listed_raw:
            normalized_item = _normalize_listed_item(item)
            if normalized_item:
                normalized.append(normalized_item)
        _listed_cache = normalized
        _listed_cache_expiry = datetime.now() + _LISTED_CACHE_DURATION

    if not search:
        return _listed_cache

    def _normalize_query(value: str) -> str:
        # Lowercase and remove spaces (including full-width) and common company suffixes.
        normalized = value.strip().lower()
        normalized = normalized.replace(" ", "").replace("　", "")
        for suffix in (
            "株式会社",
            "（株）",
            "(株)",
            "有限会社",
            "合同会社",
            "ホールディングス",
            "hd",
            "hldgs",
            "co.,ltd.",
            "co., ltd.",
            "ltd.",
            "inc.",
            "corp.",
            "corporation",
            "holdings",
        ):
            normalized = normalized.replace(suffix, "")
        return normalized

    def _to_katakana(value: str) -> str:
        # Hiragana to Katakana
        return "".join(
            chr(ord(ch) + 0x60) if 0x3041 <= ord(ch) <= 0x3096 else ch
            for ch in value
        )

    def _to_hiragana(value: str) -> str:
        # Katakana to Hiragana
        return "".join(
            chr(ord(ch) - 0x60) if 0x30A1 <= ord(ch) <= 0x30F6 else ch
            for ch in value
        )

    query = _normalize_query(search)
    if not query:
        return _listed_cache
    query_variants = {
        query,
        _to_katakana(query),
        _to_hiragana(query),
    }

    return [
        item
        for item in _listed_cache
        if any(q in _normalize_query(item.get("symbol", "")) for q in query_variants)
        or any(q in _normalize_query(str(item.get("name", ""))) for q in query_variants)
        or any(q in _normalize_query(str(item.get("name_en", ""))) for q in query_variants)
    ]


def _rate_limit_wait() -> None:
    """Wait if needed to respect rate limits."""
    global _last_request_time
    elapsed = time.time() - _last_request_time
    if elapsed < _MIN_REQUEST_INTERVAL:
        time.sleep(_MIN_REQUEST_INTERVAL - elapsed)
    _last_request_time = time.time()


def _fetch_jquants_daily_quotes_all(target_date: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    J-Quants APIから指定日の全銘柄の日次株価を取得（無料プランは約12週間遅延）。
    """
    token = _get_jquants_token()
    if not token:
        return []

    if not target_date:
        target_date = (datetime.now() - timedelta(weeks=12)).strftime("%Y-%m-%d")

    headers = {"Authorization": f"Bearer {token}"}
    results: List[Dict[str, Any]] = []
    pagination_key: Optional[str] = None

    try:
        for _ in range(200):  # 安全のためページ数を制限
            params: Dict[str, Any] = {
                "from": target_date,
                "to": target_date,
            }
            if pagination_key:
                params["pagination_key"] = pagination_key

            response = requests.get(
                f"{JQUANTS_BASE_URL}/prices/daily_quotes",
                params=params,
                headers=headers,
                timeout=30,
            )

            if response.status_code != 200:
                logger.warning(
                    f"J-Quants daily quotes fetch failed: {response.status_code} - {response.text}"
                )
                break

            data = response.json()
            quotes = data.get("daily_quotes") or []
            if quotes:
                results.extend(quotes)

            pagination_key = (
                data.get("pagination_key")
                or data.get("next_token")
                or data.get("nextPageToken")
            )
            if not pagination_key:
                break
    except Exception as e:
        logger.error(f"J-Quants daily quotes list error: {e}")

    return results


def get_market_movers_all(limit: int = 20) -> Dict[str, List[Dict[str, Any]]]:
    """
    全銘柄ベースの値上がり/値下がりランキングを取得（J-Quants遅延データ）。
    """
    global _market_movers_cache, _market_movers_expiry
    if _market_movers_cache and _market_movers_expiry and datetime.now() < _market_movers_expiry:
        return _market_movers_cache

    quotes = _fetch_jquants_daily_quotes_all()
    entries: List[Dict[str, Any]] = []

    for quote in quotes:
        symbol = str(
            quote.get("Code")
            or quote.get("code")
            or quote.get("Symbol")
            or quote.get("symbol")
            or ""
        ).strip()
        if not symbol:
            continue

        price = _safe_float(quote.get("Close") or quote.get("AdjustmentClose")) or 0.0
        prev = _safe_float(
            quote.get("PreviousClose")
            or quote.get("PreviousClosePrice")
            or quote.get("PreviousCloseValue")
        )
        change = _safe_float(quote.get("Change"))
        change_pct = _safe_float(
            quote.get("ChangePercentage")
            or quote.get("ChangePercent")
            or quote.get("ChangePct")
            or quote.get("ChangeRate")
        )

        if change is None and price is not None and prev:
            change = price - prev
        if change_pct is None and price is not None and prev:
            if prev != 0:
                change_pct = ((price - prev) / prev) * 100

        entries.append(
            {
                "symbol": symbol,
                "name": quote.get("CompanyName") or symbol,
                "price": float(price),
                "change": float(change or 0.0),
                "change_pct": float(change_pct or 0.0),
            }
        )

    top_gainers = sorted(entries, key=lambda item: item["change_pct"], reverse=True)[:limit]
    top_losers = sorted(entries, key=lambda item: item["change_pct"])[:limit]

    _market_movers_cache = {"top_gainers": top_gainers, "top_losers": top_losers}
    _market_movers_expiry = datetime.now() + _MARKET_MOVERS_CACHE_DURATION

    return _market_movers_cache

def _get_mock_data(symbol: str) -> Dict[str, Any] | None:
    """モックデータは使用しない - 常にNoneを返す"""
    # モックデータは削除されました - 常にリアルタイムAPIからデータを取得
    return None


# ===========================================
# Yahoo Finance API Functions (メイン)
# ===========================================

def _fetch_yfinance_data(symbol: str) -> Optional[Dict[str, Any]]:
    """
    Yahoo Finance APIから株価データを取得（メインAPI）。
    日本株の場合は .T サフィックスを付けて取得。
    """
    yf_symbol = _normalize_symbol(symbol)
    cleaned = _clean_symbol(symbol)
    
    try:
        _rate_limit_wait()
        ticker = yf.Ticker(yf_symbol)
        
        fast_info = {}
        info = {}
        
        try:
            fast_info = ticker.fast_info or {}
        except Exception as e:
            logger.warning(f"Failed to get fast_info for {yf_symbol}: {e}")
            error_str = str(e).lower()
            if "rate limit" in error_str or "too many requests" in error_str:
                return None
        
        # 銘柄名を取得するためinfoも取得
        try:
            info = ticker.info or {}
        except Exception as e:
            logger.warning(f"Failed to get info for {yf_symbol}: {e}")
        
        price = _safe_float(
            fast_info.get("last_price")
            or fast_info.get("lastPrice")
            or info.get("currentPrice")
        )
        previous_close = _safe_float(
            fast_info.get("previous_close")
            or fast_info.get("previousClose")
            or info.get("previousClose")
        )
        
        if price is None:
            return None
        
        change = change_pct = None
        if price is not None and previous_close:
            change = price - previous_close
            if previous_close != 0:
                change_pct = (change / previous_close) * 100
        
        # 銘柄名を取得（日本語名があれば優先）
        english_name = info.get("longName") or info.get("shortName") or info.get("name") or cleaned
        stock_name = _get_japanese_stock_name(cleaned, english_name)
        
        return {
            "symbol": cleaned,
            "name": stock_name,
            "name_en": english_name,
            "price": price,
            "previous_close": previous_close,
            "change": change,
            "change_pct": change_pct,
            "high": _safe_float(fast_info.get("day_high") or fast_info.get("dayHigh") or info.get("dayHigh")),
            "low": _safe_float(fast_info.get("day_low") or fast_info.get("dayLow") or info.get("dayLow")),
            "per": _safe_float(info.get("trailingPE")),
            "pbr": _safe_float(info.get("priceToBook")),
            "dividend_yield": _percentage(info.get("dividendYield")),
            "dividend_payout_ratio": _percentage(info.get("payoutRatio")),
            "market_cap": info.get("marketCap"),
            "source": "yahoo_finance",
        }
    except Exception as e:
        logger.warning(f"Yahoo Finance fetch failed for {symbol}: {e}")
        return None


# ===========================================
# Combined Data Fetching (Yahoo Finance + J-Quants)
# ===========================================

def fetch_stock_data(symbols: List[str]) -> Dict[str, Dict[str, Any]]:
    """
    Fetch latest stock metrics for the provided symbols.
    
    優先順位:
    1. キャッシュ
    2. Yahoo Finance API (メイン - リアルタイムデータ)
    3. J-Quants API (サブ - 約12週間遅延)
    4. モックデータ (最後の手段)

    Returns a dict keyed by the original symbol with metrics such as price,
    change, day high/low, etc.
    """
    results: Dict[str, Dict[str, Any]] = {}

    for symbol in symbols:
        cleaned = _clean_symbol(symbol)
        
        # 1. Check cache first
        cached = _get_cached_data(cleaned)
        if cached:
            results[cleaned] = cached
            continue

        # 2. Try Yahoo Finance first (main source - realtime data)
        yf_data = _fetch_yfinance_data(cleaned)
        if yf_data and yf_data.get("price") is not None:
            _set_cache(cleaned, yf_data)
            results[cleaned] = yf_data
            logger.info(f"Got data from Yahoo Finance for {cleaned}")
            continue
        
        # 3. Try J-Quants API (secondary source - delayed data)
        jquants_data = _fetch_jquants_daily_quotes(cleaned)
        if jquants_data and jquants_data.get("price") is not None:
            # J-Quantsから銘柄情報も取得
            jquants_info = _fetch_jquants_listed_info(cleaned)
            if jquants_info:
                jquants_data["name"] = jquants_info.get("name", cleaned)
            jquants_data["source"] = "jquants"
            jquants_data["note"] = "Data delayed by ~12 weeks (J-Quants free plan)"
            _set_cache(cleaned, jquants_data)
            results[cleaned] = jquants_data
            logger.info(f"Got data from J-Quants for {cleaned}")
            continue
        
        # 4. Fall back to mock data
        mock = _get_mock_data(cleaned)
        if mock:
            mock["source"] = "mock"
            results[cleaned] = mock
            logger.warning(f"Using mock data for {cleaned}")

    return results


def fetch_stock_data_detailed(symbol: str) -> Dict[str, Any] | None:
    """
    Fetch detailed stock information including financials and dividends.
    
    優先順位:
    1. キャッシュ
    2. Yahoo Finance API (メイン - リアルタイムデータ + 財務情報)
    3. J-Quants API (サブ - 約12週間遅延)
    4. モックデータ (最後の手段)
    
    Returns comprehensive data for a single stock symbol.
    """
    cleaned = _clean_symbol(symbol)
    yf_symbol = _normalize_symbol(symbol)
    
    # Check cache first
    cached = _get_cached_data(cleaned)
    if cached and cached.get("price") is not None:
        logger.info(f"Returning cached data for {cleaned}")
        return cached
    
    # 1. Try Yahoo Finance first (main source)
    result = _try_yahoo_finance_detailed(cleaned, yf_symbol)
    if result and result.get("price") is not None:
        result["source"] = "yahoo_finance"
        _set_cache(cleaned, result)
        logger.info(f"Successfully fetched data from Yahoo Finance for {cleaned}: {result['name']} - ¥{result['price']}")
        return result
    
    # 2. Try J-Quants API (secondary source)
    logger.info(f"Trying J-Quants API for {cleaned}")
    jquants_result = _try_jquants_detailed(cleaned)
    if jquants_result and jquants_result.get("price") is not None:
        jquants_result["source"] = "jquants"
        jquants_result["note"] = "Data delayed by ~12 weeks (J-Quants free plan)"
        _set_cache(cleaned, jquants_result)
        logger.info(f"Successfully fetched data from J-Quants for {cleaned}: {jquants_result['name']} - ¥{jquants_result['price']}")
        return jquants_result
    
    # 3. Fall back to mock data
    mock = _get_mock_data(cleaned)
    if mock:
        mock["source"] = "mock"
        logger.warning(f"Returning mock data for {cleaned}")
        return mock
    
    return None


def _try_yahoo_finance_detailed(symbol: str, yf_symbol: str) -> Optional[Dict[str, Any]]:
    """
    Yahoo Finance APIから詳細な株価データを取得。
    """
    try:
        logger.info(f"Fetching stock data for symbol: {symbol} (yfinance: {yf_symbol})")
        _rate_limit_wait()
        ticker = yf.Ticker(yf_symbol)
        
        info = {}
        fast_info = {}
        
        try:
            fast_info = ticker.fast_info or {}
        except Exception as e:
            logger.warning(f"Failed to get fast_info for {yf_symbol}: {e}")
            error_str = str(e).lower()
            if "rate limit" in error_str or "too many requests" in error_str:
                return None
            fast_info = {}
        
        # 詳細情報（銘柄名、PER、PBR等）を取得するため常にinfoを取得
        try:
            info = ticker.info or {}
        except Exception as e:
            logger.warning(f"Failed to get info for {yf_symbol}: {e}")
            error_str = str(e).lower()
            if "rate limit" in error_str or "too many requests" in error_str:
                return None
            info = {}
        
        has_price = bool(
            fast_info.get("last_price") or 
            fast_info.get("lastPrice") or 
            info.get("currentPrice")
        )
        
        if not has_price and not info.get("longName") and not info.get("shortName"):
            return None
        
        price = _safe_float(
            fast_info.get("last_price")
            or fast_info.get("lastPrice")
            or info.get("currentPrice")
        )
        previous_close = _safe_float(
            fast_info.get("previous_close")
            or fast_info.get("previousClose")
            or info.get("previousClose")
        )
        day_high = _safe_float(
            fast_info.get("day_high") or fast_info.get("dayHigh") or info.get("dayHigh")
        )
        day_low = _safe_float(
            fast_info.get("day_low") or fast_info.get("dayLow") or info.get("dayLow")
        )
        
        change = change_pct = None
        if price is not None and previous_close:
            change = price - previous_close
            if previous_close != 0:
                change_pct = (change / previous_close) * 100
        
        # 財務情報（年次）
        financials = None
        revenue = None
        profit = None
        revenue_history = []
        profit_history = []
        
        try:
            # 年次財務データを取得（日本株の場合も動作する）
            financials = ticker.financials
            if financials is not None and not financials.empty:
                logger.info(f"Financials columns for {symbol}: {list(financials.columns)[:5]}")
                logger.info(f"Financials index: {list(financials.index)}")
                
                # 最新の列から売上・利益を取得
                latest_col = financials.columns[0] if len(financials.columns) > 0 else None
                if latest_col is not None:
                    # 英語と日本語の両方のキーを試す
                    revenue = _safe_float(
                        financials.loc["Total Revenue", latest_col] if "Total Revenue" in financials.index
                        else financials.loc["売上高", latest_col] if "売上高" in financials.index
                        else None
                    )
                    profit = _safe_float(
                        financials.loc["Net Income", latest_col] if "Net Income" in financials.index
                        else financials.loc["当期純利益", latest_col] if "当期純利益" in financials.index
                        else None
                    )
                
                # 履歴データ（最大5年分）
                for col in financials.columns[:5]:
                    rev = _safe_float(
                        financials.loc["Total Revenue", col] if "Total Revenue" in financials.index
                        else financials.loc["売上高", col] if "売上高" in financials.index
                        else None
                    )
                    prof = _safe_float(
                        financials.loc["Net Income", col] if "Net Income" in financials.index
                        else financials.loc["当期純利益", col] if "当期純利益" in financials.index
                        else None
                    )
                    if rev is not None:
                        revenue_history.append(rev)
                    if prof is not None:
                        profit_history.append(prof)
                
                # 履歴は古い順に並べる
                revenue_history = revenue_history[::-1]
                profit_history = profit_history[::-1]
                
                logger.info(f"Revenue history for {symbol}: {len(revenue_history)} items")
                logger.info(f"Profit history for {symbol}: {len(profit_history)} items")
            else:
                logger.warning(f"No financials data available for {symbol}")
        except Exception as e:
            logger.warning(f"Failed to fetch financials for {symbol}: {e}")
        
        # 配当情報（年次集計）
        dividends = ticker.dividends
        dividend_history = []
        dividend_labels = []
        if dividends is not None and not dividends.empty:
            # 年ごとに配当を集計
            yearly_dividends = {}
            for date, amount in dividends.items():
                year = date.year
                if year not in yearly_dividends:
                    yearly_dividends[year] = 0
                yearly_dividends[year] += float(amount)
            
            # 直近6年分を取得
            sorted_years = sorted(yearly_dividends.keys())[-6:]
            dividend_history = [yearly_dividends[year] for year in sorted_years]
            dividend_labels = [str(year) for year in sorted_years]
            
            logger.info(f"Dividend history for {symbol}: {len(dividend_history)} years")
        
        # 株価履歴（直近7営業日）
        price_history = []
        price_history_labels = []
        try:
            history = ticker.history(period="10d", interval="1d")
            if history is not None and not history.empty:
                closes = history["Close"].dropna()
                recent = closes.tail(7)
                price_history = [float(v) for v in recent.values]
                price_history_labels = [d.strftime("%m/%d") for d in recent.index]
        except Exception as e:
            logger.warning(f"Failed to fetch price history for {symbol}: {e}")
        
        # 銘柄名を取得（日本語名があれば優先）
        english_name = info.get("longName") or info.get("shortName") or info.get("name") or symbol
        stock_name = _get_japanese_stock_name(symbol, english_name)
        
        result = {
            "symbol": symbol,
            "name": stock_name,
            "name_en": english_name,
            "price": price,
            "previous_close": previous_close,
            "change": change,
            "change_pct": change_pct,
            "high": day_high,
            "low": day_low,
            "per": _safe_float(info.get("trailingPE")),
            "pbr": _safe_float(info.get("priceToBook")),
            "dividend_yield": _percentage(info.get("dividendYield")),
            "dividend_payout_ratio": _percentage(info.get("payoutRatio")),
            "market_cap": info.get("marketCap"),
            "revenue": revenue,
            "profit": profit,
            "revenue_history": revenue_history,
            "profit_history": profit_history,
            "dividend_history": dividend_history,
            "dividend_labels": dividend_labels,
            "price_history": price_history,
            "price_history_labels": price_history_labels,
            "sector": info.get("sector"),
            "industry": info.get("industry"),
            "description": info.get("longBusinessSummary"),
        }
        
        logger.info(f"Stock data for {symbol}: price={price}, revenue={revenue}, profit={profit}, "
                   f"per={result['per']}, pbr={result['pbr']}, "
                   f"price_history_len={len(price_history)}, revenue_history_len={len(revenue_history)}")
        
        return result
    except Exception as e:
        import traceback
        logger.error(f"Error fetching Yahoo Finance data for {symbol}: {e}")
        logger.error(traceback.format_exc())
        return None


def _try_jquants_detailed(symbol: str) -> Optional[Dict[str, Any]]:
    """
    J-Quants APIから詳細な株価データを取得。
    無料プランは約12週間のデータ遅延があることに注意。
    """
    try:
        # 株価データを取得
        quotes = _fetch_jquants_daily_quotes(symbol)
        if not quotes or quotes.get("price") is None:
            return None
        
        # 銘柄情報を取得
        info = _fetch_jquants_listed_info(symbol)
        if info:
            quotes["name"] = info.get("name", symbol)
            quotes["sector"] = info.get("sector")
            quotes["industry"] = info.get("industry")
        
        # 財務情報を取得
        statements = _fetch_jquants_statements(symbol)
        if statements:
            quotes["revenue"] = statements.get("revenue")
            quotes["profit"] = statements.get("profit")
            quotes["revenue_history"] = statements.get("revenue_history") or []
            quotes["profit_history"] = statements.get("profit_history") or []
            quotes["dividend_history"] = statements.get("dividend_history") or []
            quotes["dividend_labels"] = statements.get("dividend_labels") or []

            price = quotes.get("price")
            eps = statements.get("eps")
            bps = statements.get("bps")
            if price is not None:
                if eps:
                    quotes["per"] = price / eps
                if bps:
                    quotes["pbr"] = price / bps
        
        # 株価履歴（J-Quants無料枠は遅延）
        quotes["price_history"] = quotes.get("price_history") or []
        quotes["price_history_labels"] = quotes.get("price_history_labels") or []
        
        # 前日比を計算（2日分のデータがあれば）
        if quotes.get("previous_close") and quotes.get("price"):
            change = quotes["price"] - quotes["previous_close"]
            quotes["change"] = change
            if quotes["previous_close"] != 0:
                quotes["change_pct"] = (change / quotes["previous_close"]) * 100
        
        return quotes
    except Exception as e:
        logger.error(f"Error fetching J-Quants data for {symbol}: {e}")
        return None


def _safe_float(value: Any) -> float | None:
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _percentage(value: Any) -> float | None:
    number = _safe_float(value)
    if number is None:
        return None
    if number <= 1:
        # yfinance yields fractions for yields/payouts
        return number * 100
    return number


