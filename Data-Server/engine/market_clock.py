"""NEPSE market clock — enforces official trading hours.

Trading Hours: Sunday–Thursday, 11:00 AM – 3:00 PM NPT (UTC+5:45)
"""

import logging
from datetime import datetime, time, timedelta, timezone

from config import Config

logger = logging.getLogger(__name__)

# Nepal Standard Time: UTC+5:45
NPT = timezone(timedelta(hours=5, minutes=45))


class MarketClock:
    """Manages NEPSE market schedule and trading status.

    Provides methods to check if the market is open, calculate time
    to next open/close, and handle Nepal public holidays.
    """

    def __init__(self):
        self.open_time = time(Config.MARKET_OPEN_HOUR, Config.MARKET_OPEN_MINUTE)
        self.close_time = time(Config.MARKET_CLOSE_HOUR, Config.MARKET_CLOSE_MINUTE)
        self.trading_days = set(Config.MARKET_TRADING_DAYS)
        self.force_open = Config.FORCE_MARKET_OPEN
        self.holidays = self._parse_holidays()

    def _parse_holidays(self) -> set:
        """Parse public holidays from config (MM-DD format)."""
        holidays = set()
        for h in Config.PUBLIC_HOLIDAYS:
            h = h.strip()
            if h:
                holidays.add(h)
        return holidays

    def now_npt(self) -> datetime:
        """Get current time in Nepal Standard Time."""
        return datetime.now(NPT)

    def is_trading_day(self, dt: datetime = None) -> bool:
        """Check if the given date is a NEPSE trading day."""
        if dt is None:
            dt = self.now_npt()
        # Check weekday (Python: Monday=0, Sunday=6)
        if dt.weekday() not in self.trading_days:
            return False
        # Check public holidays
        date_str = dt.strftime("%m-%d")
        if date_str in self.holidays:
            return False
        return True

    def is_within_trading_hours(self, dt: datetime = None) -> bool:
        """Check if current time falls within NEPSE trading hours."""
        if dt is None:
            dt = self.now_npt()
        current_time = dt.time()
        return self.open_time <= current_time < self.close_time

    def is_market_open(self) -> bool:
        """Check if the NEPSE market is currently open.

        Considers trading days, hours, and the FORCE_MARKET_OPEN config.
        """
        if self.force_open:
            return True

        now = self.now_npt()
        return self.is_trading_day(now) and self.is_within_trading_hours(now)

    def get_market_status(self) -> dict:
        """Return comprehensive market status information."""
        now = self.now_npt()
        is_open = self.is_market_open()

        status = {
            "is_open": is_open,
            "current_time_npt": now.strftime("%Y-%m-%d %H:%M:%S"),
            "trading_hours": f"{self.open_time.strftime('%H:%M')} - {self.close_time.strftime('%H:%M')} NPT",
            "trading_days": "Sunday - Thursday",
            "force_open": self.force_open,
            "is_trading_day": self.is_trading_day(now),
            "is_within_hours": self.is_within_trading_hours(now),
        }

        if is_open and not self.force_open:
            # Time to close
            close_dt = now.replace(
                hour=self.close_time.hour,
                minute=self.close_time.minute,
                second=0,
                microsecond=0,
            )
            remaining = close_dt - now
            status["time_to_close_minutes"] = round(
                remaining.total_seconds() / 60, 1
            )
        elif not is_open and not self.force_open:
            next_open = self._get_next_open_time(now)
            if next_open:
                status["next_open"] = next_open.strftime("%Y-%m-%d %H:%M NPT")

        return status

    def _get_next_open_time(self, now: datetime) -> datetime:
        """Calculate the next market open time."""
        candidate = now.replace(
            hour=self.open_time.hour,
            minute=self.open_time.minute,
            second=0,
            microsecond=0,
        )

        # If we're past today's open time, start from tomorrow
        if now.time() >= self.open_time:
            candidate += timedelta(days=1)

        # Find next trading day
        for _ in range(10):
            if self.is_trading_day(candidate):
                return candidate
            candidate += timedelta(days=1)

        return candidate
