"""REST API endpoints for stock market data and alerts, with Swagger docs."""

from flask import Blueprint, jsonify, request
from flasgger import swag_from

from data.stock_registry import get_all_symbols, get_stock_info, get_tracked_symbols

market_bp = Blueprint("market", __name__)

# These will be set by the app factory
_provider = None
_clock = None
_alert_manager = None


def init_market_routes(provider, clock, alert_manager):
    """Initialize route dependencies (called from server.py)."""
    global _provider, _clock, _alert_manager
    _provider = provider
    _clock = clock
    _alert_manager = alert_manager


@market_bp.route("/api/stocks", methods=["GET"])
def list_stocks():
    """List tracked NEPSE stocks with live simulated prices
    ---
    tags:
      - Stocks
    parameters:
      - name: all
        in: query
        type: string
        enum: ['true', 'false']
        default: 'false'
        description: Set to 'true' to list all 616 available stocks instead of just tracked ones
    responses:
      200:
        description: List of stocks with current prices
        schema:
          type: object
          properties:
            count:
              type: integer
              example: 12
            stocks:
              type: array
              items:
                type: object
                properties:
                  symbol:
                    type: string
                    example: NABIL
                  name:
                    type: string
                    example: Nabil Bank Limited
                  sector:
                    type: string
                    example: Commercial Bank
                  price:
                    type: number
                    example: 507.0
                  change:
                    type: number
                    example: -2.5
                  change_pct:
                    type: number
                    example: -0.49
                  volume:
                    type: integer
                    example: 18121
    """
    show_all = request.args.get("all", "false").lower() == "true"

    if show_all:
        symbols = get_all_symbols()
    else:
        symbols = _provider.get_available_symbols() if _provider else get_tracked_symbols()

    stocks = []
    for symbol in symbols:
        info = get_stock_info(symbol) or {}
        tick = _provider.get_latest_tick(symbol) if _provider else None

        stocks.append({
            "symbol": symbol,
            "name": info.get("name", symbol),
            "sector": info.get("sector", "Unknown"),
            "price": tick["price"] if tick else info.get("ltp", 0),
            "change": tick.get("change", 0) if tick else 0,
            "change_pct": tick.get("change_pct", 0) if tick else 0,
            "volume": tick.get("volume", 0) if tick else 0,
        })
    return jsonify({"stocks": stocks, "count": len(stocks)})


@market_bp.route("/api/stocks/<symbol>", methods=["GET"])
def get_stock(symbol: str):
    """Get current price data for a specific stock
    ---
    tags:
      - Stocks
    parameters:
      - name: symbol
        in: path
        type: string
        required: true
        description: Stock symbol (e.g. NABIL, UPPER, SCB)
    responses:
      200:
        description: Stock info with current tick data
        schema:
          type: object
          properties:
            symbol:
              type: string
              example: NABIL
            name:
              type: string
              example: Nabil Bank Limited
            sector:
              type: string
              example: Commercial Bank
            tick:
              type: object
              properties:
                price:
                  type: number
                  example: 507.0
                open:
                  type: number
                  example: 511.0
                high:
                  type: number
                  example: 511.0
                low:
                  type: number
                  example: 505.0
                prev_close:
                  type: number
                  example: 507.1
                volume:
                  type: integer
                  example: 18121
                change:
                  type: number
                  example: -0.1
                change_pct:
                  type: number
                  example: -0.02
                replay_date:
                  type: string
                  example: '2025-11-19'
                replay_day:
                  type: integer
                  example: 3
                replay_total_days:
                  type: integer
                  example: 7
      404:
        description: Stock not found
    """
    symbol = symbol.upper()
    info = get_stock_info(symbol)
    if not info:
        return jsonify({"error": f"Stock '{symbol}' not found"}), 404

    tick = _provider.get_latest_tick(symbol) if _provider else None
    return jsonify({
        "symbol": symbol,
        "name": info.get("name", symbol),
        "sector": info.get("sector", "Unknown"),
        "tick": tick,
    })


@market_bp.route("/api/stocks/<symbol>/history", methods=["GET"])
def get_stock_history(symbol: str):
    """Get real historical OHLCV data for a stock
    ---
    tags:
      - Stocks
    parameters:
      - name: symbol
        in: path
        type: string
        required: true
        description: Stock symbol (e.g. NABIL)
      - name: days
        in: query
        type: integer
        default: 50
        description: Number of most recent trading days to return
    responses:
      200:
        description: Historical OHLCV data in chronological order
        schema:
          type: object
          properties:
            symbol:
              type: string
            name:
              type: string
            period_days:
              type: integer
            count:
              type: integer
            data:
              type: array
              items:
                type: object
                properties:
                  date:
                    type: string
                    example: '2025-11-19'
                  open:
                    type: number
                    example: 511.0
                  high:
                    type: number
                    example: 511.0
                  low:
                    type: number
                    example: 505.0
                  close:
                    type: number
                    example: 507.0
                  volume:
                    type: integer
                    example: 18121
                  turnover:
                    type: number
                    example: 9178167.3
                  change_pct:
                    type: number
                    example: -0.02
      404:
        description: Stock not found
    """
    symbol = symbol.upper()
    info = get_stock_info(symbol)
    if not info:
        return jsonify({"error": f"Stock '{symbol}' not found"}), 404

    days = request.args.get("days", 50, type=int)
    history = _provider.get_history(symbol, days) if _provider else []
    return jsonify({
        "symbol": symbol,
        "name": info.get("name", symbol),
        "period_days": days,
        "data": history,
        "count": len(history),
    })


