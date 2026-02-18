"""Lightweight ML-style advisory layer for alert decisions.

This module does not train a model at runtime. It computes a stable score from
live tick features and produces an action with confidence and rationale so the
frontend can guide users after creating/checking alerts.
"""

from dataclasses import dataclass, field
import math
from typing import Dict, List, Optional

from detection.spike_detector import SpikeDetector


@dataclass
class AlertRecommendation:
    """Advisory output for a symbol at the current tick."""

    symbol: str
    action: str
    confidence: float
    risk_level: str
    score: float
    reasons: List[str] = field(default_factory=list)
    features: Dict[str, float] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "action": self.action,
            "confidence": round(self.confidence, 3),
            "risk_level": self.risk_level,
            "score": round(self.score, 3),
            "reasons": self.reasons,
            "features": {k: round(v, 4) for k, v in self.features.items()},
        }


class AlertAdvisor:
    """Computes an ML-style recommendation from deterministic features."""

    def __init__(self, detector: Optional[SpikeDetector] = None):
        self.detector = detector or SpikeDetector()

        # Feature weights calibrated for stable behavior on NEPSE replay ticks.
        self._w_price = 0.60
        self._w_volume = 0.25
        self._w_momentum = 0.15

    @staticmethod
    def _clamp(value: float, min_value: float, max_value: float) -> float:
        return max(min_value, min(max_value, value))

    @staticmethod
    def _sigmoid(value: float) -> float:
        return 1.0 / (1.0 + math.exp(-value))

    def recommend(
        self,
        tick: dict,
        price_threshold_pct: Optional[float] = None,
        volume_threshold_multiplier: Optional[float] = None,
    ) -> AlertRecommendation:
        symbol = str(tick.get("symbol", "")).upper()
        price = float(tick.get("price", 0) or 0)
        prev_close = float(tick.get("prev_close", 0) or 0)
        day_open = float(tick.get("open", prev_close) or 0)
        volume = float(tick.get("volume", 0) or 0)
        avg_volume = float(tick.get("avg_volume", 0) or 0)

        price_threshold = (
            float(price_threshold_pct)
            if price_threshold_pct is not None
            else float(self.detector.default_price_threshold_pct)
        )
        volume_threshold = (
            float(volume_threshold_multiplier)
            if volume_threshold_multiplier is not None
            else float(self.detector.default_volume_threshold_multiplier)
        )

        change_pct = (
            float(tick.get("change_pct"))
            if tick.get("change_pct") is not None
            else (((price - prev_close) / prev_close) * 100.0 if prev_close > 0 else 0.0)
        )
        volume_ratio = (volume / avg_volume) if avg_volume > 0 else 1.0
        intraday_momentum = ((price - day_open) / day_open) * 100.0 if day_open > 0 else 0.0

        normalized_price = self._clamp(
            change_pct / max(price_threshold, 0.1),
            -2.0,
            2.0,
        )
        normalized_volume = self._clamp(
            (volume_ratio - 1.0) / max(volume_threshold - 1.0, 0.25),
            -1.0,
            2.0,
        )
        normalized_momentum = self._clamp(
            intraday_momentum / max(price_threshold, 0.1),
            -2.0,
            2.0,
        )

        score = (
            normalized_price * self._w_price
            + normalized_volume * self._w_volume
            + normalized_momentum * self._w_momentum
        )
        confidence = self._sigmoid(abs(score) * 2.0)

        if score >= 0.75:
            action = "buy"
        elif score <= -0.75:
            action = "sell"
        elif abs(score) >= 0.35:
            action = "watch"
        else:
            action = "hold"

        if abs(change_pct) >= price_threshold * 1.8 or volume_ratio >= volume_threshold * 1.8:
            risk_level = "high"
        elif abs(change_pct) >= price_threshold or volume_ratio >= volume_threshold:
            risk_level = "medium"
        else:
            risk_level = "low"

        reasons: List[str] = []
        if abs(change_pct) >= price_threshold:
            direction = "up" if change_pct > 0 else "down"
            reasons.append(
                f"Price moved {direction} {abs(change_pct):.2f}% (threshold {price_threshold:.2f}%)."
            )
        if volume_ratio >= volume_threshold:
            reasons.append(
                f"Volume is {volume_ratio:.2f}x average (threshold {volume_threshold:.2f}x)."
            )
        if not reasons:
            reasons.append("No strong spike signal yet; monitor before taking action.")

        return AlertRecommendation(
            symbol=symbol,
            action=action,
            confidence=confidence,
            risk_level=risk_level,
            score=score,
            reasons=reasons,
            features={
                "change_pct": change_pct,
                "volume_ratio": volume_ratio,
                "intraday_momentum_pct": intraday_momentum,
                "price_signal": normalized_price,
                "volume_signal": normalized_volume,
                "momentum_signal": normalized_momentum,
            },
        )

