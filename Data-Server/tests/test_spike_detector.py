"""Tests for the deterministic spike detector."""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from detection.spike_detector import SpikeDetector


def test_price_spike_up():
    """Price increase above threshold should trigger alert."""
    detector = SpikeDetector(default_price_threshold_pct=3.0)

    alert = detector.check_price_spike(
        symbol="NABIL",
        current_price=1300.0,
        prev_close=1250.0,  # 4% increase
    )
    assert alert is not None, "Should detect 4% price spike"
    assert alert.direction == "up"
    assert alert.alert_type == "price"
    assert alert.magnitude >= 3.0
    print("  ✅ Price spike UP detected correctly")


def test_price_spike_down():
    """Price decrease above threshold should trigger alert."""
    detector = SpikeDetector(default_price_threshold_pct=3.0)

    alert = detector.check_price_spike(
        symbol="NABIL",
        current_price=1200.0,
        prev_close=1250.0,  # -4% decrease
    )
    assert alert is not None, "Should detect -4% price spike"
    assert alert.direction == "down"
    assert alert.alert_type == "price"
    print("  ✅ Price spike DOWN detected correctly")


def test_no_price_spike():
    """Price change below threshold should NOT trigger alert."""
    detector = SpikeDetector(default_price_threshold_pct=3.0)

    alert = detector.check_price_spike(
        symbol="NABIL",
        current_price=1260.0,
        prev_close=1250.0,  # 0.8% — below threshold
    )
    assert alert is None, "Should NOT detect small price change"
    print("  ✅ Small price change correctly ignored")


def test_volume_spike():
    """Volume above threshold multiplier should trigger alert."""
    detector = SpikeDetector(default_volume_threshold_multiplier=2.0)

    alert = detector.check_volume_spike(
        symbol="NABIL",
        current_volume=100000,
        avg_volume=40000,  # 2.5x average
    )
    assert alert is not None, "Should detect 2.5x volume spike"
    assert alert.alert_type == "volume"
    assert alert.direction == "up"
    print("  ✅ Volume spike detected correctly")


def test_no_volume_spike():
    """Volume below threshold should NOT trigger alert."""
    detector = SpikeDetector(default_volume_threshold_multiplier=2.0)

    alert = detector.check_volume_spike(
        symbol="NABIL",
        current_volume=50000,
        avg_volume=40000,  # 1.25x — below threshold
    )
    assert alert is None, "Should NOT detect normal volume"
    print("  ✅ Normal volume correctly ignored")


def test_custom_thresholds():
    """Custom thresholds should override defaults."""
    detector = SpikeDetector(
        default_price_threshold_pct=3.0,
        default_volume_threshold_multiplier=2.0,
    )

    # Use a tighter threshold (1%)
    alert = detector.check_price_spike(
        symbol="NABIL",
        current_price=1265.0,
        prev_close=1250.0,  # 1.2% change
        threshold_pct=1.0,  # Custom 1% threshold
    )
    assert alert is not None, "Should detect 1.2% spike with 1% threshold"
    print("  ✅ Custom thresholds work correctly")


def test_analyze_tick():
    """Full tick analysis should check both price and volume."""
    detector = SpikeDetector(
        default_price_threshold_pct=3.0,
        default_volume_threshold_multiplier=2.0,
    )

    tick = {
        "symbol": "NABIL",
        "price": 1320.0,
        "prev_close": 1250.0,  # 5.6% spike
        "volume": 120000,
        "avg_volume": 45000,  # 2.67x volume spike
    }

    alerts = detector.analyze_tick(tick)
    assert len(alerts) == 2, f"Expected 2 alerts (price + volume), got {len(alerts)}"
    types = {a.alert_type for a in alerts}
    assert "price" in types and "volume" in types
    print("  ✅ Full tick analysis detects both price and volume spikes")


def test_spike_alert_serialization():
    """SpikeAlert.to_dict() should produce a valid dict."""
    detector = SpikeDetector()
    alert = detector.check_price_spike("NABIL", 1300.0, 1250.0)
    assert alert is not None

    d = alert.to_dict()
    required_keys = [
        "symbol", "alert_type", "direction", "magnitude",
        "current_value", "threshold", "reference_value", "timestamp",
    ]
    for key in required_keys:
        assert key in d, f"Missing key in serialized alert: {key}"
    print("  ✅ SpikeAlert serialization is correct")


if __name__ == "__main__":
    print("\n📊 Spike Detector Tests")
    print("-" * 40)
    test_price_spike_up()
    test_price_spike_down()
    test_no_price_spike()
    test_volume_spike()
    test_no_volume_spike()
    test_custom_thresholds()
    test_analyze_tick()
    test_spike_alert_serialization()
    print("\n✅ All spike detector tests passed!\n")
