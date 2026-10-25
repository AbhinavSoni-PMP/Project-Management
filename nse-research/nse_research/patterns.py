"""Chart-pattern detection from swing points.

Each detector applies fixed, versioned geometric rules to the alternating
swing list and hands the boundary to the shared breakout validator. A match
that misses a rule is simply not reported; nothing is "nearly" a pattern.

Stages:
  CANDIDATE   structure matches, no close beyond the boundary yet
  DEVELOPING  price crossed the boundary, confirmation incomplete
  CONFIRMED   breakout passed every check
  FAILED      invalidated before breakout, or closed back inside after it
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from . import labels
from .breakout import RULES_VERSION as BREAKOUT_RULES, evaluate_breakout
from .swings import Swing, find_swings

RULES_VERSION = "patterns-v1"
SWING_K = 5
PEAK_TOL = 0.03  # peaks (troughs) of a double/triple within 3% of each other
SHOULDER_TOL = 0.05  # head-and-shoulders shoulders within 5%
MIN_SEPARATION = 10  # bars between the outer peaks of a double
MIN_DEPTH_ATR = 1.0  # peaks must stand at least 1 ATR above the trough
RECT_BAND = 0.03
RECT_MIN_HEIGHT_ATR = 2.0
RECT_MAX_HEIGHT = 0.20
LOOKBACK_BARS = 120  # only report structures whose last point is this recent

# Every structure named in the spec, and whether this version detects it.
CATALOGUE = {
    "Double Top": True,
    "Double Bottom": True,
    "Triple Top": True,
    "Triple Bottom": True,
    "Head and Shoulders": True,
    "Inverse Head and Shoulders": True,
    "Rectangle": True,
    "Ascending Triangle": False,
    "Descending Triangle": False,
    "Symmetrical Triangle": False,
    "Rising Wedge": False,
    "Falling Wedge": False,
    "Flag": False,
    "Pennant": False,
    "Cup and Handle": False,
    "Gap": False,
    "Narrow Range (NR4/NR7)": False,
    "Pipe Bottom": False,
}

STAGE_FROM_BREAKOUT = {
    "NO_BREAKOUT": "CANDIDATE",
    "POSSIBLE_BREAKOUT": "DEVELOPING",
    "BREAKOUT": "CONFIRMED",
    "FALSE_BREAKOUT_RISK": "FAILED",
    "INVALIDATED": "FAILED",
}


@dataclass
class Pattern:
    name: str
    family: str  # reversal | continuation
    bias: str  # bullish | bearish | either
    timeframe: str
    points: list[dict]
    boundary: dict
    breakout_level: float
    invalidation_level: float | None
    stage: str
    breakout: dict
    target_textbook: float | None
    reasons: list[str] = field(default_factory=list)

    @property
    def start(self) -> str:
        return self.points[0]["date"]

    @property
    def end(self) -> str:
        return self.points[-1]["date"]

    def as_dict(self, current_price: float | None = None) -> dict:
        checks = self.breakout.get("checks", {})
        return {
            "name": self.name,
            "family": self.family,
            "bias": self.bias,
            "timeframe": self.timeframe,
            "formation_start": self.start,
            "formation_end": self.end,
            "points": self.points,
            "boundary": self.boundary,
            "breakout_level": round(self.breakout_level, 2),
            "current_price": current_price,
            "invalidation_level": None if self.invalidation_level is None else round(self.invalidation_level, 2),
            "stage": self.stage,
            "breakout": self.breakout,
            "volume_confirmation": checks.get("volume"),
            "target_textbook": None if self.target_textbook is None else round(self.target_textbook, 2),
            "target_note": "Textbook measured move from the reference; not validated by backtest.",
            "historical_reliability": labels.NOT_BACKTESTED,
            "confidence": self.confidence,
            "reasons": self.reasons,
            "rules_version": f"{RULES_VERSION}/{BREAKOUT_RULES}",
            "label": labels.CALCULATED,
        }

    @property
    def confidence(self) -> str:
        # Capped at medium until pattern backtests give an empirical basis.
        if self.stage == "CONFIRMED":
            return "medium"
        return "low"


def _pt(s: Swing, label: str) -> dict:
    return {"date": str(s.date.date()), "price": round(s.price, 2), "label": label}


def _within(a: float, b: float, tol: float) -> bool:
    return abs(a - b) / max(a, b) <= tol


def _atr_at(ind: pd.DataFrame, i: int) -> float:
    v = ind["atr14"].iloc[i]
    return float(v) if not np.isnan(v) else float("nan")


def _build(df, ind, name, family, bias, timeframe, pts, boundary, level_fn, direction, start_idx, invalidation, target, reasons):
    br = evaluate_breakout(df, ind, start_idx, level_fn, direction, invalidation)
    return Pattern(
        name=name,
        family=family,
        bias=bias,
        timeframe=timeframe,
        points=pts,
        boundary=boundary,
        breakout_level=float(level_fn(len(df) - 1)),
        invalidation_level=invalidation,
        stage=STAGE_FROM_BREAKOUT[br.status],
        breakout=br.as_dict(),
        target_textbook=target,
        reasons=reasons + br.notes,
    )


def _doubles(df, ind, sw, tf):
    out = []
    for a, b, c in zip(sw, sw[1:], sw[2:]):
        top = a.kind == "H"
        if c.idx - a.idx < MIN_SEPARATION or not _within(a.price, c.price, PEAK_TOL):
            continue
        atr = _atr_at(ind, b.idx)
        extreme = max(a.price, c.price) if top else min(a.price, c.price)
        depth = (min(a.price, c.price) - b.price) if top else (b.price - max(a.price, c.price))
        if np.isnan(atr) or depth < MIN_DEPTH_ATR * atr:
            continue
        neck = b.price
        height = abs(extreme - neck)
        name = "Double Top" if top else "Double Bottom"
        label = "peak" if top else "trough"
        reasons = [
            f"Two {label}s {abs(a.price - c.price) / max(a.price, c.price):.1%} apart, {c.idx - a.idx} bars between them.",
            f"Middle {'trough' if top else 'peak'} {depth:.2f} ({depth / atr:.1f} ATR) from the nearer {label}.",
            f"Neckline at {neck:.2f}; the pattern completes only on a close {'below' if top else 'above'} it.",
        ]
        out.append(
            _build(
                df, ind, name, "reversal", "bearish" if top else "bullish", tf,
                [_pt(a, f"{label} 1"), _pt(b, "neckline"), _pt(c, f"{label} 2")],
                {"neckline": round(neck, 2)},
                lambda i, v=neck: v,
                "down" if top else "up",
                c.confirmed_idx,
                extreme,
                neck - height if top else neck + height,
                reasons,
            )
        )
    return out


def _five_point(df, ind, sw, tf):
    out = []
    for a, b, c, d, e in zip(sw, sw[1:], sw[2:], sw[3:], sw[4:]):
        top = a.kind == "H"
        atr = _atr_at(ind, c.idx)
        if np.isnan(atr):
            continue
        # Head and shoulders: middle extreme beyond both shoulders by 1 ATR.
        shoulder = max(a.price, e.price) if top else min(a.price, e.price)
        head_gap = (c.price - shoulder) if top else (shoulder - c.price)
        head_ok = head_gap >= MIN_DEPTH_ATR * atr
        if head_ok and _within(a.price, e.price, SHOULDER_TOL):
            slope = (d.price - b.price) / (d.idx - b.idx)
            line = lambda i, b=b, s=slope: b.price + s * (i - b.idx)
            height = abs(c.price - line(c.idx))
            name = "Head and Shoulders" if top else "Inverse Head and Shoulders"
            reasons = [
                f"Head {head_gap:.2f} ({head_gap / atr:.1f} ATR) beyond the {'higher' if top else 'lower'} shoulder.",
                f"Shoulders {abs(a.price - e.price) / max(a.price, e.price):.1%} apart.",
                f"Neckline drawn through {b.date.date()} and {d.date.date()}.",
            ]
            last = len(df) - 1
            out.append(
                _build(
                    df, ind, name, "reversal", "bearish" if top else "bullish", tf,
                    [_pt(a, "left shoulder"), _pt(b, "neckline"), _pt(c, "head"), _pt(d, "neckline"), _pt(e, "right shoulder")],
                    {"neckline_start": round(line(b.idx), 2), "neckline_now": round(line(last), 2), "slope_per_bar": round(slope, 4)},
                    line,
                    "down" if top else "up",
                    e.confirmed_idx,
                    e.price,
                    line(last) - height if top else line(last) + height,
                    reasons,
                )
            )
            continue
        # Triple top/bottom: three extremes within tolerance of each other.
        peaks = [a.price, c.price, e.price]
        if max(peaks) / min(peaks) - 1 > PEAK_TOL or e.idx - a.idx < 2 * MIN_SEPARATION:
            continue
        neck = min(b.price, d.price) if top else max(b.price, d.price)
        extreme = max(peaks) if top else min(peaks)
        if abs(extreme - neck) < MIN_DEPTH_ATR * atr:
            continue
        height = abs(extreme - neck)
        name = "Triple Top" if top else "Triple Bottom"
        label = "peak" if top else "trough"
        out.append(
            _build(
                df, ind, name, "reversal", "bearish" if top else "bullish", tf,
                [_pt(a, f"{label} 1"), _pt(b, "reaction"), _pt(c, f"{label} 2"), _pt(d, "reaction"), _pt(e, f"{label} 3")],
                {"breakout_line": round(neck, 2)},
                lambda i, v=neck: v,
                "down" if top else "up",
                e.confirmed_idx,
                extreme,
                neck - height if top else neck + height,
                [
                    f"Three {label}s within {max(peaks) / min(peaks) - 1:.1%} of each other.",
                    f"Breakout line at the {'lower' if top else 'higher'} intervening {'trough' if top else 'peak'}, {neck:.2f}.",
                ],
            )
        )
    return out


def _rectangles(df, ind, sw, tf):
    found = []
    n = len(sw)
    for size in range(8, 3, -1):
        for s in range(0, n - size + 1):
            win = sw[s : s + size]
            hs = [w.price for w in win if w.kind == "H"]
            ls = [w.price for w in win if w.kind == "L"]
            if len(hs) < 2 or len(ls) < 2:
                continue
            if max(hs) / min(hs) - 1 > RECT_BAND or max(ls) / min(ls) - 1 > RECT_BAND:
                continue
            top, bot = max(hs), min(ls)
            atr = _atr_at(ind, win[-1].idx)
            height = top - bot
            if np.isnan(atr) or height < RECT_MIN_HEIGHT_ATR * atr or height / top > RECT_MAX_HEIGHT:
                continue
            span = (win[0].idx, win[-1].idx)
            if any(f[0] <= span[0] and span[1] <= f[1] for f, _ in found):
                continue
            last_conf = max(w.confirmed_idx for w in win)
            up = evaluate_breakout(df, ind, last_conf, lambda i, v=top: v, "up")
            down = evaluate_breakout(df, ind, last_conf, lambda i, v=bot: v, "down")
            if up.breakout_date and (not down.breakout_date or up.breakout_date <= down.breakout_date):
                direction, level, target, invalid = "up", top, top + height, bot
            elif down.breakout_date:
                direction, level, target, invalid = "down", bot, bot - height, top
            else:
                direction, level, target, invalid = "up", top, None, None
            pts = [_pt(w, "resistance touch" if w.kind == "H" else "support touch") for w in win]
            p = _build(
                df, ind, "Rectangle", "continuation", "either", tf, pts,
                {"resistance": round(top, 2), "support": round(bot, 2)},
                lambda i, v=level: v, direction, last_conf, invalid, target,
                [
                    f"{len(hs)} touches near resistance {top:.2f} and {len(ls)} near support {bot:.2f}.",
                    f"Range height {height:.2f} ({height / atr:.1f} ATR).",
                    "Rectangles often have false breakouts, so confirmation matters (reference, p. 23).",
                ],
            )
            if target is None:
                p.boundary["note"] = "No breakout in either direction yet."
            found.append((span, p))
    return [p for _, p in found]


def detect_patterns(df: pd.DataFrame, ind: pd.DataFrame, timeframe: str = "daily") -> list[Pattern]:
    """All supported patterns whose last point is within LOOKBACK_BARS."""
    if len(df) < 60:
        return []
    sw = find_swings(df, SWING_K)
    cutoff = df.index[max(0, len(df) - LOOKBACK_BARS)]
    pats = _five_point(df, ind, sw, timeframe)
    covered = {pt["date"] for p in pats if p.name.startswith("Triple") for pt in p.points}
    for p in _doubles(df, ind, sw, timeframe):
        if p.points[0]["date"] in covered and p.points[-1]["date"] in covered:
            continue
        pats.append(p)
    pats += _rectangles(df, ind, sw, timeframe)
    recent = [p for p in pats if pd.Timestamp(p.end) >= cutoff]
    order = {"CONFIRMED": 0, "DEVELOPING": 1, "CANDIDATE": 2, "FAILED": 3}
    recent.sort(key=lambda p: p.end, reverse=True)
    recent.sort(key=lambda p: order[p.stage])
    return recent
