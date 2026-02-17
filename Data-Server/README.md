# Project Samridhha Data Server

**AI/Market Logic System** — A Python-based market simulation and spike detection server for the Project Samridhha.

## Features

- **Real NEPSE data**: Dynamically loads from 616+ real stock CSV files.
- **Real-time market simulation**: Generates realistic price/volume ticks seeded from actual historical prices and volatility
- **Deterministic spike detection**: Rule-based alerts when user-defined thresholds are crossed (100% accuracy, no ML uncertainty)
- **NEPSE market clock**: Synchronized with official trading hours (Sun–Thu, 11:00 AM – 3:00 PM NPT)
- **NEPSE ±10% circuit breaker**: Simulation respects real NEPSE price limits
- **WebSocket broadcasting**: Real-time tick updates and alert notifications via Socket.IO
- **REST API**: Stock data, search, market status, and alert management
- **Provider-agnostic**: Drop-in replacement for live NEPSE API when available

## Data Source

The server reads real NEPSE data from the sibling `Data/` directory:

```
Project-Samridhha/
├── Data/
│   ├── company_list.csv          # 500+ companies with sector, LTP, market cap
│   └── price_history/            # 616 individual stock CSV files
│       ├── nabil_price_history.csv
│       ├── upper_price_history.csv
│       └── ...
└── Data-Server/                  # This server
```

### Default Tracked Stocks (12)

| Symbol | Name | Sector |
|--------|------|--------|
| NABIL | Nabil Bank Limited | Commercial Bank |
| NLIC | Nepal Life Insurance Company Limited | Life Insurance |
| SCB | Standard Chartered Bank Nepal Limited | Commercial Bank |
| UPPER | Upper Tamakoshi Hydropower Limited | Hydropower |
| HDL | Himalayan Distillery Limited | Manufacturing and Processing |
| NHPC | Nepal Hydro Power Company Limited | Hydropower |
| SBI | Nepal SBI Bank Limited | Commercial Bank |
| EBL | Everest Bank Limited | Commercial Bank |
| HIDCL | Hydroelectricity Investment and Development Company Limited | Hydropower |
| NTC | Nepal Telecom | Trading |
| CHCL | Chilime Hydropower Company Limited | Hydropower |
| SHPC | Sanjen Hydropower Company Limited | Hydropower |

> All 616 stocks are searchable via the API — only the tracked subset runs active simulation.

## Prerequisites

- Python 3.10+

## Setup

```bash
# Create virtual environment
python -m venv .venv

# Activate virtual environment
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy environment config
cp .env.example .env
```

## Run

```bash
python run.py
```

The server starts at **http://localhost:4000**

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/stocks` | List tracked stocks with live simulated prices |
| GET | `/api/stocks?all=true` | List all 616 available stocks |
| GET | `/api/stocks/<symbol>` | Get current price data for a stock |
| GET | `/api/stocks/<symbol>/history?days=50` | Get real historical OHLCV data |
| GET | `/api/stocks/search?q=NAB` | Search stocks by symbol or name |
| GET | `/api/stocks/search?sector=Hydropower` | Filter stocks by sector |
| GET | `/api/market/status` | Get NEPSE market open/close status |
| POST | `/api/alerts/check` | Check if a stock crosses a threshold |

## WebSocket Events

### Client → Server
| Event | Data | Description |
|-------|------|-------------|
| `subscribe:stock` | `{ "symbols": ["NABIL"] }` | Subscribe to stock tick updates |
| `unsubscribe:stock` | `{ "symbols": ["NABIL"] }` | Unsubscribe from ticks |
| `set:threshold` | `{ "user_id": "abc", "symbol": "NABIL", "price_threshold_pct": 3.0, "volume_threshold_multiplier": 2.0 }` | Set alert thresholds |
| `get:subscriptions` | `{ "user_id": "abc" }` | Get user's alert subscriptions |

### Server → Client
| Event | Description |
|-------|-------------|
| `tick:update` | Real-time price/volume ticks (every 5s) |
| `alert:triggered` | Spike alert when threshold is crossed |
| `market:status` | Market open/close status changes |

## Environment Variables

See `.env.example` for all available configuration. Key settings:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | Server port |
| `TICK_INTERVAL_SECONDS` | `5` | Tick generation frequency |
| `FORCE_MARKET_OPEN` | `true` | Override trading hours for testing |
| `DEFAULT_PRICE_THRESHOLD_PCT` | `3.0` | Default spike detection threshold (%) |
| `DEFAULT_VOLUME_THRESHOLD_MULTIPLIER` | `2.0` | Volume spike multiplier (x) |
| `DATA_PROVIDER` | `simulator` | Data source (`simulator` or `nepse`) |

## Testing

```bash
python tests/test_market_clock.py
python tests/test_spike_detector.py
```

## Architecture

```
Data-Server/
├── run.py                    # Main entry point (Flask + Socket.IO)
├── config.py                 # Centralized configuration
├── data/
│   └── stock_registry.py     # Loads real data from ../Data/ CSVs
├── providers/
│   ├── base.py               # Abstract DataProvider interface
│   ├── simulator.py          # Market simulation (seeded from real data)
│   ├── nepse_api.py          # Stub for live NEPSE API
│   └── provider_factory.py   # Provider selection factory
├── engine/
│   ├── market_clock.py       # NEPSE trading hours enforcement
│   └── market_engine.py      # Tick generation loop
├── detection/
│   ├── spike_detector.py     # Deterministic spike detection
│   └── alert_manager.py      # Per-user alert subscriptions
├── routes/                   # REST API endpoints
├── sockets/                  # WebSocket event handlers
└── tests/                    # Unit tests
```
