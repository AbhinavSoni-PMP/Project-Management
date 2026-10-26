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

## Trading desk: 11 tools

`nse_research/desk/` adds eleven tools on top of the engine above. They run
from the command line and print JSON:

```bash
python -m nse_research.desk -h
```

| Tool | Command | What it does |
| --- | --- | --- |
| Chart scanner | `scan --universe nse-all --limit 500` | Runs every pattern and setup over many symbols and ranks them. Adds triangles, wedges, flags, pennants, gaps, NR4/NR7, inside bars and pipe bottoms from the chart-pattern reference |
| News monitor | `news AAPL RELIANCE.NS --new-only` | Google News and Yahoo Finance RSS, tagged by event (earnings, rating, legal, offering...) with a keyword tone |
| Entry timer | `entry RELIANCE` | RULES MET, WAIT or AVOID on the last close, with the checks and the buy-stop levels to watch |
| Exit planner | `exit RELIANCE --entry 1200` | Initial stop, 1R/2R/3R targets, trailing stop, time stop and alternative stop levels |
| Time machine | `timemachine RELIANCE --html tm.html` | Replays the entry and exit rules on history, then 10,000 resampled years and 10,000 simulated "buy today" paths. The HTML report animates the replay |
| Risk manager | `risk AAPL --entry 190 --stop 182 --target 210` | Position size from the stop (1% risk default) and a check against portfolio limits |
| Budget manager | `budget init 10000 --currency USD` | Capital, cash reserve, monthly loss limit; pauses buys when the limit is hit |
| Order execution | `order buy AAPL 10 --stop 182 --target 210` | Paper broker by default, with brackets, limits and stops. Live orders only through Alpaca with `DESK_ALLOW_LIVE=1`, `--live` and a typed confirmation |
| Price alerts | `alert add AAPL above 200`, `alert check` | Price, % move, SMA cross, entry-ready and stop-near rules; free push via ntfy, a webhook or Telegram |
| Earnings analyst | `earnings AAPL` | Quarterly revenue, EPS and net income with year-on-year change from SEC EDGAR, plus the stock's typical move around reports |
| Pelosi tracker | `congress fetch --member pelosi`, `congress summary` | US House trade disclosures from the House Clerk, parsed from the PTR PDFs; Senate trades by CSV import |

Prices come from the local store, Yahoo Finance (`AAPL`, `RELIANCE.NS`),
Stooq, or a CSV file such as a TradingView chart export (`--source`).

**TradingView.** `python -m nse_research.desk tradingview --out desk.pine`
writes the same entry and exit rules as a Pine Script strategy. Paste it into
the Pine Editor to see the signals and replay them in the Strategy Tester. Its
alerts can POST to `/api/desk/tradingview` (set `DESK_WEBHOOK_SECRET`; webhooks
need a paid TradingView plan and a public URL). Received alerts are logged and
forwarded to your notifications; they never place orders.

**Dashboard routes.** `/desk/timemachine/RELIANCE` opens the time machine
report for a stored symbol, and `/api/desk/scan`, `/api/desk/entry/{symbol}`
and `/api/desk/exit/{symbol}` return JSON.

**Settings** (environment or `.env`): `DESK_NTFY_TOPIC`, `DESK_WEBHOOK_URL`,
`TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` for alerts; `DESK_SEC_CONTACT`
("Name email", which the SEC asks for); `ALPACA_KEY_ID`, `ALPACA_SECRET_KEY`
and `DESK_ALLOW_LIVE` for Alpaca. Desk state (budget, paper ledger, alerts,
parsed disclosures) lives in `data/desk/`, which is git-ignored.

**What the numbers mean.** The time machine estimates odds from this stock's
past. A rule that worked before can stop working, and the simulated paths
assume the future moves like the past. The "drift removed" run shows the odds
if the past trend does not repeat. A good result is a reason to paper trade
first, not a promise of profit. Congress disclosures arrive up to 45 days
after the trade.

## Not built yet

Cup and handle; market regime and sector analysis; strategy validation
across many symbols at once; research log. Earnings for NSE companies need
the Tapetide connector (the Claude skill covers this). Until regime, news
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

## Run it as a Claude artifact (no install)

`artifact/` holds a browser version that runs inside claude.ai and reads
prices through your Tapetide connector, so it needs no Python and no token in
a file. `artifact/engine.js` is a JavaScript port of the analysis engine and
`artifact/page.html` is the page; `node artifact/build.js` inlines the engine
into `artifact/dist/nse-terminal.html`, which is what gets published.

Each refresh makes one Tapetide call per stock, plus one for the calendar and
one for Nifty 50. Data is kept in the browser's local storage until the next
refresh.

To check the port still matches Python:

```bash
python tests/export_engine_cases.py /tmp/cases.json
node artifact/compare_engine.js /tmp/cases.json
```
