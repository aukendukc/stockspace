"""
Utility functions to fetch up-to-date stock metrics from external data sources.
Currently powered by yfinance. Symbols comprised only of digits are assumed to
be listed on the Tokyo Stock Exchange and suffixed with ".T".
"""

from __future__ import annotations

from typing import Dict, Any, List

import yfinance as yf


def _normalize_symbol(symbol: str) -> str:
    """Convert local symbols to yfinance format."""
    cleaned = symbol.strip().upper()
    if cleaned.isdigit():
        return f"{cleaned}.T"
    return cleaned


def fetch_stock_data(symbols: List[str]) -> Dict[str, Dict[str, Any]]:
    """
    Fetch latest stock metrics for the provided symbols.

    Returns a dict keyed by the original symbol with metrics such as price,
    change, day high/low, etc. Symbols that fail to fetch are omitted.
    """
    results: Dict[str, Dict[str, Any]] = {}

    for symbol in symbols:
        yf_symbol = _normalize_symbol(symbol)
        try:
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
            }

            results[symbol] = {k: v for k, v in metrics.items() if v is not None}
        except Exception:
            # Ignore symbols that fail to fetch and continue with others
            continue

    return results


def fetch_stock_data_detailed(symbol: str) -> Dict[str, Any] | None:
    """
    Fetch detailed stock information including financials and dividends.
    Returns comprehensive data for a single stock symbol.
    """
    import logging
    logger = logging.getLogger(__name__)
    
    yf_symbol = _normalize_symbol(symbol)
    try:
        logger.info(f"Fetching stock data for symbol: {symbol} (yfinance: {yf_symbol})")
        ticker = yf.Ticker(yf_symbol)
        
        # 情報を取得（タイムアウトを考慮）
        try:
            info = ticker.info
        except Exception as e:
            logger.warning(f"Failed to get info for {yf_symbol}: {e}")
            info = {}
        
        try:
            fast_info = ticker.fast_info
        except Exception as e:
            logger.warning(f"Failed to get fast_info for {yf_symbol}: {e}")
            fast_info = {}
        
        if not info and not fast_info:
            logger.error(f"No data available for {yf_symbol}")
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
        
        # 最低限のデータ（価格）がない場合はNoneを返す
        if result["price"] is None:
            logger.warning(f"No price data for {yf_symbol}")
            return None
        
        logger.info(f"Successfully fetched data for {symbol}: {result['name']} - ¥{result['price']}")
        return result
    except Exception as e:
        import traceback
        logger.error(f"Error fetching stock data for {symbol} ({yf_symbol}): {e}")
        logger.error(traceback.format_exc())
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


