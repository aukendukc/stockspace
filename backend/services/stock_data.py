"""
Utility functions to fetch up-to-date stock metrics from external data sources.
Currently powered by yfinance. Symbols comprised only of digits are assumed to
be listed on the Tokyo Stock Exchange and suffixed with ".T".

Includes caching to reduce API calls and avoid rate limiting.
"""

from __future__ import annotations

from typing import Dict, Any, List
from datetime import datetime, timedelta
import time
import logging

import yfinance as yf

logger = logging.getLogger(__name__)

# Simple in-memory cache for stock data
_stock_cache: Dict[str, Dict[str, Any]] = {}
_cache_expiry: Dict[str, datetime] = {}
_CACHE_DURATION = timedelta(minutes=5)  # Cache for 5 minutes

# Rate limiting
_last_request_time: float = 0
_MIN_REQUEST_INTERVAL = 1.0  # Minimum seconds between requests

# Fallback mock data for popular Japanese stocks
_MOCK_STOCK_DATA: Dict[str, Dict[str, Any]] = {
    "7203": {"symbol": "7203", "name": "トヨタ自動車", "price": 2850.0, "change": 25.0, "change_pct": 0.88},
    "6758": {"symbol": "6758", "name": "ソニーグループ", "price": 3150.0, "change": -15.0, "change_pct": -0.47},
    "9984": {"symbol": "9984", "name": "ソフトバンクグループ", "price": 8500.0, "change": 120.0, "change_pct": 1.43},
    "9434": {"symbol": "9434", "name": "ソフトバンク", "price": 1850.0, "change": 8.0, "change_pct": 0.43},
    "6861": {"symbol": "6861", "name": "キーエンス", "price": 65000.0, "change": 500.0, "change_pct": 0.78},
    "9983": {"symbol": "9983", "name": "ファーストリテイリング", "price": 45000.0, "change": -200.0, "change_pct": -0.44},
    "8035": {"symbol": "8035", "name": "東京エレクトロン", "price": 28000.0, "change": 350.0, "change_pct": 1.27},
    "4063": {"symbol": "4063", "name": "信越化学工業", "price": 5800.0, "change": 45.0, "change_pct": 0.78},
    "8267": {"symbol": "8267", "name": "イオン", "price": 3200.0, "change": -10.0, "change_pct": -0.31},
    "4503": {"symbol": "4503", "name": "アステラス製薬", "price": 1750.0, "change": 12.0, "change_pct": 0.69},
}


def _normalize_symbol(symbol: str) -> str:
    """Convert local symbols to yfinance format."""
    cleaned = symbol.strip().upper()
    if cleaned.isdigit():
        return f"{cleaned}.T"
    return cleaned


def _get_cached_data(symbol: str) -> Dict[str, Any] | None:
    """Get cached data if available and not expired."""
    if symbol in _stock_cache:
        if datetime.now() < _cache_expiry.get(symbol, datetime.min):
            logger.debug(f"Cache hit for {symbol}")
            return _stock_cache[symbol]
    return None


def _set_cache(symbol: str, data: Dict[str, Any]) -> None:
    """Cache stock data."""
    _stock_cache[symbol] = data
    _cache_expiry[symbol] = datetime.now() + _CACHE_DURATION


def _rate_limit_wait() -> None:
    """Wait if needed to respect rate limits."""
    global _last_request_time
    elapsed = time.time() - _last_request_time
    if elapsed < _MIN_REQUEST_INTERVAL:
        time.sleep(_MIN_REQUEST_INTERVAL - elapsed)
    _last_request_time = time.time()


def _get_mock_data(symbol: str) -> Dict[str, Any] | None:
    """Get mock data for known symbols when API fails."""
    cleaned = symbol.strip().upper().replace(".T", "")
    if cleaned in _MOCK_STOCK_DATA:
        logger.info(f"Using mock data for {symbol} due to API unavailability")
        return _MOCK_STOCK_DATA[cleaned].copy()
    return None


def fetch_stock_data(symbols: List[str]) -> Dict[str, Dict[str, Any]]:
    """
    Fetch latest stock metrics for the provided symbols.

    Returns a dict keyed by the original symbol with metrics such as price,
    change, day high/low, etc. Uses cache and mock data when API fails.
    """
    results: Dict[str, Dict[str, Any]] = {}

    for symbol in symbols:
        # Check cache first
        cached = _get_cached_data(symbol)
        if cached:
            results[symbol] = cached
            continue

        yf_symbol = _normalize_symbol(symbol)
        try:
            _rate_limit_wait()
            ticker = yf.Ticker(yf_symbol)
            fast_info = getattr(ticker, "fast_info", {}) or {}
            info = getattr(ticker, "info", {}) or {}

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

            name = info.get("longName") or info.get("shortName") or info.get("name") or symbol

            metrics = {
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
                "name": name,
            }

            result_data = {k: v for k, v in metrics.items() if v is not None}
            if result_data.get("price") is not None:
                _set_cache(symbol, result_data)
                results[symbol] = result_data
            else:
                # Fall back to mock data
                mock = _get_mock_data(symbol)
                if mock:
                    results[symbol] = mock
        except Exception as e:
            logger.warning(f"Failed to fetch {symbol}: {e}, trying mock data")
            # Fall back to mock data
            mock = _get_mock_data(symbol)
            if mock:
                results[symbol] = mock
            continue

    return results


