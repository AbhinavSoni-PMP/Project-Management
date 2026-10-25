"""Candlestick detection, always scored with its context.

A candle shape alone is never a signal. Each detection records the preceding
trend, nearness to a swing support/resistance zone, volume, whether the next
candle confirmed it, and the weekly trend. Weight is the count of supporting
context items, not a probability.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from . import labels
from .swings import find_swings

RULES_VERSION = "candles-v1"
DOJI_BODY = 0.1  # body at most 10% of the range
LONG_SHADOW = 2.0  # shadow at least 2x the body
SMALL_SHADOW = 0.25  # opposite shadow at most 25% of the range
TREND_BARS = 10
ZONE_ATR = 1.0


@dataclass
class CandleSignal:
    date: str
    name: str
    bias: str
    context: dict
    weight: str

    def as_dict(self) -> dict:
        return {
            "date": self.date,
            "name": self.name,
            "bias": self.bias,
            "context": self.context,
            "weight": self.weight,
            "rules_version": RULES_VERSION,
            "label": labels.CALCULATED,
            "reliability": labels.NOT_BACKTESTED,
        }


def _shapes(o, h, l, c, po, pc) -> list[tuple[str, str]]:
    rng = h - l
    if rng <= 0:
        return []
    body = abs(c - o)
    upper = h - max(o, c)
    lower = min(o, c) - l
    out = []
    if body <= DOJI_BODY * rng:
        out.append(("Doji", "neutral"))
    elif lower >= LONG_SHADOW * body and upper <= SMALL_SHADOW * rng:
        out.append(("Hammer-shape", "depends"))
    elif upper >= LONG_SHADOW * body and lower <= SMALL_SHADOW * rng:
        out.append(("Shooting-star-shape", "depends"))
    if po is None:
        return out
    pbody = abs(pc - po)
    prev_bear, prev_bull = pc < po, pc > po
    if prev_bear and c > o and o <= pc and c >= po and body > pbody:
        out.append(("Bullish Engulfing", "bullish"))
    if prev_bull and c < o and o >= pc and c <= po and body > pbody:
        out.append(("Bearish Engulfing", "bearish"))
    if pbody > 0 and body < pbody and max(o, c) <= max(po, pc) and min(o, c) >= min(po, pc):
        out.append(("Bullish Harami" if prev_bear else "Bearish Harami", "bullish" if prev_bear else "bearish"))
    mid = (po + pc) / 2
    if prev_bull and c < o and o > pc and c < mid and c > po:
        out.append(("Dark Cloud Cover", "bearish"))
    if prev_bear and c > o and o < pc and c > mid and c < po:
        out.append(("Piercing Line", "bullish"))
    return out


def detect_candles(df: pd.DataFrame, ind: pd.DataFrame, last_n: int = 20, weekly_trend: str | None = None) -> list[CandleSignal]:
    """Candle signals in the last `last_n` bars, each with its context."""
    if len(df) < TREND_BARS + 2:
        return []
    o, h, l, c = (df[k].to_numpy() for k in ("open", "high", "low", "close"))
    vol = df["volume"].to_numpy()
    vsma = ind["vol_sma20"].to_numpy()
    atr = ind["atr14"].to_numpy()
    swings = find_swings(df)
    out = []
    for i in range(max(TREND_BARS + 1, len(df) - last_n), len(df)):
        prior = c[i - 1] / c[i - 1 - TREND_BARS] - 1
        trend = "up" if prior > 0.03 else "down" if prior < -0.03 else "sideways"
        for name, bias in _shapes(o[i], h[i], l[i], c[i], o[i - 1], c[i - 1]):
            # The same shape means different things after different trends.
            if name == "Hammer-shape":
                if trend == "down":
                    name, bias = "Hammer", "bullish"
                elif trend == "up":
                    name, bias = "Hanging Man", "bearish"
                else:
                    continue
            if name == "Shooting-star-shape":
                if trend == "up":
                    name, bias = "Shooting Star", "bearish"
                elif trend == "down":
                    name, bias = "Inverted Hammer", "bullish"
                else:
                    continue
            known = [s for s in swings if s.confirmed_idx <= i]
            zone = None
            if not np.isnan(atr[i]):
                kind = "L" if bias == "bullish" else "H" if bias == "bearish" else None
                ref = l[i] if bias == "bullish" else h[i]
                near = [s for s in known if (kind is None or s.kind == kind) and abs(s.price - ref) <= ZONE_ATR * atr[i]]
                zone = bool(near)
            vol_ok = None if np.isnan(vol[i]) or np.isnan(vsma[i]) else bool(vol[i] >= vsma[i])
            if i + 1 < len(df):
                nxt = bool(c[i + 1] > h[i]) if bias == "bullish" else bool(c[i + 1] < l[i]) if bias == "bearish" else None
            else:
                nxt = None
            trend_fit = {"bullish": trend == "down", "bearish": trend == "up"}.get(bias)
            weekly_fit = None
            if weekly_trend and bias in ("bullish", "bearish"):
                weekly_fit = (weekly_trend == "up") == (bias == "bullish")
            ctx = {
                "preceding_trend": trend,
                "fits_preceding_trend": trend_fit,
                "near_support_or_resistance": zone,
                "volume_above_average": vol_ok,
                "next_candle_confirmed": nxt,
                "agrees_with_weekly_trend": weekly_fit,
            }
            score = sum(1 for v in ctx.values() if v is True)
            weight = "context-supported" if score >= 4 else "some context" if score >= 2 else "isolated (low weight)"
            out.append(CandleSignal(str(df.index[i].date()), name, bias, ctx, weight))
    return out
