"""Tests for the NEPSE market clock."""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timezone, timedelta
from engine.market_clock import MarketClock, NPT


def test_npt_timezone():
    """Verify NPT is UTC+5:45."""
    npt_offset = NPT.utcoffset(None)
    assert npt_offset == timedelta(hours=5, minutes=45), f"Expected UTC+5:45, got {npt_offset}"
    print("  ✅ NPT timezone is UTC+5:45")


def test_trading_days():
    """Verify Sun-Thu are trading days, Fri-Sat are not."""
    clock = MarketClock()
    clock.force_open = False

    # Sunday (weekday=6) — should be trading day
    sunday = datetime(2025, 12, 7, 12, 0, tzinfo=NPT)  # A Sunday
    assert clock.is_trading_day(sunday), "Sunday should be a trading day"

    # Thursday (weekday=3) — should be trading day
    thursday = datetime(2025, 12, 4, 12, 0, tzinfo=NPT)
    assert clock.is_trading_day(thursday), "Thursday should be a trading day"

    # Friday (weekday=4) — should NOT be trading day
    friday = datetime(2025, 12, 5, 12, 0, tzinfo=NPT)
    assert not clock.is_trading_day(friday), "Friday should NOT be a trading day"

    # Saturday (weekday=5) — should NOT be trading day
    saturday = datetime(2025, 12, 6, 12, 0, tzinfo=NPT)
    assert not clock.is_trading_day(saturday), "Saturday should NOT be a trading day"

    print("  ✅ Trading days are correctly Sun-Thu")


def test_trading_hours():
    """Verify 11:00-15:00 NPT trading hours."""
    clock = MarketClock()
    clock.force_open = False

    # 10:59 — before market open
    before = datetime(2025, 12, 7, 10, 59, tzinfo=NPT)
    assert not clock.is_within_trading_hours(before), "10:59 should be outside hours"

    # 11:00 — market open
    at_open = datetime(2025, 12, 7, 11, 0, tzinfo=NPT)
    assert clock.is_within_trading_hours(at_open), "11:00 should be within hours"

    # 13:00 — mid-session
    midday = datetime(2025, 12, 7, 13, 0, tzinfo=NPT)
    assert clock.is_within_trading_hours(midday), "13:00 should be within hours"

    # 14:59 — just before close
    before_close = datetime(2025, 12, 7, 14, 59, tzinfo=NPT)
    assert clock.is_within_trading_hours(before_close), "14:59 should be within hours"

    # 15:00 — market close
    at_close = datetime(2025, 12, 7, 15, 0, tzinfo=NPT)
    assert not clock.is_within_trading_hours(at_close), "15:00 should be outside hours"

    print("  ✅ Trading hours are correctly 11:00-15:00 NPT")


def test_force_market_open():
    """Verify FORCE_MARKET_OPEN overrides clock."""
    clock = MarketClock()
    clock.force_open = True
    assert clock.is_market_open(), "Market should be open when forced"

    clock.force_open = False
    # Market may or may not be open depending on current time
    print("  ✅ Force market open works correctly")


def test_market_status():
    """Verify market status returns complete information."""
    clock = MarketClock()
    status = clock.get_market_status()

    required_keys = [
        "is_open", "current_time_npt", "trading_hours",
        "trading_days", "force_open", "is_trading_day", "is_within_hours",
    ]
    for key in required_keys:
        assert key in status, f"Missing key: {key}"

    print("  ✅ Market status contains all required fields")


if __name__ == "__main__":
    print("\n🕐 Market Clock Tests")
    print("-" * 40)
    test_npt_timezone()
    test_trading_days()
    test_trading_hours()
    test_force_market_open()
    test_market_status()
    print("\n✅ All market clock tests passed!\n")
