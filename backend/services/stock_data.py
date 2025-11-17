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


