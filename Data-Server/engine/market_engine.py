"""Market simulation engine — generates real-time ticks for all tracked stocks.

Orchestrates the simulation loop: checks market hours, generates ticks
for all symbols, runs spike detection, and emits events.
"""

import logging
import threading
import time as time_mod
from typing import Callable, List, Optional

from config import Config
from engine.market_clock import MarketClock
from providers.base import DataProvider

logger = logging.getLogger(__name__)


class MarketEngine:
    """Core simulation engine that drives the market data loop.

    Responsibilities:
    - Generates price/volume ticks on a configurable interval
    - Respects NEPSE market hours via MarketClock
    - Calls registered tick listeners for downstream processing
    - Manages the simulation lifecycle (start/stop/reset)
    """

    def __init__(self, provider: DataProvider, clock: MarketClock):
        self.provider = provider
        self.clock = clock
        self.tick_interval = Config.TICK_INTERVAL_SECONDS
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._tick_listeners: List[Callable] = []
        self._market_status_listeners: List[Callable] = []
        self._was_open = False

    def on_tick(self, callback: Callable[[dict], None]):
        """Register a callback to be called on every tick batch."""
        self._tick_listeners.append(callback)

    def on_market_status_change(self, callback: Callable[[dict], None]):
        """Register a callback for market open/close events."""
        self._market_status_listeners.append(callback)

    def start(self):
        """Start the market simulation loop in a background thread."""
        if self._running:
            logger.warning("Market engine is already running")
            return

        self._running = True
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()
        logger.info(
            f"Market engine started (interval={self.tick_interval}s, "
            f"force_open={self.clock.force_open})"
        )

    def stop(self):
        """Stop the market simulation loop."""
        self._running = False
        if self._thread:
            self._thread.join(timeout=10)
        logger.info("Market engine stopped")

    def _run_loop(self):
        """Main simulation loop."""
        while self._running:
            try:
                is_open = self.clock.is_market_open()

                # Detect market status changes
                if is_open and not self._was_open:
                    logger.info("Market OPENED")
                    self._emit_market_status("opened")
                    # Reset session prices
                    if hasattr(self.provider, "reset_session"):
                        self.provider.reset_session()
                elif not is_open and self._was_open:
                    logger.info("Market CLOSED")
                    self._emit_market_status("closed")

                self._was_open = is_open

                if is_open:
                    self._generate_all_ticks()

                time_mod.sleep(self.tick_interval)

            except Exception as e:
                logger.error(f"Error in market engine loop: {e}", exc_info=True)
                time_mod.sleep(self.tick_interval)

    def _generate_all_ticks(self):
        """Generate ticks for all tracked symbols and notify listeners."""
        all_ticks = {}
        for symbol in self.provider.get_available_symbols():
            try:
                tick = self.provider.generate_tick(symbol)
                all_ticks[symbol] = tick
            except Exception as e:
                logger.error(f"Error generating tick for {symbol}: {e}")

        if all_ticks:
            for listener in self._tick_listeners:
                try:
                    listener(all_ticks)
                except Exception as e:
                    logger.error(f"Error in tick listener: {e}")

    def _emit_market_status(self, status: str):
        """Emit market status change event."""
        event = {
            "status": status,
            "details": self.clock.get_market_status(),
        }
        for listener in self._market_status_listeners:
            try:
                listener(event)
            except Exception as e:
                logger.error(f"Error in market status listener: {e}")

    def generate_single_tick(self, symbol: str) -> Optional[dict]:
        """Generate a single tick for a specific symbol (for testing/manual use)."""
        try:
            return self.provider.generate_tick(symbol)
        except Exception as e:
            logger.error(f"Error generating tick for {symbol}: {e}")
            return None
