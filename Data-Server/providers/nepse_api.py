"""Stub provider for future live NEPSE API integration.

This provider implements the DataProvider interface but returns placeholder
data. Replace the implementation with actual NEPSE API calls when a live
data feed becomes available.
"""

from typing import Callable, Dict, List, Optional

from data.stock_registry import get_all_symbols, get_historical_data
from providers.base import DataProvider


class NepseApiProvider(DataProvider):
    """Placeholder for live NEPSE API data feed.

    TODO: Integrate with real NEPSE API when available.
    The provider-agnostic architecture ensures no structural changes
    are needed — just implement these methods with real API calls.
    """

    def __init__(self, api_base_url: str = ""):
        self.api_base_url = api_base_url

    def get_latest_tick(self, symbol: str) -> Optional[dict]:
        raise NotImplementedError(
            "Live NEPSE API integration is not yet implemented. "
            "Use DATA_PROVIDER=simulator in your .env file."
        )

    def get_history(self, symbol: str, days: int = 50) -> List[dict]:
        return get_historical_data(symbol.upper(), days=days)

    def get_all_ticks(self) -> Dict[str, dict]:
        raise NotImplementedError("Live NEPSE API integration is not yet implemented.")

    def generate_tick(self, symbol: str) -> dict:
        raise NotImplementedError("Live NEPSE API integration is not yet implemented.")

    def get_available_symbols(self) -> List[str]:
        return get_all_symbols()

    def subscribe(self, symbol: str, callback: Callable[[dict], None]) -> None:
        pass

    def unsubscribe(self, symbol: str, callback: Callable[[dict], None]) -> None:
        pass