def fetch_stock_data_detailed(symbol: str) -> Dict[str, Any] | None:
    """
    Fetch detailed stock information including financials and dividends.
    Returns comprehensive data for a single stock symbol.
    Uses cache and mock data when API fails.
    """
    yf_symbol = _normalize_symbol(symbol)
    
    # Check cache first
    cached = _get_cached_data(symbol)
    if cached and cached.get("price") is not None:
        logger.info(f"Returning cached data for {symbol}")
        return cached
    
    try:
        logger.info(f"Fetching stock data for symbol: {symbol} (yfinance: {yf_symbol})")
        _rate_limit_wait()
        ticker = yf.Ticker(yf_symbol)
        
        # 情報を取得（タイムアウトを考慮）
        info = {}
        fast_info = {}
        
        try:
            # Try fast_info first (faster, less likely to rate limit)
            fast_info = ticker.fast_info or {}
            logger.debug(f"Got fast_info for {yf_symbol}")
        except Exception as e:
            logger.warning(f"Failed to get fast_info for {yf_symbol}: {e}")
            # Check for rate limit
            error_str = str(e).lower()
            if "rate limit" in error_str or "too many requests" in error_str:
                logger.error(f"Rate limited by yfinance for {yf_symbol}, using mock data")
                mock = _get_mock_data(symbol)
                if mock:
                    return mock
                raise
            fast_info = {}
        
        try:
            # Only get info if we don't have price from fast_info
            if not fast_info.get("last_price") and not fast_info.get("lastPrice"):
                info = ticker.info or {}
                logger.debug(f"Got info for {yf_symbol}")
        except Exception as e:
            logger.warning(f"Failed to get info for {yf_symbol}: {e}")
            # Check if it's a rate limit error
            error_str = str(e).lower()
            if "rate limit" in error_str or "too many requests" in error_str:
                logger.error(f"Rate limited by yfinance for {yf_symbol}, using mock data")
                mock = _get_mock_data(symbol)
                if mock:
                    return mock
                raise
            info = {}
        
        # Check if we have any useful data
        has_price = bool(
            fast_info.get("last_price") or 
            fast_info.get("lastPrice") or 
            info.get("currentPrice")
        )
        
        if not has_price and not info.get("longName") and not info.get("shortName"):
            logger.warning(f"No useful data available for {yf_symbol}")
            return None
        
        # 基本情報
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
        
        # 財務情報
        financials = ticker.financials
        balance_sheet = ticker.balance_sheet
        cashflow = ticker.cashflow
        
        # 最新の財務データを取得
        revenue = None
        profit = None
        if financials is not None and not financials.empty:
            # 最新年度のデータを取得
            latest_col = financials.columns[0] if len(financials.columns) > 0 else None
            if latest_col is not None:
                revenue = _safe_float(financials.loc["Total Revenue", latest_col]) if "Total Revenue" in financials.index else None
                profit = _safe_float(financials.loc["Net Income", latest_col]) if "Net Income" in financials.index else None
        
        # 配当情報
        dividends = ticker.dividends
        dividend_history = []
        if dividends is not None and not dividends.empty:
            # 過去5年分の配当データ
            recent_dividends = dividends.tail(20)
            dividend_history = [
                {
                    "date": str(date),
                    "amount": float(amount)
                }
                for date, amount in recent_dividends.items()
            ]
        
        # 業績履歴（過去5年分）
        revenue_history = []
        profit_history = []
        if financials is not None and not financials.empty:
            # 過去5年分のデータ
            for col in financials.columns[:5]:
                rev = _safe_float(financials.loc["Total Revenue", col]) if "Total Revenue" in financials.index else None
                prof = _safe_float(financials.loc["Net Income", col]) if "Net Income" in financials.index else None
                if rev is not None:
                    revenue_history.append(rev)
                if prof is not None:
                    profit_history.append(prof)
        
        result = {
            "symbol": symbol,
            "name": info.get("longName") or info.get("shortName") or info.get("name") or symbol,
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
            "sector": info.get("sector"),
            "industry": info.get("industry"),
            "description": info.get("longBusinessSummary"),
        }
        
        # 最低限のデータ（価格）がない場合はモックデータを返す
        if result["price"] is None:
            logger.warning(f"No price data for {yf_symbol}, trying mock data")
            mock = _get_mock_data(symbol)
            if mock:
                return mock
            return None
        
        # Cache the result
        _set_cache(symbol, result)
        
        logger.info(f"Successfully fetched data for {symbol}: {result['name']} - ¥{result['price']}")
        return result
    except Exception as e:
        import traceback
        logger.error(f"Error fetching stock data for {symbol} ({yf_symbol}): {e}")
        logger.error(traceback.format_exc())
        
        # Return mock data if available
        mock = _get_mock_data(symbol)
        if mock:
            logger.info(f"Returning mock data for {symbol}")
            return mock
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


