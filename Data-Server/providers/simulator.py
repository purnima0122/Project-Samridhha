"""Replay-based data provider — replays real NEPSE historical data day by day.

Instead of floating around a single LTP, this simulator:
1. Picks a random start day from the last 30 days of history
2. Replays 7 real trading days from that point
3. Within each day, interpolates intraday ticks between Open → High/Low → Close
4. After 7 days, picks a new random window and repeats
"""

import logging
import random
from datetime import datetime
from typing import Callable, Dict, List, Optional

import numpy as np

from data.stock_registry import (
    get_average_volume,
    get_historical_data,
    get_stock_info,
    get_tracked_symbols,
    get_volatility,
)
from providers.base import DataProvider

logger = logging.getLogger(__name__)

# Simulation constants
REPLAY_WINDOW_DAYS = 7        # Replay this many real trading days
HISTORY_LOOKBACK_DAYS = 30    # Pick random start from last N days
TICKS_PER_DAY = 200           # Number of ticks to generate per simulated day


class SimulatorProvider(DataProvider):
    """Replays real NEPSE historical data with intraday tick interpolation.

    Each simulated day follows the real OHLCV data:
    - Price opens at the real Open
    - Walks toward High and Low during the day
    - Converges to real Close (LTP) at end of day
    - Volume is distributed across ticks proportional to real Qty
    """

    def __init__(self, symbols: List[str] = None):
        self._tracked_symbols = symbols or get_tracked_symbols()
        self._current_state: Dict[str, dict] = {}
        self._subscribers: Dict[str, List[Callable]] = {}

        # Replay state per symbol
        self._replay: Dict[str, dict] = {}

        self._initialize()

    def _initialize(self):
        """Load historical data and set up replay windows for each symbol."""
        for symbol in self._tracked_symbols:
            history = get_historical_data(symbol, days=HISTORY_LOOKBACK_DAYS)
            if len(history) < 2:
                logger.warning(f"Skipping {symbol}: insufficient history ({len(history)} days)")
                continue

            info = get_stock_info(symbol) or {}
            avg_vol = get_average_volume(symbol) or 10000
            volatility = get_volatility(symbol)

            # Pick a random replay window
            replay_data = self._pick_replay_window(history)

            self._replay[symbol] = {
                "full_history": history,
                "window": replay_data,        # 7 days of OHLCV to replay
                "day_index": 0,               # Current day within the window
                "tick_index": 0,              # Current tick within the day
                "ticks_per_day": TICKS_PER_DAY,
            }

            # Initialize current state from the first day's open
            first_day = replay_data[0]
            self._current_state[symbol] = {
                "symbol": symbol,
                "name": info.get("name", symbol),
                "sector": info.get("sector", "Unknown"),
                "price": first_day["open"],
                "open": first_day["open"],
                "high": first_day["open"],
                "low": first_day["open"],
                "volume": 0,
                "change": 0.0,
                "change_pct": 0.0,
                "prev_close": first_day["open"],
                "avg_volume": avg_vol,
                "volatility": volatility,
                "replay_date": first_day.get("date", ""),
                "replay_day": 1,
                "replay_total_days": len(replay_data),
                "timestamp": datetime.now().isoformat(),
            }

        logger.info(
            f"Replay simulator initialized: {len(self._current_state)} stocks, "
            f"{REPLAY_WINDOW_DAYS}-day windows from last {HISTORY_LOOKBACK_DAYS} days"
        )

    def _pick_replay_window(self, history: List[dict]) -> List[dict]:
        """Pick a random 7-day window from the last 30 days of history."""
        available = len(history)
        window_size = min(REPLAY_WINDOW_DAYS, available)

        # Random start index (history is chronological: oldest first)
        max_start = max(0, available - window_size)
        start = random.randint(0, max_start)

        return history[start:start + window_size]

    def _advance_replay(self, symbol: str):
        """Move to the next replay window when current one is exhausted."""
        replay = self._replay[symbol]
        replay["window"] = self._pick_replay_window(replay["full_history"])
        replay["day_index"] = 0
        replay["tick_index"] = 0

        first_day = replay["window"][0]
        state = self._current_state[symbol]
        state["prev_close"] = state["price"]
        state["open"] = first_day["open"]
        state["high"] = first_day["open"]
        state["low"] = first_day["open"]
        state["volume"] = 0
        state["replay_date"] = first_day.get("date", "")
        state["replay_day"] = 1
        state["replay_total_days"] = len(replay["window"])

        logger.info(f"{symbol}: New replay window starting from {first_day.get('date', '?')}")

    def reset_session(self):
        """Reset for a new trading session — advance to next replay day."""
        for symbol in list(self._current_state.keys()):
            if symbol not in self._replay:
                continue

            replay = self._replay[symbol]
            replay["day_index"] += 1
            replay["tick_index"] = 0

            # If we've exhausted the window, pick a new one
            if replay["day_index"] >= len(replay["window"]):
                self._advance_replay(symbol)
                continue

            day_data = replay["window"][replay["day_index"]]
            state = self._current_state[symbol]
            state["prev_close"] = state["price"]
            state["open"] = day_data["open"]
            state["high"] = day_data["open"]
            state["low"] = day_data["open"]
            state["price"] = day_data["open"]
            state["volume"] = 0
            state["change"] = round(day_data["open"] - state["prev_close"], 2)
            state["change_pct"] = round(
                ((day_data["open"] - state["prev_close"]) / state["prev_close"]) * 100, 2
            ) if state["prev_close"] else 0.0
            state["replay_date"] = day_data.get("date", "")
            state["replay_day"] = replay["day_index"] + 1

    def get_latest_tick(self, symbol: str) -> Optional[dict]:
        return self._current_state.get(symbol.upper())

    def get_history(self, symbol: str, days: int = 50) -> List[dict]:
        return get_historical_data(symbol.upper(), days=days)

    def get_all_ticks(self) -> Dict[str, dict]:
        return dict(self._current_state)

    def get_available_symbols(self) -> List[str]:
        return list(self._current_state.keys())

    def generate_tick(self, symbol: str) -> dict:
        """Generate the next intraday tick by interpolating real OHLCV data.

        The tick follows the real day's price action:
        - First quarter:  Open → High (ascending)
        - Second quarter: High → Low (descending, passing through mid-range)
        - Third quarter:  Low → Close (ascending toward close)
        - Fourth quarter: Settle near Close with small noise

        This creates a realistic intraday price curve that hits the real
        Open, High, Low, and Close values.
        """
        symbol = symbol.upper()
        if symbol not in self._replay or symbol not in self._current_state:
            raise ValueError(f"Unknown symbol: {symbol}")

        replay = self._replay[symbol]
        state = self._current_state[symbol]

        day_idx = replay["day_index"]
        tick_idx = replay["tick_index"]
        ticks_per_day = replay["ticks_per_day"]

        # Get the current day's real OHLCV
        if day_idx >= len(replay["window"]):
            self._advance_replay(symbol)
            day_idx = 0
            tick_idx = 0

        day = replay["window"][day_idx]
        day_open = day["open"]
        day_high = day["high"]
        day_low = day["low"]
        day_close = day["close"]
        day_volume = day.get("volume", 10000)

        # Progress through the day (0.0 → 1.0)
        progress = min(tick_idx / max(ticks_per_day - 1, 1), 1.0)

        # Intraday price interpolation with 4 phases
        target_price = self._interpolate_price(
            day_open, day_high, day_low, day_close, progress
        )

        # Add small noise around the target (proportional to day's range)
        day_range = max(day_high - day_low, 0.01)
        noise = np.random.normal(0, day_range * 0.02)
        new_price = max(target_price + noise, 1.0)

        # Volume distribution — more volume in middle of day
        vol_progress = np.sin(progress * np.pi)  # peaks at midday
        tick_volume = max(1, int((day_volume / ticks_per_day) * (0.5 + vol_progress)))

        # Update state
        state["price"] = round(new_price, 2)
        state["high"] = round(max(state["high"], new_price), 2)
        state["low"] = round(min(state["low"], new_price), 2)
        state["volume"] += tick_volume
        prev_close = state["prev_close"]
        state["change"] = round(new_price - prev_close, 2)
        state["change_pct"] = round(
            ((new_price - prev_close) / prev_close) * 100, 2
        ) if prev_close else 0.0
        state["timestamp"] = datetime.now().isoformat()

        # Advance tick counter
        replay["tick_index"] = tick_idx + 1

        # If day is done, move to next day
        if replay["tick_index"] >= ticks_per_day:
            # Snap to exact close price at end of day
            state["price"] = round(day_close, 2)
            state["change"] = round(day_close - prev_close, 2)
            state["change_pct"] = round(
                ((day_close - prev_close) / prev_close) * 100, 2
            ) if prev_close else 0.0

            replay["day_index"] += 1
            replay["tick_index"] = 0

            # Set up next day
            if replay["day_index"] < len(replay["window"]):
                next_day = replay["window"][replay["day_index"]]
                state["prev_close"] = day_close
                state["open"] = next_day["open"]
                state["high"] = next_day["open"]
                state["low"] = next_day["open"]
                state["volume"] = 0
                state["replay_date"] = next_day.get("date", "")
                state["replay_day"] = replay["day_index"] + 1
                logger.info(
                    f"{symbol}: Day {replay['day_index']}/{len(replay['window'])} "
                    f"({next_day.get('date', '?')}), prev_close={day_close}"
                )
            else:
                # Window exhausted — pick new random window
                self._advance_replay(symbol)

        tick_data = dict(state)
        tick_data["tick_volume"] = tick_volume
        tick_data["day_progress"] = round(progress * 100, 1)

        # Notify subscribers
        for callback in self._subscribers.get(symbol, []):
            try:
                callback(tick_data)
            except Exception:
                pass

        return tick_data

    @staticmethod
    def _interpolate_price(
        open_p: float, high_p: float, low_p: float, close_p: float,
        progress: float
    ) -> float:
        """Interpolate intraday price through O → H → L → C phases.

        Phase 1 (0.00–0.25): Open → High
        Phase 2 (0.25–0.50): High → Low
        Phase 3 (0.50–0.80): Low → Close
        Phase 4 (0.80–1.00): Settle at Close
        """
        if progress < 0.25:
            # Open → High
            t = progress / 0.25
            return open_p + (high_p - open_p) * t
        elif progress < 0.50:
            # High → Low
            t = (progress - 0.25) / 0.25
            return high_p + (low_p - high_p) * t
        elif progress < 0.80:
            # Low → Close
            t = (progress - 0.50) / 0.30
            return low_p + (close_p - low_p) * t
        else:
            # Settle at Close
            t = (progress - 0.80) / 0.20
            return close_p + (close_p - close_p) * t  # just close_p

    def subscribe(self, symbol: str, callback: Callable[[dict], None]) -> None:
        symbol = symbol.upper()
        if symbol not in self._subscribers:
            self._subscribers[symbol] = []
        self._subscribers[symbol].append(callback)

    def unsubscribe(self, symbol: str, callback: Callable[[dict], None]) -> None:
        symbol = symbol.upper()
        if symbol in self._subscribers:
            self._subscribers[symbol] = [
                cb for cb in self._subscribers[symbol] if cb != callback
            ]
