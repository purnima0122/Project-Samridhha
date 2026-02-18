"""Tests for AI/ML-style alert advisor scoring."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from detection.alert_advisor import AlertAdvisor
from detection.spike_detector import SpikeDetector


def test_advisor_recommendation_fields():
    advisor = AlertAdvisor(detector=SpikeDetector())
    tick = {
        "symbol": "NABIL",
        "price": 1320.0,
        "open": 1260.0,
        "prev_close": 1250.0,
        "volume": 120000,
        "avg_volume": 45000,
        "change_pct": 5.6,
    }

    rec = advisor.recommend(tick)
    payload = rec.to_dict()

    assert payload["symbol"] == "NABIL"
    assert payload["action"] in {"buy", "sell", "watch", "hold"}
    assert 0 <= payload["confidence"] <= 1
    assert payload["risk_level"] in {"low", "medium", "high"}
    assert isinstance(payload["reasons"], list) and len(payload["reasons"]) > 0


def test_advisor_sell_signal_on_negative_spike():
    advisor = AlertAdvisor(detector=SpikeDetector())
    tick = {
        "symbol": "NABIL",
        "price": 1120.0,
        "open": 1240.0,
        "prev_close": 1250.0,
        "volume": 130000,
        "avg_volume": 50000,
        "change_pct": -10.4,
    }

    rec = advisor.recommend(tick, price_threshold_pct=3.0, volume_threshold_multiplier=2.0)
    assert rec.action in {"sell", "watch"}
    assert rec.confidence >= 0.5

