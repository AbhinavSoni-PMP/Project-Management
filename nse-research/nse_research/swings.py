"""Swing highs and lows: the objective anchor points for every pattern rule.

A swing at bar i is only known once `k` bars to its right exist, so each swing
records the bar where it became confirmed. Pattern code must not use a swing
before that bar (no look-ahead).
"""

from __future__ import annotations

from dataclasses import dataclass

import pandas as pd


@dataclass(frozen=True)
class Swing:
    idx: int
    date: pd.Timestamp
    price: float
    kind: str  # "H" or "L"
    confirmed_idx: int


def find_swings(df: pd.DataFrame, k: int = 5) -> list[Swing]:
    """Bars whose high (low) is the strict extreme of the k bars on each side.

    Ties go to the earlier bar. Consecutive swings of the same kind are merged
    to the more extreme one, so the list alternates H, L, H, L ...
    """
    highs = df["high"].to_numpy()
    lows = df["low"].to_numpy()
    n = len(df)
    raw: list[Swing] = []
    for i in range(k, n - k):
        left_h, right_h = highs[i - k : i], highs[i + 1 : i + k + 1]
        if highs[i] > left_h.max() and highs[i] >= right_h.max():
            raw.append(Swing(i, df.index[i], float(highs[i]), "H", i + k))
        left_l, right_l = lows[i - k : i], lows[i + 1 : i + k + 1]
        if lows[i] < left_l.min() and lows[i] <= right_l.min():
            raw.append(Swing(i, df.index[i], float(lows[i]), "L", i + k))
    raw.sort(key=lambda s: (s.idx, s.kind))

    merged: list[Swing] = []
    for s in raw:
        if merged and merged[-1].kind == s.kind:
            prev = merged[-1]
            better = s.price > prev.price if s.kind == "H" else s.price < prev.price
            if better:
                merged[-1] = s
        else:
            merged.append(s)
    return merged
