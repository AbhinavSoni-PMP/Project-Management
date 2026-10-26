"""Entry rules shared by the entry timer and the time machine.

Keeping one definition means the time machine replays exactly the rules the
entry timer applies today. Each rule fires on a bar's close; the trade is
taken at the next bar's open, so nothing uses information from the future.
Long only: shorting rules for cash equities differ by market and are not
modelled here.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

RULES_VERSION = "entry-v1"
BREAKOUT_BARS = 20
VOLUME_MULT = 1.5
RSI_MAX = 75  # above this the move is treated as extended
EXTENDED_ATR = 3.0  # close more than 3 ATR above the 20 EMA is extended

STRATEGIES = {
    "breakout20": "Uptrend, close above the prior 20-day high on at least 1.5x average volume.",
    "pullback": "Uptrend, the bar dips to the 20 EMA and closes back above it, up on the day.",
    "nr7": "Uptrend, close breaks above the high of a narrow-range (NR7) bar.",
}


def conditions(df: pd.DataFrame, ind: pd.DataFrame) -> pd.DataFrame:
    """Boolean columns, one row per bar: the trend filter, the not-extended
    filter, and each strategy's trigger. NaN inputs count as False."""
    c, o, h, l = df["close"], df["open"], df["high"], df["low"]
    out = pd.DataFrame(index=df.index)
    out["uptrend"] = (c > ind["sma200"]) & (ind["sma50"] > ind["sma200"])
    out["downtrend"] = (c < ind["sma200"]) & (ind["sma50"] < ind["sma200"])
    out["not_extended"] = (ind["rsi14"] < RSI_MAX) & ((c - ind["ema20"]) < EXTENDED_ATR * ind["atr14"])
    prior_high = h.shift(1).rolling(BREAKOUT_BARS, min_periods=BREAKOUT_BARS).max()
    vol_ok = (ind["rel_volume"] >= VOLUME_MULT) | df["volume"].isna()
    out["breakout20"] = (c > prior_high) & vol_ok
    out["pullback"] = (l <= ind["ema20"]) & (c > ind["ema20"]) & (c > o) & (c > c.shift(1))
    rng = h - l
    nr7_prev = rng.shift(1) < rng.shift(2).rolling(6, min_periods=6).min()
    out["nr7"] = nr7_prev & (c > h.shift(1))
    out["prior_high20"] = prior_high
    return out.fillna({k: False for k in out.columns if k != "prior_high20"})


def signals(df: pd.DataFrame, ind: pd.DataFrame, strategy: str) -> np.ndarray:
    """True where every rule for `strategy` is met on that bar's close."""
    if strategy not in STRATEGIES and strategy != "any":
        raise ValueError(f"unknown strategy {strategy!r}; choose from {', '.join(STRATEGIES)} or any")
    cond = conditions(df, ind)
    trig = cond[list(STRATEGIES)].any(axis=1) if strategy == "any" else cond[strategy]
    return (cond["uptrend"] & cond["not_extended"] & trig).to_numpy(dtype=bool)
