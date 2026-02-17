"""Stock registry — dynamically loads real NEPSE data from the Data directory.

Reads company metadata from company_list.csv and price history from
individual CSV files in Data/price_history/.
"""

import csv
import logging
import os
from typing import Dict, List, Optional

import pandas as pd

logger = logging.getLogger(__name__)

# Path to the real Data directory (sibling to Data-Server)
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_DATA_DIR = os.path.join(_PROJECT_ROOT, "Data")
_PRICE_HISTORY_DIR = os.path.join(_DATA_DIR, "price_history")
_COMPANY_LIST_PATH = os.path.join(_DATA_DIR, "company_list.csv")

# In-memory caches
_company_registry: Dict[str, dict] = {}
_price_cache: Dict[str, pd.DataFrame] = {}
_initialized = False


def _parse_number(value: str) -> float:
    """Parse a number string that may contain commas (e.g., '1,129.80')."""
    if not value or value == "-":
        return 0.0
    try:
        return float(str(value).replace(",", "").strip())
    except (ValueError, TypeError):
        return 0.0


def _load_company_list():
    """Load company metadata from company_list.csv."""
    global _company_registry
    if not os.path.exists(_COMPANY_LIST_PATH):
        logger.warning(f"Company list not found: {_COMPANY_LIST_PATH}")
        return

    try:
        df = pd.read_csv(_COMPANY_LIST_PATH)
        for _, row in df.iterrows():
            symbol = str(row.get("symbol", row.get("Symbol", ""))).strip().upper()
            if not symbol:
                continue
            _company_registry[symbol] = {
                "symbol": symbol,
                "name": str(row.get("Company", row.get("Company_text", ""))).strip(),
                "sector": str(row.get("sector", "")).strip(),
                "ltp": _parse_number(str(row.get("LTP", "0"))),
            }
        logger.info(f"Loaded {len(_company_registry)} companies from company_list.csv")
    except Exception as e:
        logger.error(f"Error loading company list: {e}")


def _initialize():
    """Initialize the registry by loading company data."""
    global _initialized
    if _initialized:
        return
    _load_company_list()
    _initialized = True


def _get_available_price_files() -> Dict[str, str]:
    """Scan the price_history directory for available CSV files."""
    files = {}
    if not os.path.exists(_PRICE_HISTORY_DIR):
        logger.warning(f"Price history directory not found: {_PRICE_HISTORY_DIR}")
        return files

    for filename in os.listdir(_PRICE_HISTORY_DIR):
        if filename.endswith("_price_history.csv"):
            # Extract symbol from filename: nabil_price_history.csv -> NABIL
            symbol = filename.replace("_price_history.csv", "").upper()
            files[symbol] = os.path.join(_PRICE_HISTORY_DIR, filename)
    return files


def get_all_symbols() -> List[str]:
    """Return list of all stock symbols that have price history data."""
    _initialize()
    files = _get_available_price_files()
    return sorted(files.keys())


def get_tracked_symbols() -> List[str]:
    """Return the default set of tracked stocks (key Banking + Hydro stocks).

    These are the stocks actively simulated and monitored by default.
    Users can subscribe to additional stocks as needed.
    """
    # Default tracked stocks as mentioned in the report
    default_stocks = [
        "NABIL", "NLIC", "SCB", "UPPER", "HDL", "NHPC",
        # Additional popular stocks
        "SBI", "EBL", "HIDCL", "NTC", "CHCL", "SHPC",
    ]
    available = set(get_all_symbols())
    return [s for s in default_stocks if s in available]


def get_stock_info(symbol: str) -> Optional[dict]:
    """Return metadata for a stock symbol."""
    _initialize()
    symbol = symbol.upper()

    # Try company registry first
    if symbol in _company_registry:
        return _company_registry[symbol]

    # Fall back to price file inspection
    files = _get_available_price_files()
    if symbol not in files:
        return None

    # Try to extract info from the first row of the CSV
    try:
        df = pd.read_csv(files[symbol], nrows=1)
        return {
            "symbol": symbol,
            "name": str(df.iloc[0].get("company_name", symbol)),
            "sector": str(df.iloc[0].get("sector", "Unknown")),
        }
    except Exception:
        return {"symbol": symbol, "name": symbol, "sector": "Unknown"}


def get_historical_data(symbol: str, days: int = 50) -> List[dict]:
    """Load historical OHLCV data from CSV file.

    Returns data in chronological order (oldest first).

    Args:
        symbol: Stock symbol (case-insensitive)
        days: Number of most recent trading days to return

    Returns:
        List of dicts with keys: date, open, high, low, close, volume, turnover
    """
    symbol = symbol.upper()

    # Check cache
    if symbol not in _price_cache:
        files = _get_available_price_files()
        if symbol not in files:
            return []

        try:
            df = pd.read_csv(files[symbol])
            _price_cache[symbol] = df
        except Exception as e:
            logger.error(f"Error loading price history for {symbol}: {e}")
            return []

    df = _price_cache[symbol]

    # Parse the data — CSV is in descending order (newest first)
    records = []
    for _, row in df.iterrows():
        try:
            records.append({
                "date": str(row.get("Date", "")),
                "open": _parse_number(str(row.get("Open", 0))),
                "high": _parse_number(str(row.get("High", 0))),
                "low": _parse_number(str(row.get("Low", 0))),
                "close": _parse_number(str(row.get("Ltp", 0))),  # Ltp = Last Traded Price
                "volume": int(_parse_number(str(row.get("Qty", 0)))),
                "turnover": _parse_number(str(row.get("Turnover", 0))),
                "change_pct": _parse_number(str(row.get("% Change", 0))),
            })
        except Exception:
            continue

    # Reverse to chronological order (oldest first) and take last N days
    records.reverse()
    return records[-days:] if days else records


def get_latest_close(symbol: str) -> Optional[float]:
    """Get the most recent closing price (LTP) from historical data."""
    history = get_historical_data(symbol, days=1)
    if history:
        return history[-1]["close"]

    # Fall back to company list LTP
    _initialize()
    info = _company_registry.get(symbol.upper())
    return info["ltp"] if info and info.get("ltp") else None


def get_average_volume(symbol: str, days: int = 20) -> Optional[float]:
    """Get average trading volume over the last N days."""
    history = get_historical_data(symbol, days=days)
    if not history:
        return None
    volumes = [d["volume"] for d in history if d["volume"] > 0]
    return sum(volumes) / len(volumes) if volumes else None


def get_volatility(symbol: str, days: int = 20) -> float:
    """Calculate historical volatility (std dev of daily returns)."""
    history = get_historical_data(symbol, days=days + 1)
    if len(history) < 2:
        return 0.02  # default volatility

    returns = []
    for i in range(1, len(history)):
        if history[i - 1]["close"] > 0:
            r = (history[i]["close"] - history[i - 1]["close"]) / history[i - 1]["close"]
            returns.append(r)

    if not returns:
        return 0.02

    import numpy as np
    return float(np.std(returns))