@market_bp.route("/api/market/status", methods=["GET"])
def market_status():
    """Get current NEPSE market open/close status
    ---
    tags:
      - Market
    responses:
      200:
        description: Market status info
        schema:
          type: object
          properties:
            is_open:
              type: boolean
              example: true
            current_time_npt:
              type: string
              example: '2025-11-19 13:30:00'
            trading_hours:
              type: string
              example: '11:00 - 15:00 NPT'
            trading_days:
              type: string
              example: Sunday - Thursday
            force_open:
              type: boolean
              example: true
            is_trading_day:
              type: boolean
              example: true
            is_within_hours:
              type: boolean
              example: true
    """
    if not _clock:
        return jsonify({"error": "Market clock not initialized"}), 500
    return jsonify(_clock.get_market_status())


@market_bp.route("/api/stocks/search", methods=["GET"])
def search_stocks():
    """Search for stocks by symbol or company name
    ---
    tags:
      - Stocks
    parameters:
      - name: q
        in: query
        type: string
        description: Search query — matches symbol or company name (e.g. 'NAB', 'Himalayan')
      - name: sector
        in: query
        type: string
        description: Filter by sector (e.g. 'Commercial Bank', 'Hydropower')
    responses:
      200:
        description: Matching stocks (max 50 results)
        schema:
          type: object
          properties:
            count:
              type: integer
            results:
              type: array
              items:
                type: object
                properties:
                  symbol:
                    type: string
                    example: NABIL
                  name:
                    type: string
                    example: Nabil Bank Limited
                  sector:
                    type: string
                    example: Commercial Bank
    """
    query = request.args.get("q", "").upper().strip()
    sector = request.args.get("sector", "").strip()

    all_symbols = get_all_symbols()
    results = []

    for symbol in all_symbols:
        info = get_stock_info(symbol) or {}
        name = info.get("name", "").upper()
        stock_sector = info.get("sector", "")

        if query and query not in symbol and query not in name:
            continue
        if sector and sector.lower() not in stock_sector.lower():
            continue

        results.append({
            "symbol": symbol,
            "name": info.get("name", symbol),
            "sector": stock_sector,
        })

        if len(results) >= 50:
            break

    return jsonify({"results": results, "count": len(results)})


@market_bp.route("/api/alerts/check", methods=["POST"])
def check_alert_threshold():
    """Check if a stock currently exceeds a given spike threshold
    ---
    tags:
      - Alerts
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          required:
            - symbol
          properties:
            symbol:
              type: string
              description: Stock symbol to check
              example: NABIL
            price_threshold_pct:
              type: number
              description: Price change percentage threshold
              example: 3.0
            volume_threshold_multiplier:
              type: number
              description: Volume spike multiplier above average
              example: 2.0
    responses:
      200:
        description: Alert check result with current tick and any triggered alerts
        schema:
          type: object
          properties:
            symbol:
              type: string
            current_tick:
              type: object
            alert_count:
              type: integer
            alerts:
              type: array
              items:
                type: object
                properties:
                  alert_type:
                    type: string
                    enum: [price, volume]
                  direction:
                    type: string
                    enum: [up, down]
                  magnitude:
                    type: number
                  current_value:
                    type: number
                  threshold:
                    type: number
                  reference_value:
                    type: number
                  symbol:
                    type: string
                  timestamp:
                    type: string
      400:
        description: Missing required field (symbol)
      404:
        description: No data available for the stock
    """
    data = request.get_json()
    if not data or "symbol" not in data:
        return jsonify({"error": "symbol is required"}), 400

    symbol = data["symbol"].upper()
    tick = _provider.get_latest_tick(symbol) if _provider else None
    if not tick:
        return jsonify({"error": f"No data available for '{symbol}'"}), 404

    from detection.spike_detector import SpikeDetector

    detector = SpikeDetector()
    alerts = detector.analyze_tick(
        tick,
        price_threshold_pct=data.get("price_threshold_pct"),
        volume_threshold_multiplier=data.get("volume_threshold_multiplier"),
    )

    return jsonify({
        "symbol": symbol,
        "current_tick": tick,
        "alerts": [a.to_dict() for a in alerts],
        "alert_count": len(alerts),
    })
