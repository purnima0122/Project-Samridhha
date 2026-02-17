"""Centralized configuration loaded from environment variables."""

import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    """Application configuration."""

    # Server
    PORT = int(os.getenv("PORT", "4000"))
    HOST = os.getenv("HOST", "0.0.0.0")
    DEBUG = os.getenv("DEBUG", "true").lower() == "true"

    # Market simulation
    TICK_INTERVAL_SECONDS = int(os.getenv("TICK_INTERVAL_SECONDS", "5"))
    DATA_PROVIDER = os.getenv("DATA_PROVIDER", "simulator")

    # NEPSE Market Hours
    MARKET_TIMEZONE = os.getenv("MARKET_TIMEZONE", "Asia/Kathmandu")
    MARKET_OPEN_HOUR = int(os.getenv("MARKET_OPEN_HOUR", "11"))
    MARKET_OPEN_MINUTE = int(os.getenv("MARKET_OPEN_MINUTE", "0"))
    MARKET_CLOSE_HOUR = int(os.getenv("MARKET_CLOSE_HOUR", "15"))
    MARKET_CLOSE_MINUTE = int(os.getenv("MARKET_CLOSE_MINUTE", "0"))

    # Force market open (for testing outside NEPSE hours)
    FORCE_MARKET_OPEN = os.getenv("FORCE_MARKET_OPEN", "true").lower() == "true"

    # Spike detection defaults
    DEFAULT_PRICE_THRESHOLD_PCT = float(
        os.getenv("DEFAULT_PRICE_THRESHOLD_PCT", "3.0")
    )
    DEFAULT_VOLUME_THRESHOLD_MULTIPLIER = float(
        os.getenv("DEFAULT_VOLUME_THRESHOLD_MULTIPLIER", "2.0")
    )
    ALERT_COOLDOWN_SECONDS = int(os.getenv("ALERT_COOLDOWN_SECONDS", "300"))

    # CORS
    CORS_ORIGIN = os.getenv("CORS_ORIGIN", "*")

    # NEPSE trading days (0=Monday, 6=Sunday) — Sunday to Thursday
    MARKET_TRADING_DAYS = [6, 0, 1, 2, 3]  # Sun, Mon, Tue, Wed, Thu

    # Nepal public holidays (configurable, MM-DD format)
    PUBLIC_HOLIDAYS = os.getenv("PUBLIC_HOLIDAYS", "").split(",")
