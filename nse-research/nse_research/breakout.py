"""Breakout validation shared by every pattern.

A boundary crossing is judged on closes, distance, follow-through and volume,
and the result is one of: NO_BREAKOUT, POSSIBLE_BREAKOUT, BREAKOUT,
FALSE_BREAKOUT_RISK, INVALIDATED.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable

import numpy as np
import pandas as pd

# Version the thresholds: changing any of them is a new rule set.
RULES_VERSION = "breakout-v1"
MIN_DISTANCE_PCT = 0.02  # close beyond the level by at least 2% ...
MIN_DISTANCE_ATR = 1.0  # ... or by at least 1 ATR, whichever is smaller
CLOSES_REQUIRED = 2  # consecutive closes beyond the level
VOLUME_MULT = 1.5  # breakout-bar volume vs its 20-day average
CONFIRM_WINDOW = 3  # distance and volume may be met on any of the first 3 bars beyond
RETURN_WINDOW = 5  # a close back inside within this many bars = false breakout


@dataclass
class BreakoutResult:
    status: str
    breakout_date: str | None = None
    checks: dict = field(default_factory=dict)
    notes: list[str] = field(default_factory=list)

    @property
    def checks_passed(self) -> int:
        return sum(1 for v in self.checks.values() if v is True)

    def as_dict(self) -> dict:
        return {
            "status": self.status,
            "breakout_date": self.breakout_date,
            "checks": self.checks,
            "notes": self.notes,
            "rules_version": RULES_VERSION,
        }


def evaluate_breakout(
    df: pd.DataFrame,
    ind: pd.DataFrame,
    start_idx: int,
    level: Callable[[int], float],
    direction: str,
    invalidation: float | None = None,
) -> BreakoutResult:
    """Look at bars from start_idx onward for a close beyond `level(i)`.

    direction: "up" (close above level) or "down" (close below level).
    invalidation: price that kills the setup before any breakout (a close above
    it for a "down" setup, below it for an "up" setup).
    """
    close = df["close"].to_numpy()
    vol = df["volume"].to_numpy()
    atr = ind["atr14"].to_numpy()
    vsma = ind["vol_sma20"].to_numpy()
    sign = 1 if direction == "up" else -1
    n = len(df)

    first = None
    for i in range(start_idx, n):
        if invalidation is not None and sign * (close[i] - invalidation) < 0:
            return BreakoutResult(
                "INVALIDATED",
                notes=[f"Closed {'below' if sign > 0 else 'above'} the invalidation level {invalidation:.2f} on {df.index[i].date()} before any breakout."],
            )
        if sign * (close[i] - level(i)) > 0:
            first = i
            break
    if first is None:
        return BreakoutResult("NO_BREAKOUT", notes=["No close beyond the boundary yet."])

    window = range(first, min(n, first + CONFIRM_WINDOW))
    dist_ok = None
    for j in window:
        lvl = level(j)
        need = MIN_DISTANCE_PCT * lvl
        if not np.isnan(atr[j]):
            need = min(need, MIN_DISTANCE_ATR * atr[j])
        if sign * (close[j] - lvl) >= need:
            dist_ok = True
            break
        dist_ok = False
    if dist_ok is False and len(window) < CONFIRM_WINDOW:
        dist_ok = None  # not met yet, but the confirmation window is still open
    checks: dict = {"distance": dist_ok}

    after = list(range(first, min(n, first + CLOSES_REQUIRED)))
    if len(after) < CLOSES_REQUIRED:
        checks["multiple_closes"] = None
    else:
        checks["multiple_closes"] = all(sign * (close[j] - level(j)) > 0 for j in after)

    ratios = [vol[j] / vsma[j] for j in window if not np.isnan(vol[j]) and not np.isnan(vsma[j]) and vsma[j] > 0]
    checks["volume"] = None if not ratios else bool(max(ratios) >= VOLUME_MULT)

    res = BreakoutResult("POSSIBLE_BREAKOUT", str(df.index[first].date()), checks)
    window_end = min(n, first + 1 + RETURN_WINDOW)
    returned = [j for j in range(first + 1, window_end) if sign * (close[j] - level(j)) <= 0]
    if returned:
        res.status = "FALSE_BREAKOUT_RISK"
        res.notes.append(f"Closed back inside the boundary on {df.index[returned[0]].date()}.")
        return res
    if all(v is True for v in checks.values()):
        res.status = "BREAKOUT"
    else:
        missing = [k for k, v in checks.items() if v is not True]
        res.notes.append("Not yet confirmed: " + ", ".join(missing) + ".")
    return res
