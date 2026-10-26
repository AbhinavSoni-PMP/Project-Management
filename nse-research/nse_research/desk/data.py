"""Free price sources for the desk tools.

    store   the local database filled by the dashboard's Refresh (Tapetide, NSE)
    yahoo   Yahoo Finance chart endpoint: free, unofficial, no key. US tickers
            as-is (AAPL), NSE with a .NS suffix (RELIANCE.NS)
    stooq   Stooq daily CSV: free, no key (aapl.us)
    csv     a local file, including a TradingView chart export
            (chart menu > Export chart data)

Every loader returns daily bars indexed by date with open, high, low, close,
raw_close and volume, oldest first. Nothing is filled in or invented: a source
that fails raises DataError.
"""

from __future__ import annotations

import csv
import io
import json
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np
import pandas as pd

USER_AGENT = "nse-research-desk/1.0 (personal research tool)"
COLUMNS = ["open", "high", "low", "close", "raw_close", "volume"]


class DataError(RuntimeError):
    pass


def http_get(url: str, opener=None, headers: dict | None = None, timeout: float = 30.0) -> bytes:
    """GET a URL and return the body. `opener` lets tests pass a fake."""
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, **(headers or {})})
    try:
        with (opener or urllib.request.urlopen)(req, timeout=timeout) as resp:
            return resp.read()
    except urllib.error.HTTPError as e:
        raise DataError(f"{url}: HTTP {e.code}") from None
    except urllib.error.URLError as e:
        raise DataError(f"{url}: {e.reason}") from None


def _frame(rows: list[dict], source: str) -> pd.DataFrame:
    df = pd.DataFrame(rows)
    if df.empty:
        raise DataError(f"{source}: no bars returned")
    df["date"] = pd.to_datetime(df["date"]).dt.normalize()
    df = df.dropna(subset=["open", "high", "low", "close"]).drop_duplicates("date", keep="last")
    df = df.set_index("date").sort_index()
    if "raw_close" not in df:
        df["raw_close"] = df["close"]
    if "volume" not in df:
        df["volume"] = np.nan
    df = df[COLUMNS].astype(float)
    df["source"] = source
    return df


def parse_yahoo(payload: dict) -> pd.DataFrame:
    res = (payload.get("chart") or {}).get("result") or []
    if not res:
        err = (payload.get("chart") or {}).get("error") or {}
        raise DataError(f"yahoo: {err.get('description') or 'no result'}")
    r = res[0]
    ts = r.get("timestamp") or []
    q = (r.get("indicators", {}).get("quote") or [{}])[0]
    adj = (r.get("indicators", {}).get("adjclose") or [{}])[0].get("adjclose")
    tz = (r.get("meta") or {}).get("exchangeTimezoneName") or "UTC"
    rows = []
    for i, t in enumerate(ts):
        o, h, l, c = (q.get(k, [None] * len(ts))[i] for k in ("open", "high", "low", "close"))
        if None in (o, h, l, c):
            continue
        # Yahoo's OHLC are split adjusted; scale them to the dividend-adjusted
        # close too, so indicators and returns use one consistent basis.
        f = (adj[i] / c) if adj and adj[i] and c else 1.0
        rows.append({
            "date": pd.Timestamp(t, unit="s", tz="UTC").tz_convert(tz).tz_localize(None),
            "open": o * f, "high": h * f, "low": l * f, "close": c * f, "raw_close": c,
            "volume": q.get("volume", [None] * len(ts))[i],
        })
    return _frame(rows, "Yahoo Finance (unofficial, free)")


def load_yahoo(symbol: str, years: int = 5, opener=None) -> pd.DataFrame:
    url = (
        f"https://query1.finance.yahoo.com/v8/finance/chart/{urllib.parse.quote(symbol)}"
        f"?range={years}y&interval=1d&includeAdjustedClose=true&events=div%2Csplit"
    )
    return parse_yahoo(json.loads(http_get(url, opener)))


def parse_csv(text: str, source: str) -> pd.DataFrame:
    """Daily OHLCV CSV with any common header spelling: Stooq (Date,Open,...),
    TradingView exports (time,open,...; time may be unix seconds) and others."""
    reader = csv.DictReader(io.StringIO(text.strip()))
    if not reader.fieldnames:
        raise DataError(f"{source}: empty file")
    keys = {k.strip().lower(): k for k in reader.fieldnames}

    def col(*names):
        for n in names:
            if n in keys:
                return keys[n]
        return None

    c_date = col("date", "time", "timestamp", "datetime")
    c = {k: col(k) for k in ("open", "high", "low", "close")}
    c_adj = col("adj close", "adj_close", "adjclose")
    c_vol = col("volume", "vol")
    if c_date is None or None in c.values():
        raise DataError(f"{source}: needs date/time, open, high, low and close columns, got {reader.fieldnames}")
    rows = []
    for r in reader:
        raw_t = r[c_date].strip()
        t = pd.Timestamp(int(float(raw_t)), unit="s") if raw_t.replace(".", "").isdigit() else pd.Timestamp(raw_t)
        try:
            vals = {k: float(r[v]) for k, v in c.items()}
        except (TypeError, ValueError):
            continue
        row = {"date": t, **vals, "raw_close": vals["close"]}
        if c_adj and r.get(c_adj):
            f = float(r[c_adj]) / vals["close"] if vals["close"] else 1.0
            row.update({k: vals[k] * f for k in ("open", "high", "low", "close")})
        row["volume"] = float(r[c_vol]) if c_vol and r.get(c_vol) not in (None, "") else np.nan
        rows.append(row)
    return _frame(rows, source)


def load_stooq(symbol: str, opener=None) -> pd.DataFrame:
    s = symbol.lower()
    if "." not in s:
        s += ".us"
    text = http_get(f"https://stooq.com/q/d/l/?s={urllib.parse.quote(s)}&i=d", opener).decode("utf-8", "replace")
    if text.lower().startswith("no data") or "<html" in text[:200].lower():
        raise DataError(f"stooq: no data for {symbol}")
    return parse_csv(text, "Stooq (free)")


def load_csv(path: str | Path) -> pd.DataFrame:
    p = Path(path)
    return parse_csv(p.read_text(), f"CSV file {p.name}")


def load_store(symbol: str, db_path: str | Path | None = None) -> pd.DataFrame:
    from .. import config
    from ..store import Store

    df = Store(db_path or config.load().db_path).bars(symbol.upper())
    if df.empty:
        raise DataError(f"store: no bars for {symbol}; press Refresh in the dashboard first")
    return df


def load(symbol: str, source: str = "auto", opener=None, db_path=None, years: int = 5) -> pd.DataFrame:
    """Load daily bars. `auto` tries the local store, then Yahoo, then Stooq.
    A symbol ending in .csv is read as a file."""
    if source == "csv" or symbol.lower().endswith(".csv"):
        return load_csv(symbol)
    if source == "store":
        return load_store(symbol, db_path)
    if source == "yahoo":
        return load_yahoo(symbol, years, opener)
    if source == "stooq":
        return load_stooq(symbol, opener)
    if source != "auto":
        raise DataError(f"unknown source {source!r}")
    errors = []
    for fn in (lambda: load_store(symbol, db_path), lambda: load_yahoo(symbol, years, opener), lambda: load_stooq(symbol, opener)):
        try:
            return fn()
        except DataError as e:
            errors.append(str(e))
    raise DataError("no source had data: " + " | ".join(errors))
