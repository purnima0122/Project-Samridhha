"""Deterministic rule-based spike detection engine.

Triggers alerts when user-defined price or volume thresholds are crossed.
100% threshold-based accuracy — no ML uncertainty.
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class SpikeAlert:
    """Represents a detected spike event."""

    symbol: str
    alert_type: str  # "price" or "volume"
    direction: str  # "up" or "down"
    magnitude: float  # percentage change or volume multiplier
    current_value: float
    threshold: float
    reference_value: float
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "alert_type": self.alert_type,
            "direction": self.direction,
            "magnitude": round(self.magnitude, 2),
            "current_value": round(self.current_value, 2),
            "threshold": round(self.threshold, 2),
            "reference_value": round(self.reference_value, 2),
            "timestamp": self.timestamp,
        }


class SpikeDetector:
    """Detects price and volume spikes using deterministic rules.

    Price spike: |current_price - prev_close| / prev_close >= threshold%
    Volume spike: current_volume / avg_volume >= threshold_multiplier
    """

    def __init__(
        self,
        default_price_threshold_pct: float = 3.0,
        default_volume_threshold_multiplier: float = 2.0,
    ):
        self.default_price_threshold_pct = default_price_threshold_pct
        self.default_volume_threshold_multiplier = default_volume_threshold_multiplier

    def check_price_spike(
        self,
        symbol: str,
        current_price: float,
        prev_close: float,
        threshold_pct: Optional[float] = None,
    ) -> Optional[SpikeAlert]:
        """Check if the price change exceeds the threshold.

        Args:
            symbol: Stock symbol
            current_price: Current market price
            prev_close: Previous session close price
            threshold_pct: Custom threshold (default from config)

        Returns:
            SpikeAlert if threshold is crossed, None otherwise
        """
        if prev_close <= 0:
            return None

        threshold = threshold_pct or self.default_price_threshold_pct
        change_pct = ((current_price - prev_close) / prev_close) * 100.0

        if abs(change_pct) >= threshold:
            direction = "up" if change_pct > 0 else "down"
            return SpikeAlert(
                symbol=symbol,
                alert_type="price",
                direction=direction,
                magnitude=abs(change_pct),
                current_value=current_price,
                threshold=threshold,
                reference_value=prev_close,
            )
        return None

    def check_volume_spike(
        self,
        symbol: str,
        current_volume: int,
        avg_volume: float,
        threshold_multiplier: Optional[float] = None,
    ) -> Optional[SpikeAlert]:
        """Check if volume exceeds the threshold multiplier of average.

        Args:
            symbol: Stock symbol
            current_volume: Current session volume
            avg_volume: Average volume (e.g., 20-day average)
            threshold_multiplier: Custom threshold (default from config)

        Returns:
            SpikeAlert if threshold is crossed, None otherwise
        """
        if avg_volume <= 0:
            return None

        threshold = threshold_multiplier or self.default_volume_threshold_multiplier
        volume_ratio = current_volume / avg_volume

        if volume_ratio >= threshold:
            return SpikeAlert(
                symbol=symbol,
                alert_type="volume",
                direction="up",
                magnitude=round(volume_ratio, 2),
                current_value=current_volume,
                threshold=threshold,
                reference_value=avg_volume,
            )
        return None

    def analyze_tick(
        self,
        tick: dict,
        price_threshold_pct: Optional[float] = None,
        volume_threshold_multiplier: Optional[float] = None,
    ) -> List[SpikeAlert]:
        """Analyze a tick for both price and volume spikes.

        Args:
            tick: Tick dict with keys: symbol, price, prev_close, volume, avg_volume
            price_threshold_pct: Custom price threshold
            volume_threshold_multiplier: Custom volume threshold

        Returns:
            List of detected SpikeAlerts (may be empty)
        """
        alerts = []

        price_alert = self.check_price_spike(
            symbol=tick["symbol"],
            current_price=tick["price"],
            prev_close=tick.get("prev_close", tick.get("open", 0)),
            threshold_pct=price_threshold_pct,
        )
        if price_alert:
            alerts.append(price_alert)

        volume_alert = self.check_volume_spike(
            symbol=tick["symbol"],
            current_volume=tick.get("volume", 0),
            avg_volume=tick.get("avg_volume", 1),
            threshold_multiplier=volume_threshold_multiplier,
        )
        if volume_alert:
            alerts.append(volume_alert)

        return alerts
