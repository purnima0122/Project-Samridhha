"""Alert subscription manager — manages per-user threshold configurations.

Matches incoming ticks against all active alert subscriptions and
emits triggered alerts with cooldown deduplication.
"""

import logging
import time
from dataclasses import dataclass, field
from typing import Callable, Dict, List, Optional

from config import Config
from detection.spike_detector import SpikeAlert, SpikeDetector

logger = logging.getLogger(__name__)


@dataclass
class AlertSubscription:
    """A user's alert configuration for a specific stock."""

    user_id: str
    symbol: str
    price_threshold_pct: float = 3.0
    volume_threshold_multiplier: float = 2.0
    enabled: bool = True


class AlertManager:
    """Manages user alert subscriptions and processes ticks against them.

    Features:
    - Per-user, per-symbol threshold configurations
    - Cooldown window to prevent duplicate alerts
    - Callback-based alert emission
    """

    def __init__(self, detector: Optional[SpikeDetector] = None):
        self.detector = detector or SpikeDetector(
            default_price_threshold_pct=Config.DEFAULT_PRICE_THRESHOLD_PCT,
            default_volume_threshold_multiplier=Config.DEFAULT_VOLUME_THRESHOLD_MULTIPLIER,
        )
        self._subscriptions: Dict[str, Dict[str, AlertSubscription]] = {}
        # Cooldown tracking: (user_id, symbol, alert_type) -> last_alert_time
        self._cooldowns: Dict[tuple, float] = {}
        self._cooldown_seconds = Config.ALERT_COOLDOWN_SECONDS
        self._alert_listeners: List[Callable] = []

    def on_alert(self, callback: Callable[[str, SpikeAlert], None]):
        """Register a callback for triggered alerts.

        Callback receives (user_id, alert).
        """
        self._alert_listeners.append(callback)

    def add_subscription(
        self,
        user_id: str,
        symbol: str,
        price_threshold_pct: float = 3.0,
        volume_threshold_multiplier: float = 2.0,
    ) -> AlertSubscription:
        """Add or update a user's alert subscription for a stock."""
        symbol = symbol.upper()
        if user_id not in self._subscriptions:
            self._subscriptions[user_id] = {}

        sub = AlertSubscription(
            user_id=user_id,
            symbol=symbol,
            price_threshold_pct=price_threshold_pct,
            volume_threshold_multiplier=volume_threshold_multiplier,
        )
        self._subscriptions[user_id][symbol] = sub
        logger.info(
            f"Alert subscription added: user={user_id}, symbol={symbol}, "
            f"price={price_threshold_pct}%, volume={volume_threshold_multiplier}x"
        )
        return sub

    def remove_subscription(self, user_id: str, symbol: str) -> bool:
        """Remove a user's alert subscription for a stock."""
        symbol = symbol.upper()
        if user_id in self._subscriptions and symbol in self._subscriptions[user_id]:
            del self._subscriptions[user_id][symbol]
            return True
        return False

    def get_subscriptions(self, user_id: str) -> List[dict]:
        """Get all alert subscriptions for a user."""
        if user_id not in self._subscriptions:
            return []
        return [
            {
                "symbol": sub.symbol,
                "price_threshold_pct": sub.price_threshold_pct,
                "volume_threshold_multiplier": sub.volume_threshold_multiplier,
                "enabled": sub.enabled,
            }
            for sub in self._subscriptions[user_id].values()
        ]

    def process_ticks(self, ticks: Dict[str, dict]) -> List[dict]:
        """Process a batch of ticks against all active subscriptions.

        Args:
            ticks: Dict mapping symbol -> tick data

        Returns:
            List of triggered alert dicts
        """
        triggered = []

        for user_id, user_subs in self._subscriptions.items():
            for symbol, sub in user_subs.items():
                if not sub.enabled:
                    continue
                if symbol not in ticks:
                    continue

                tick = ticks[symbol]
                alerts = self.detector.analyze_tick(
                    tick,
                    price_threshold_pct=sub.price_threshold_pct,
                    volume_threshold_multiplier=sub.volume_threshold_multiplier,
                )

                for alert in alerts:
                    if self._is_in_cooldown(user_id, symbol, alert.alert_type):
                        continue

                    self._set_cooldown(user_id, symbol, alert.alert_type)
                    triggered.append(
                        {
                            "user_id": user_id,
                            "alert": alert.to_dict(),
                        }
                    )

                    # Notify listeners
                    for listener in self._alert_listeners:
                        try:
                            listener(user_id, alert)
                        except Exception as e:
                            logger.error(f"Error in alert listener: {e}")

        return triggered

    def _is_in_cooldown(self, user_id: str, symbol: str, alert_type: str) -> bool:
        """Check if an alert is within the cooldown window."""
        key = (user_id, symbol, alert_type)
        last_time = self._cooldowns.get(key, 0)
        return (time.time() - last_time) < self._cooldown_seconds

    def _set_cooldown(self, user_id: str, symbol: str, alert_type: str):
        """Set the cooldown timestamp for an alert."""
        key = (user_id, symbol, alert_type)
        self._cooldowns[key] = time.time()

    def clear_cooldowns(self):
        """Clear all cooldowns (useful for testing)."""
        self._cooldowns.clear()
