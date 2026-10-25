"""Per-stock analysis assembled from stored bars.

This layer only reports what the data shows. It does not produce BUY/SELL
calls; the research classification stays pending until regime, news and
validated strategies exist.
"""

from __future__ import annotations

import datetime as dt
import math

import pandas as pd

from . import indicators, labels
from .candles import detect_candles
from .indicators import compute_all
from .normalize import freshness, resample
from .patterns import CATALOGUE, detect_patterns
from .store import Store

MIN_BARS_FULL = 200
LOW_LIQUIDITY_CR = 10.0  # median daily traded value below Rs 10 crore


def _num(v, nd=2):
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return None
    return round(float(v), nd)


def weekly_trend(df: pd.DataFrame) -> str | None:
    w = resample(df, "W")
    if len(w) < 24:
        return None
    s = indicators.sma(w["close"], 20)
    if pd.isna(s.iloc[-1]) or pd.isna(s.iloc[-5]):
        return None
    rising = s.iloc[-1] > s.iloc[-5]
    if w["close"].iloc[-1] > s.iloc[-1] and rising:
        return "up"
    if w["close"].iloc[-1] < s.iloc[-1] and not rising:
        return "down"
    return "sideways"


def _load(store: Store, symbol: str) -> pd.DataFrame:
    return store.bars(symbol)


def _fresh(store: Store, df: pd.DataFrame, now: dt.datetime):
    last = df.index[-1].date() if len(df) else None
    sessions, end = store.calendar()
    return freshness(last, now, sessions, calendar_end=end)


def summary(store: Store, symbol: str, now: dt.datetime) -> dict:
    df = _load(store, symbol)
    f = _fresh(store, df, now)
    if df.empty:
        return {"symbol": symbol, "status": labels.DATA_NOT_AVAILABLE, "freshness": f.as_dict()}
    ind = compute_all(df)
    last, li = df.iloc[-1], ind.iloc[-1]
    pats = detect_patterns(df, ind)
    cands = detect_candles(df, ind, last_n=5)
    liq = _num(li["traded_value_cr_median20"])
    return {
        "symbol": symbol,
        "close": _num(last["close"]),
        "bar_date": str(df.index[-1].date()),
        "source": last["source"],
        "freshness": f.as_dict(),
        "vs_sma200_pct": _num(100 * (last["close"] / li["sma200"] - 1), 1) if not pd.isna(li["sma200"]) else None,
        "vs_sma50_pct": _num(100 * (last["close"] / li["sma50"] - 1), 1) if not pd.isna(li["sma50"]) else None,
        "rsi14": _num(li["rsi14"], 1),
        "adx": _num(li["adx"], 1),
        "rel_volume": _num(li["rel_volume"]),
        "traded_value_cr": liq,
        "low_liquidity": None if liq is None else liq < LOW_LIQUIDITY_CR,
        "patterns": [{"name": p.name, "stage": p.stage} for p in pats[:3]],
        "latest_candle": cands[-1].as_dict() if cands else None,
        "bars": len(df),
        "status": labels.NO_SIGNAL_DATA if not f.usable_for_signals else labels.CLASSIFICATION_PENDING,
    }


def detail(store: Store, symbol: str, now: dt.datetime, chart_bars: int = 260) -> dict:
    df = _load(store, symbol)
    f = _fresh(store, df, now)
    if df.empty:
        return {"symbol": symbol, "status": labels.DATA_NOT_AVAILABLE, "freshness": f.as_dict()}
    ind = compute_all(df)
    li = ind.iloc[-1]
    close = float(df["close"].iloc[-1])
    wt = weekly_trend(df)
    pats = detect_patterns(df, ind, "daily")
    wk = resample(df, "W")
    wpats = detect_patterns(wk, compute_all(wk), "weekly") if len(wk) >= 60 else []
    cands = detect_candles(df, ind, last_n=20, weekly_trend=wt)

    ind_latest = {k: _num(li[k]) for k in ind.columns}
    notes = []
    if len(df) < MIN_BARS_FULL:
        notes.append(f"Only {len(df)} daily bars stored; 200-bar indicators are not available yet.")
    tv = ind_latest.get("traded_value_cr_median20")
    if tv is not None and tv < LOW_LIQUIDITY_CR:
        notes.append(f"Low liquidity: median daily traded value Rs {tv:.1f} crore (floor Rs {LOW_LIQUIDITY_CR:.0f} crore).")

    tail = df.tail(chart_bars)
    itail = ind.loc[tail.index]
    chart = {
        "dates": [str(d.date()) for d in tail.index],
        "open": tail["open"].round(2).tolist(),
        "high": tail["high"].round(2).tolist(),
        "low": tail["low"].round(2).tolist(),
        "close": tail["close"].round(2).tolist(),
        "volume": [None if pd.isna(v) else float(v) for v in tail["volume"]],
        "sma50": [_num(v) for v in itail["sma50"]],
        "sma200": [_num(v) for v in itail["sma200"]],
    }
    return {
        "symbol": symbol,
        "header": {
            "last_price": _num(close),
            "price_basis": "Last EOD close (split/bonus adjusted)",
            "data_timestamp": str(df.index[-1].date()),
            "fetched_at": df["fetched_at"].iloc[-1],
            "source": df["source"].iloc[-1],
            "frequency": labels.FREQUENCY_EOD,
            "freshness": f.as_dict(),
        },
        "status": labels.NO_SIGNAL_DATA if not f.usable_for_signals else labels.CLASSIFICATION_PENDING,
        "indicators": {"label": labels.CALCULATED, "version": indicators.VERSION, "values": ind_latest},
        "trend_facts": {
            "close_above_sma200": None if ind_latest["sma200"] is None else close > ind_latest["sma200"],
            "close_above_sma50": None if ind_latest["sma50"] is None else close > ind_latest["sma50"],
            "sma50_above_sma200": None if None in (ind_latest["sma50"], ind_latest["sma200"]) else ind_latest["sma50"] > ind_latest["sma200"],
            "weekly_trend": wt,
        },
        "patterns": [p.as_dict(close) for p in pats] + [p.as_dict(close) for p in wpats],
        "pattern_catalogue": CATALOGUE,
        "candles": [c.as_dict() for c in cands],
        "timeframes": {
            "daily": "available",
            "weekly": "calculated from daily bars",
            "monthly": "calculated from daily bars",
            "4H / 1H / intraday": labels.NOT_AVAILABLE_WITH_SOURCE,
        },
        "data_quality": {"notes": notes, "revisions": store.revisions(symbol)},
        "chart": chart,
        "disclaimer": labels.DISCLAIMER,
    }
