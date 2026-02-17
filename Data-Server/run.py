"""STOCKLEARN Data Server — Main entry point.

A Python-based market simulation and spike detection server that:
- Simulates real-time NEPSE stock price/volume ticks
- Detects price and volume spikes using deterministic rules
- Broadcasts data via WebSocket (Socket.IO)
- Exposes REST APIs for stock data and market status
"""

import logging
import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask
from flask_cors import CORS
from flask_socketio import SocketIO
from flasgger import Swagger

from config import Config
from detection.alert_manager import AlertManager
from detection.spike_detector import SpikeDetector
from engine.market_clock import MarketClock
from engine.market_engine import MarketEngine
from providers.provider_factory import create_provider
from routes.health_routes import health_bp
from routes.market_routes import init_market_routes, market_bp
from sockets.handlers import (
    broadcast_alert,
    broadcast_market_status,
    broadcast_ticks,
    init_socket_handlers,
)

# ─── Logging Setup ───────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("Data-Server")


def create_app() -> tuple:
    """Create and configure the Flask application."""

    # ─── Flask App ────────────────────────────────────────────────────────────
    app = Flask(__name__)
    app.config["SECRET_KEY"] = "kjfngaskjdnfklajsbdlihh;acvkjn98e"
    CORS(app)  # Enable CORS for all routes

    # ─── Swagger API Docs ─────────────────────────────────────────────────────
    app.config["SWAGGER"] = {
        "title": "Project Samridhha Data Server API",
        "description": (
            "Real-time NEPSE market simulation and spike detection server.\n\n"
            "Replays real historical NEPSE stock data with intraday tick interpolation.\n"
            "Supports 616+ stocks, WebSocket broadcasting, and deterministic spike alerts."
        ),
        "version": "1.0.0",
        "termsOfService": "",
        "specs_route": "/apidocs/",
    }
    swagger = Swagger(app)

    # ─── Socket.IO ────────────────────────────────────────────────────────────
    socketio = SocketIO(
        app,
        cors_allowed_origins=Config.CORS_ORIGIN,
        async_mode="threading",
        logger=False,
        engineio_logger=False,
    )

    # ─── Core Components ─────────────────────────────────────────────────────
    logger.info("Initializing Project Samridhha Data Server...")

    # 1. Data Provider (simulator or NEPSE API)
    provider = create_provider()
    logger.info(f"Data provider: {Config.DATA_PROVIDER}")

    # 2. Market Clock (NEPSE hours)
    clock = MarketClock()
    market_status = clock.get_market_status()
    logger.info(
        f"Market clock: {market_status['trading_hours']}, "
        f"Force open: {clock.force_open}, "
        f"Currently: {'OPEN' if market_status['is_open'] else 'CLOSED'}"
    )

    # 3. Spike Detector + Alert Manager
    detector = SpikeDetector(
        default_price_threshold_pct=Config.DEFAULT_PRICE_THRESHOLD_PCT,
        default_volume_threshold_multiplier=Config.DEFAULT_VOLUME_THRESHOLD_MULTIPLIER,
    )
    alert_manager = AlertManager(detector=detector)
    logger.info(
        f"Spike detector: price≥{Config.DEFAULT_PRICE_THRESHOLD_PCT}%, "
        f"volume≥{Config.DEFAULT_VOLUME_THRESHOLD_MULTIPLIER}x"
    )

    # 4. Market Engine
    engine = MarketEngine(provider=provider, clock=clock)

    # ─── Wire Up Event Handlers ──────────────────────────────────────────────

    # On every tick batch: run spike detection + broadcast
    def on_tick_batch(ticks: dict):
        # Broadcast raw ticks
        broadcast_ticks(socketio, ticks)

        # Run spike detection against all user subscriptions
        triggered = alert_manager.process_ticks(ticks)
        for entry in triggered:
            broadcast_alert(socketio, entry["user_id"], entry["alert"])

    engine.on_tick(on_tick_batch)

    # On market status change
    def on_market_status(event: dict):
        broadcast_market_status(socketio, event)

    engine.on_market_status_change(on_market_status)

    # Alert manager callback — broadcast individual alerts
    def on_alert_triggered(user_id: str, alert):
        broadcast_alert(socketio, user_id, alert)

    alert_manager.on_alert(on_alert_triggered)

    # ─── Register Routes & Socket Handlers ───────────────────────────────────
    app.register_blueprint(health_bp)
    app.register_blueprint(market_bp)
    init_market_routes(provider, clock, alert_manager)
    init_socket_handlers(socketio, provider, alert_manager)

    # ─── Start Engine ────────────────────────────────────────────────────────
    engine.start()
    logger.info(
        f"Market engine started (tick interval: {Config.TICK_INTERVAL_SECONDS}s)"
    )

    return app, socketio, engine


def main():
    """Run the Data Server."""
    app, socketio, engine = create_app()

    logger.info("=" * 60)
    logger.info("  Project Samridhha Data Server")
    logger.info(f"  http://{Config.HOST}:{Config.PORT}")
    logger.info(f"  Swagger: http://{Config.HOST}:{Config.PORT}/apidocs")
    logger.info(f"  WebSocket: ws://{Config.HOST}:{Config.PORT}")
    logger.info("=" * 60)

    try:
        socketio.run(
            app,
            host=Config.HOST,
            port=Config.PORT,
            debug=Config.DEBUG,
            use_reloader=False,  # Don't reload — engine thread stays alive
            allow_unsafe_werkzeug=True,
        )
    except KeyboardInterrupt:
        logger.info("Shutting down...")
        engine.stop()


if __name__ == "__main__":
    main()
