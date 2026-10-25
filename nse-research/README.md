# NSE Research Terminal

A local research and paper-trading dashboard for NSE stocks. It never places
orders. Data changes only when you press **Refresh**, which pulls end-of-day
bars from the Tapetide REST API into a local database. Indicators, chart
patterns and candlesticks are then calculated by this code.

> Research and paper trading only. Not financial advice. This tool is not a
> SEBI-registered research analyst or investment adviser.

## Run it on your computer

Needs Python 3.11 or newer.

```bash
cd nse-research
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env               # then paste your Tapetide token into .env
python -m nse_research.app
```

Open http://127.0.0.1:8000 and press **Refresh**. The first refresh loads
about 5.5 years of daily history per stock; later refreshes fetch only the
missing days plus a 10-day overlap, which is used to spot provider revisions.

- **Stocks:** edit `symbols` in `config.toml`.
- **Quota:** each refresh costs one Tapetide request per stock, plus one for
  the trading calendar.
- **Token:** read from `TAPETIDE_TOKEN` in the environment or `.env`. `.env`
  and the `data/` folder are git-ignored.

## What is built (spec steps 5 to 8)

| Part | File | Notes |
| --- | --- | --- |
| Normalisation | `nse_research/normalize.py` | Bad bars are dropped and listed, never repaired; >20% daily moves flagged for a corporate-action check; weekly and monthly bars built from daily bars; freshness checked against the exchange calendar |
| Indicators | `nse_research/indicators.py` | SMA, EMA, MACD, ADX/DI, RSI, Stochastic, ROC, ATR, Bollinger, historical volatility, volume average, relative volume, OBV, traded value. Wilder smoothing where standard |
| Patterns | `nse_research/patterns.py`, `breakout.py`, `swings.py` | Double and triple tops and bottoms, head and shoulders (and inverse), rectangles. Four stages: Candidate, Developing, Confirmed, Failed |
| Candlesticks | `nse_research/candles.py` | Doji, hammer, hanging man, shooting star, inverted hammer, engulfing, harami, dark cloud cover, piercing line, each with trend, support/resistance, volume, next-candle and weekly context |
| Refresh | `nse_research/refresh.py`, `tapetide.py` | Read-only GET calls; failures show DATA SOURCE UNAVAILABLE and keep old data |
| Store | `nse_research/store.py` | SQLite with source and fetch time per bar, revision log, fetch log |
| App | `nse_research/app.py`, `static/index.html` | Universe table, stock page with chart, indicators, patterns and candles |

Breakout rules (`breakout-v1`): a close beyond the boundary, beyond it by at
least 2% or 1 ATR (whichever is smaller) within three bars, two consecutive
closes beyond it, and volume at least 1.5x its 20-day average. A close back
inside within five bars marks a false breakout. All thresholds are versioned
constants. No pattern has a reliability figure until pattern backtests exist.

## Not built yet

Triangles, wedges, flags, pennants, cup and handle, gaps, narrow-range bars and
pipe bottoms; market regime and sector analysis; news and events; backtesting;
strategy validation; paper portfolio; alerts; research log. Until regime, news
and validated strategies exist, every stock shows its research classification
as not available, rather than a guessed label.

## Data limits

- Tapetide is a secondary source. NSE is the intended primary source but is
  not connected yet.
- End-of-day only: 4H, 1H and intraday views show NOT AVAILABLE WITH CURRENT
  DATA SOURCE.
- Prices are split and bonus adjusted, not dividend adjusted.

## Tests

```bash
cd nse-research && python -m pytest -q
```

Tests use synthetic price paths and a fake Tapetide client, so they need no
token or network.
