"""Patterns the dashboard did not detect yet, from the chart-pattern reference
(Idenitfying-Chart-Patterns.pdf, Fidelity / Kirkpatrick):

    triangles (symmetrical, ascending, descending)   pp. 23-25
    wedges (rising, falling)                          p. 26
    flags and pennants                                p. 39
    pipe bottom / pipe top (two-bar reversal)         p. 42
    gaps                                              pp. 40-41
    inside bar, NR4 and NR7                           pp. 43-44

Multi-bar patterns reuse the dashboard's Pattern record and breakout
validator, so stages mean the same thing everywhere. Short-term volatility
setups have no breakout yet by definition, so they are reported as a Setup
with the buy-stop and sell-stop trigger prices the reference describes.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from .. import labels
from ..breakout import evaluate_breakout
from ..patterns import STAGE_FROM_BREAKOUT, Pattern, _pt
from ..swings import find_swings

RULES_VERSION = "setups-v1"
SWING_K = 4
FLAT_PCT = 0.015  # a "horizontal" line moves less than 1.5% across the pattern
FIT_ATR = 0.75  # every touch within 0.75 ATR of its trend line
CONVERGE = 0.8  # end width at most 80% of start width
POLE_MIN_PCT = 0.08
POLE_MIN_ATR = 4.0
GAP_MIN_ATR = 0.5
PIPE_RANGE_MULT = 1.5
RECENT_BARS = 20


@dataclass
class Setup:
    name: str
    bias: str
    date: str
    trigger_long: float | None
    trigger_short: float | None
    reasons: list[str] = field(default_factory=list)
    extra: dict = field(default_factory=dict)

    def as_dict(self) -> dict:
        return {
            "name": self.name,
            "bias": self.bias,
            "date": self.date,
            "trigger_long": None if self.trigger_long is None else round(self.trigger_long, 2),
            "trigger_short": None if self.trigger_short is None else round(self.trigger_short, 2),
            "reasons": self.reasons,
            **self.extra,
            "rules_version": RULES_VERSION,
            "historical_reliability": labels.NOT_BACKTESTED,
            "label": labels.CALCULATED,
        }


def _line(points):
    x = np.array([p.idx for p in points], float)
    y = np.array([p.price for p in points], float)
    slope, icpt = np.polyfit(x, y, 1)
    resid = np.abs(y - (slope * x + icpt))
    return float(slope), float(icpt), float(resid.max())


def _pattern(df, ind, name, family, bias, pts, boundary, up_fn, down_fn, start, height, reasons, wedge_down_target=None):
    """Check both boundaries for a breakout; the first confirmed side wins."""
    up = evaluate_breakout(df, ind, start, up_fn, "up")
    dn = evaluate_breakout(df, ind, start, down_fn, "down")
    last = len(df) - 1
    if up.breakout_date and (not dn.breakout_date or up.breakout_date <= dn.breakout_date):
        br, level, target, inval = up, up_fn(last), up_fn(last) + height, down_fn(last)
    elif dn.breakout_date:
        br, level, inval = dn, down_fn(last), up_fn(last)
        target = wedge_down_target if wedge_down_target is not None else level - height
    else:
        br, level, target, inval = up, up_fn(last), None, down_fn(last)
    p = Pattern(
        name=name, family=family, bias=bias, timeframe="daily", points=pts, boundary=boundary,
        breakout_level=float(level), invalidation_level=float(inval), stage=STAGE_FROM_BREAKOUT[br.status],
        breakout=br.as_dict(), target_textbook=target, reasons=reasons + br.notes,
    )
    if target is None:
        p.boundary["note"] = "No breakout in either direction yet."
    return p


def triangles_and_wedges(df: pd.DataFrame, ind: pd.DataFrame, lookback: int = 120) -> list[Pattern]:
    if len(df) < 60:
        return []
    sw = [s for s in find_swings(df, SWING_K) if s.idx >= len(df) - lookback]
    out, used = [], set()
    for end in range(len(sw), max(3, len(sw) - 3), -1):
        for size in (7, 6, 5, 4):
            win = sw[max(0, end - size) : end]
            hs = [s for s in win if s.kind == "H"]
            ls = [s for s in win if s.kind == "L"]
            if len(hs) < 2 or len(ls) < 2 or (win[0].idx, win[-1].idx) in used:
                continue
            atr = float(ind["atr14"].iloc[win[-1].idx])
            if np.isnan(atr):
                continue
            sh, ih, rh = _line(hs)
            sl, il, rl = _line(ls)
            if rh > FIT_ATR * atr or rl > FIT_ATR * atr:
                continue
            x0, x1 = win[0].idx, win[-1].idx
            span = x1 - x0
            ref = float(df["close"].iloc[x1])
            w0, w1 = (sh * x0 + ih) - (sl * x0 + il), (sh * x1 + ih) - (sl * x1 + il)
            if w0 <= 0 or w1 <= 0 or w1 > CONVERGE * w0:
                continue
            flat_h = abs(sh * span) / ref < FLAT_PCT
            flat_l = abs(sl * span) / ref < FLAT_PCT
            if flat_h and sl > 0:
                name, bias = "Ascending Triangle", "bullish"
            elif flat_l and sh < 0:
                name, bias = "Descending Triangle", "bearish"
            elif sh < 0 < sl:
                name, bias = "Symmetrical Triangle", "either"
            elif sh > 0 and sl > 0 and len(win) >= 5:
                name, bias = "Rising Wedge", "bearish"
            elif sh < 0 and sl < 0 and len(win) >= 5:
                name, bias = "Falling Wedge", "bullish"
            else:
                continue
            height = max(s.price for s in hs) - min(s.price for s in ls)
            reasons = [
                f"{len(hs)} touches on the upper line and {len(ls)} on the lower line, each within {FIT_ATR} ATR.",
                f"Lines converge: width {w0:.2f} at the start, {w1:.2f} at the last touch.",
            ]
            if name.endswith("Wedge"):
                reasons.append("Wedges have below-average performance and frequent retracements (reference, p. 26).")
            if name == "Symmetrical Triangle":
                reasons.append("Many false breakouts; confirm the breakout (reference, p. 23).")
            p = _pattern(
                df, ind, name, "continuation" if "Triangle" in name else "reversal", bias,
                [_pt(s, "upper touch" if s.kind == "H" else "lower touch") for s in win],
                {"upper_now": round(sh * (len(df) - 1) + ih, 2), "lower_now": round(sl * (len(df) - 1) + il, 2)},
                lambda i, a=sh, b=ih: a * i + b, lambda i, a=sl, b=il: a * i + b,
                max(s.confirmed_idx for s in win), height, reasons,
                wedge_down_target=min(s.price for s in ls) if name.endswith("Wedge") else None,
            )
            out.append(p)
            used.add((x0, x1))
            break  # one structure per end swing: the largest that fits
    return out


def flags(df: pd.DataFrame, ind: pd.DataFrame) -> list[Pattern]:
    """A sharp pole of 5-15 bars, then 4-20 bars of tight consolidation that
    gives back at most half the pole."""
    n = len(df)
    if n < 60:
        return []
    c, h, l = df["close"].to_numpy(), df["high"].to_numpy(), df["low"].to_numpy()
    atr = ind["atr14"].to_numpy()
    best = None
    for j in range(n - 21, n - 4):
        if np.isnan(atr[j]):
            continue
        for L in range(5, 16):
            s = j - L
            if s < 0:
                continue
            move = c[j] - c[s]
            if abs(move) / c[s] < POLE_MIN_PCT or abs(move) < POLE_MIN_ATR * atr[j]:
                continue
            up = move > 0
            ch, cl = h[j + 1 :].max(), l[j + 1 :].min()
            pole_top = h[s : j + 1].max() if up else l[s : j + 1].min()
            if up and (ch > pole_top * 1.01 or cl < c[j] - 0.5 * move):
                continue
            if not up and (cl < pole_top * 0.99 or ch > c[j] - 0.5 * move):
                continue
            if best is None or abs(move) > abs(best[2]):
                best = (s, j, move, up, pole_top)
    if best is None:
        return []
    s, j, move, up, pole_top = best
    cons = df.iloc[j + 1 :]
    width_start = h[j + 1 : j + 4].max() - l[j + 1 : j + 4].min()
    width_end = h[-3:].max() - l[-3:].min()
    name = "Pennant" if width_end < 0.7 * width_start else "Flag"
    height = abs(pole_top - c[s])
    level = float(pole_top)
    inval = float(cons["low"].min() if up else cons["high"].max())
    br = evaluate_breakout(df, ind, j + 1, lambda i, v=level: v, "up" if up else "down", inval)
    target = (cons["low"].min() + height) if up else (cons["high"].max() - height)
    pts = [
        {"date": str(df.index[s].date()), "price": round(float(c[s]), 2), "label": "pole start"},
        {"date": str(df.index[j].date()), "price": round(float(pole_top), 2), "label": "pole end"},
        {"date": str(df.index[-1].date()), "price": round(float(c[-1]), 2), "label": "latest"},
    ]
    return [Pattern(
        name=f"{'Bull' if up else 'Bear'} {name}", family="continuation", bias="bullish" if up else "bearish",
        timeframe="daily", points=pts, boundary={"flag_top" if up else "flag_bottom": round(level, 2)},
        breakout_level=level, invalidation_level=inval, stage=STAGE_FROM_BREAKOUT[br.status], breakout=br.as_dict(),
        target_textbook=float(target),
        reasons=[
            f"Pole of {move / c[s]:+.1%} in {j - s} bars, then {n - 1 - j} bars of consolidation.",
            "The reference measures the target as the pole height added to the bottom of the flag (p. 39).",
        ] + br.notes,
    )]


def pipes(df: pd.DataFrame, ind: pd.DataFrame) -> list[Pattern]:
    """Two wide-range bars at a 20-bar extreme with matching lows (or highs)."""
    n = len(df)
    if n < 60:
        return []
    h, l, c = df["high"].to_numpy(), df["low"].to_numpy(), df["close"].to_numpy()
    rng = h - l
    avg = pd.Series(rng).rolling(20).mean().shift(2).to_numpy()
    atr = ind["atr14"].to_numpy()
    out = []
    for i in range(n - RECENT_BARS, n):
        a, b = i - 1, i
        if np.isnan(avg[b]) or np.isnan(atr[b]) or min(rng[a], rng[b]) < PIPE_RANGE_MULT * avg[b]:
            continue
        lo20, hi20 = l[b - 20 : b + 1].min(), h[b - 20 : b + 1].max()
        mid_b = (h[b] + l[b]) / 2
        if abs(l[a] - l[b]) <= 0.5 * atr[b] and min(l[a], l[b]) <= lo20 and c[b] > mid_b:
            level, inval, up = max(h[a], h[b]), min(l[a], l[b]), True
        elif abs(h[a] - h[b]) <= 0.5 * atr[b] and max(h[a], h[b]) >= hi20 and c[b] < mid_b:
            level, inval, up = min(l[a], l[b]), max(h[a], h[b]), False
        else:
            continue
        height = max(h[a], h[b]) - min(l[a], l[b])
        br = evaluate_breakout(df, ind, b + 1, lambda i, v=level: v, "up" if up else "down", inval) if b + 1 < n else None
        status = br.status if br else "NO_BREAKOUT"
        out.append(Pattern(
            name="Pipe Bottom" if up else "Pipe Top", family="reversal", bias="bullish" if up else "bearish",
            timeframe="daily",
            points=[{"date": str(df.index[k].date()), "price": round(float(l[k] if up else h[k]), 2), "label": f"bar {m}"} for m, k in ((1, a), (2, b))],
            boundary={"trigger": round(float(level), 2)}, breakout_level=float(level), invalidation_level=float(inval),
            stage=STAGE_FROM_BREAKOUT[status], breakout=br.as_dict() if br else {"status": status, "checks": {}, "notes": []},
            target_textbook=float(level + height if up else level - height),
            reasons=[
                f"Two bars at least {PIPE_RANGE_MULT}x the average range at a 20-bar {'low' if up else 'high'}.",
                "Action is on a break through the second bar; more reliable on weekly data (reference, p. 42).",
            ],
        ))
    return out


def short_term(df: pd.DataFrame, ind: pd.DataFrame) -> list[Setup]:
    """Gaps in the last 20 bars and the latest bar's NR4, NR7 or inside bar."""
    n = len(df)
    if n < 30:
        return []
    o, h, l, c = (df[k].to_numpy() for k in ("open", "high", "low", "close"))
    atr = ind["atr14"].to_numpy()
    out: list[Setup] = []
    for i in range(max(21, n - RECENT_BARS), n):
        a = atr[i]
        if np.isnan(a):
            continue
        for up in (True, False):
            gap = l[i] - h[i - 1] if up else l[i - 1] - h[i]
            if gap < GAP_MIN_ATR * a:
                continue
            edge = h[i - 1] if up else l[i - 1]
            after_l = l[i + 1 :].min() if i + 1 < n else np.inf
            after_h = h[i + 1 :].max() if i + 1 < n else -np.inf
            filled = bool(after_l <= edge) if up else bool(after_h >= edge)
            prior_hi, prior_lo = h[i - 21 : i - 1].max(), l[i - 21 : i - 1].min()
            kind = "breakaway" if (c[i] > prior_hi if up else c[i] < prior_lo) else "common"
            reasons = [f"Gap of {gap:.2f} ({gap / a:.1f} ATR) on {df.index[i].date()}, {kind}."]
            if filled:
                reasons.append("Gap has since been covered, so the reference says no action (p. 41).")
            else:
                reasons.append("Explosion-gap pivot: wait for the throwback to hold, enter beyond the gap bar, stop at the gap edge (p. 41).")
            out.append(Setup(
                f"Gap {'Up' if up else 'Down'}", "bullish" if up else "bearish", str(df.index[i].date()),
                float(h[i]) if up and not filled else None, float(l[i]) if not up and not filled else None, reasons,
                {"gap_edge": round(float(edge), 2), "filled": filled, "gap_type": kind},
            ))
    rng = h - l
    i = n - 1
    tag = None
    if rng[i] < rng[i - 6 : i].min():
        tag = "NR7"
    elif rng[i] < rng[i - 3 : i].min():
        tag = "NR4"
    if tag:
        out.append(Setup(tag, "either", str(df.index[i].date()), float(h[i]), float(l[i]),
                         [f"Narrowest range of the last {tag[2]} bars; trade the break of its high or low (p. 44)."]))
    if h[i] < h[i - 1] and l[i] > l[i - 1]:
        out.append(Setup("Inside Bar", "either", str(df.index[i].date()), float(h[i]), float(l[i]),
                         ["Range inside the previous bar; buy above / sell below the inside bar (p. 43)."]))
    return out


CATALOGUE_ADDED = [
    "Ascending Triangle", "Descending Triangle", "Symmetrical Triangle", "Rising Wedge", "Falling Wedge",
    "Flag", "Pennant", "Gap", "Narrow Range (NR4/NR7)", "Pipe Bottom",
]


def detect_all(df: pd.DataFrame, ind: pd.DataFrame) -> tuple[list[Pattern], list[Setup]]:
    return triangles_and_wedges(df, ind) + flags(df, ind) + pipes(df, ind), short_term(df, ind)
