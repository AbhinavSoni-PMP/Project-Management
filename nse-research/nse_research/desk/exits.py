"""Exit planner: where to get out before you get in.

The plan has four parts, all fixed before entry:
    initial stop    entry minus `stop_atr` ATR (protective stop, reference p. 13)
    target          entry plus `target_r` times the risk (optional)
    trailing stop   highest high since entry minus `trail_atr` ATR; only rises
    time stop       leave at the close after `max_bars` bars if nothing else hit

`walk_many` applies the plan to many price paths at once. The time machine
uses it for the historical replay and for all Monte Carlo paths, so the
replay, the simulation and the plan you are shown are the same rules.

Fills are conservative: a bar that opens through the stop fills at the open,
and a bar that touches both the stop and the target counts as a stop.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass

import numpy as np
import pandas as pd

from ..indicators import compute_all
from ..swings import find_swings

RULES_VERSION = "exits-v1"


@dataclass
class ExitRules:
    stop_atr: float = 2.0
    target_r: float | None = 2.0
    trail_atr: float | None = 3.0
    max_bars: int = 40
    cost_bps: float = 10.0  # fees plus slippage, per side, in basis points


def walk_many(o, h, l, c, entry, stop, atr, rules: ExitRules):
    """Apply the plan to arrays of shape (paths, bars), long side.

    Bar 0 is the entry bar (entry at its open). Returns exit price, exit bar
    index and reason code per path: 1 stop, 2 target, 3 trailing stop, 4 time.
    """
    o, h, l, c = (np.atleast_2d(np.asarray(x, float)) for x in (o, h, l, c))
    p, n = o.shape
    entry = np.broadcast_to(np.asarray(entry, float), (p,)).copy()
    stop = np.broadcast_to(np.asarray(stop, float), (p,)).copy()
    atr = np.broadcast_to(np.asarray(atr, float), (p,))
    risk = entry - stop
    target = entry + rules.target_r * risk if rules.target_r else np.full(p, np.inf)
    trailing = np.zeros(p, bool)
    hi = np.full(p, -np.inf)
    exit_px = np.full(p, np.nan)
    exit_bar = np.full(p, -1)
    reason = np.zeros(p, int)
    live = np.ones(p, bool)
    last = min(n, rules.max_bars) - 1
    for k in range(last + 1):
        ok, hk, lk, ck = o[:, k], h[:, k], l[:, k], c[:, k]
        gap_stop = live & (ok <= stop)
        hit_stop = live & ~gap_stop & (lk <= stop)
        s = gap_stop | hit_stop
        exit_px[gap_stop] = ok[gap_stop]
        exit_px[hit_stop] = stop[hit_stop]
        reason[s] = np.where(trailing[s], 3, 1)
        exit_bar[s] = k
        live &= ~s
        gap_t = live & (ok >= target)
        hit_t = live & ~gap_t & (hk >= target)
        t = gap_t | hit_t
        exit_px[gap_t] = ok[gap_t]
        exit_px[hit_t] = target[hit_t]
        reason[t], exit_bar[t] = 2, k
        live &= ~t
        if k == last:
            exit_px[live], reason[live], exit_bar[live] = ck[live], 4, k
            live[:] = False
            break
        hi = np.maximum(hi, hk)
        if rules.trail_atr:
            trail = hi - rules.trail_atr * atr
            moved = live & (trail > stop)
            stop[moved] = trail[moved]
            trailing |= moved
    return exit_px, exit_bar, reason


REASONS = {1: "stop", 2: "target", 3: "trailing stop", 4: "time stop"}


def net_return(entry, exit_px, cost_bps: float):
    cost = cost_bps / 1e4
    return (exit_px * (1 - cost)) / (entry * (1 + cost)) - 1


def plan(df: pd.DataFrame, entry: float | None = None, rules: ExitRules | None = None, stop: float | None = None) -> dict:
    """The exit plan for a long entry at `entry` (default: last close)."""
    rules = rules or ExitRules()
    ind = compute_all(df)
    atr = float(ind["atr14"].iloc[-1])
    if np.isnan(atr):
        raise ValueError("need at least 15 bars to measure ATR")
    entry = float(entry if entry is not None else df["close"].iloc[-1])
    atr_stop = entry - rules.stop_atr * atr
    initial = float(stop) if stop is not None else atr_stop
    if initial >= entry:
        raise ValueError(f"stop {initial:.2f} must be below the entry {entry:.2f} for a long trade")
    risk = entry - initial
    sw = [s for s in find_swings(df, 3) if s.kind == "L" and s.price < entry]
    swing_low = sw[-1].price if sw else None
    alternatives = {
        f"{rules.stop_atr} ATR below entry": round(atr_stop, 2),
        "below the last swing low": None if swing_low is None else round(swing_low - 0.1 * atr, 2),
        "below the 10-day low": round(float(df["low"].tail(10).min()) - 0.1 * atr, 2),
        "below the 50-day SMA": None if np.isnan(ind["sma50"].iloc[-1]) else round(float(ind["sma50"].iloc[-1]) - 0.1 * atr, 2),
    }
    alternatives = {k: (v if v is not None and v < entry else None) for k, v in alternatives.items()}
    targets = {f"{r}R": round(entry + r * risk, 2) for r in (1, 2, 3)}
    return {
        "entry": round(entry, 2),
        "atr14": round(atr, 2),
        "initial_stop": round(initial, 2),
        "risk_per_share": round(risk, 2),
        "risk_pct": round(100 * risk / entry, 2),
        "target": None if not rules.target_r else round(entry + rules.target_r * risk, 2),
        "targets": targets,
        "trailing_stop": None if not rules.trail_atr else f"highest high since entry minus {rules.trail_atr} ATR ({rules.trail_atr * atr:.2f}); only moves up",
        "time_stop": f"exit at the close of bar {rules.max_bars} if no other exit has triggered",
        "stop_alternatives": alternatives,
        "rules": asdict(rules),
        "rules_version": RULES_VERSION,
        "notes": [
            "Place the stop as a real stop order the day you enter, not a mental stop.",
            "Never move the initial stop further away; the trailing stop only tightens it.",
            "If the price gaps through the stop, the fill is the open, which can be worse than the stop.",
        ],
    }
