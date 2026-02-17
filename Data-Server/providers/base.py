"""Abstract base class for data providers — provider-agnostic architecture."""

from abc import ABC, abstractmethod
from typing import Callable, Dict, List, Optional


class DataProvider(ABC):
    """Interface that all data providers must implement.

    This abstraction allows swapping between the simulator and a live
    NEPSE API feed without changing application logic.
    """

    @abstractmethod
    def get_latest_tick(self, symbol: str) -> Optional[dict]:
        """Get the latest price/volume tick for a symbol.

        Returns:
            dict with keys: symbol, price, volume, change, change_pct,
                            high, low, open, timestamp
        """
        pass

    @abstractmethod
    def get_history(self, symbol: str, days: int = 50) -> List[dict]:
        """Get historical OHLCV data for a symbol.

        Returns:
            List of dicts with keys: date, open, high, low, close, volume
        """
        pass

    @abstractmethod
    def get_all_ticks(self) -> Dict[str, dict]:
        """Get latest ticks for all tracked symbols."""
        pass

    @abstractmethod
    def generate_tick(self, symbol: str) -> dict:
        """Generate / fetch a new tick for a symbol and update internal state."""
        pass

    @abstractmethod
    def get_available_symbols(self) -> List[str]:
        """Return list of all available stock symbols."""
        pass

    def subscribe(self, symbol: str, callback: Callable[[dict], None]) -> None:
        """Subscribe to tick updates for a symbol (optional override)."""
        pass

    def unsubscribe(self, symbol: str, callback: Callable[[dict], None]) -> None:
        """Unsubscribe from tick updates (optional override)."""
        pass
