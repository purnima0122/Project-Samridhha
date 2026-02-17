"""WebSocket event handlers for real-time market data broadcasting."""

import logging

from flask_socketio import SocketIO, emit, join_room, leave_room

logger = logging.getLogger(__name__)

# Module-level reference set by init_socket_handlers
_alert_manager = None
_provider = None


def init_socket_handlers(socketio: SocketIO, provider, alert_manager):
    """Register all WebSocket event handlers."""
    global _alert_manager, _provider
    _alert_manager = alert_manager
    _provider = provider

    @socketio.on("connect")
    def handle_connect():
        logger.info("Client connected")
        emit("server:welcome", {
            "message": "Connected to Data Server WS",
            "available_events": [
                "tick:update",
                "alert:triggered",
                "market:status",
            ],
        })

    @socketio.on("disconnect")
    def handle_disconnect():
        logger.info("Client disconnected")

    @socketio.on("subscribe:stock")
    def handle_subscribe_stock(data):
        """Subscribe to tick updates for specific stocks.

        Data: { "symbols": ["NABIL", "UPPER"] }
        """
        symbols = data.get("symbols", [])
        for symbol in symbols:
            join_room(f"stock:{symbol.upper()}")
            logger.info(f"Client subscribed to stock:{symbol.upper()}")
        emit("subscribed", {"symbols": [s.upper() for s in symbols]})

    @socketio.on("unsubscribe:stock")
    def handle_unsubscribe_stock(data):
        """Unsubscribe from tick updates for specific stocks.

        Data: { "symbols": ["NABIL"] }
        """
        symbols = data.get("symbols", [])
        for symbol in symbols:
            leave_room(f"stock:{symbol.upper()}")
        emit("unsubscribed", {"symbols": [s.upper() for s in symbols]})

    @socketio.on("set:threshold")
    def handle_set_threshold(data):
        """Set alert threshold for a user.

        Data: {
            "user_id": "abc123",
            "symbol": "NABIL",
            "price_threshold_pct": 3.0,
            "volume_threshold_multiplier": 2.0
        }
        """
        if not _alert_manager:
            emit("error", {"message": "Alert manager not initialized"})
            return

        user_id = data.get("user_id", "anonymous")
        symbol = data.get("symbol", "")
        price_pct = data.get("price_threshold_pct", 3.0)
        volume_mult = data.get("volume_threshold_multiplier", 2.0)

        if not symbol:
            emit("error", {"message": "symbol is required"})
            return

        sub = _alert_manager.add_subscription(
            user_id=user_id,
            symbol=symbol,
            price_threshold_pct=price_pct,
            volume_threshold_multiplier=volume_mult,
        )
        emit("threshold:set", {
            "symbol": sub.symbol,
            "price_threshold_pct": sub.price_threshold_pct,
            "volume_threshold_multiplier": sub.volume_threshold_multiplier,
        })

    @socketio.on("get:subscriptions")
    def handle_get_subscriptions(data):
        """Get all alert subscriptions for a user.

        Data: { "user_id": "abc123" }
        """
        user_id = data.get("user_id", "anonymous")
        subs = _alert_manager.get_subscriptions(user_id) if _alert_manager else []
        emit("subscriptions:list", {"user_id": user_id, "subscriptions": subs})


def broadcast_ticks(socketio: SocketIO, ticks: dict):
    """Broadcast tick updates to all connected clients and stock-specific rooms."""
    # Broadcast all ticks to everyone
    socketio.emit("tick:update", {"ticks": ticks})

    # Also broadcast to stock-specific rooms
    for symbol, tick in ticks.items():
        socketio.emit("tick:update", {"tick": tick}, room=f"stock:{symbol}")


def broadcast_alert(socketio: SocketIO, user_id: str, alert):
    """Broadcast a triggered alert."""
    alert_data = {
        "user_id": user_id,
        "alert": alert.to_dict() if hasattr(alert, "to_dict") else alert,
    }
    socketio.emit("alert:triggered", alert_data)
    logger.info(f"Alert broadcast: {alert_data['alert']['symbol']} - {alert_data['alert']['alert_type']}")


def broadcast_market_status(socketio: SocketIO, status: dict):
    """Broadcast market status change to all clients."""
    socketio.emit("market:status", status)
