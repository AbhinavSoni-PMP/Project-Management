"""Entry timer: are the entry rules met on the latest bar, and if not, what
would have to happen.

Verdicts (long side only):
    RULES MET   trend filter, not-extended filter and at least one trigger
                passed on the last close; the plan is to enter at the next open
    WAIT        trend is up but no trigger yet, or the move is extended;
                the buy-stop level that would trigger a breakout is shown
    AVOID       downtrend, or a confirmed bearish pattern on the chart

A verdict says the written rules are or are not met. It is not a forecast:
run the time machine to see how these rules did on this stock in the past.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from ..candles import detect_candles
from ..indicators import compute_all
from ..patterns import detect_patterns
from . import setups, strategies

RULES_MET, WAIT, AVOID = "RULES MET", "WAIT", "AVOID"


def _r(v, nd=2):
    return None if v is None or (isinstance(v, float) and np.isnan(v)) else round(float(v), nd)


def check(df: pd.DataFrame, symbol: str = "", days_to_earnings: int | None = None) -> dict:
    if len(df) < 210:
        return {"symbol": symbol, "verdict": "NOT ENOUGH DATA", "reasons": [f"Needs 210 daily bars for the 200-day trend filter, have {len(df)}."]}
    ind = compute_all(df)
    cond = strategies.conditions(df, ind)
    last = cond.iloc[-1]
    li = ind.iloc[-1]
    close = float(df["close"].iloc[-1])
    pats = detect_patterns(df, ind)
    extra_pats, short = setups.detect_all(df, ind)
    all_pats = pats + extra_pats
    recent_confirmed = [p for p in all_pats if p.stage == "CONFIRMED" and p.breakout.get("breakout_date")
                        and pd.Timestamp(p.breakout["breakout_date"]) >= df.index[-10]]
    bearish = [p.name for p in recent_confirmed if p.bias == "bearish"]
    bullish = [p.name for p in recent_confirmed if p.bias in ("bullish", "either") and p.breakout_level < close]
    triggers = [k for k in strategies.STRATEGIES if bool(last[k])]

    checks = {
        "uptrend (close > 200 SMA and 50 SMA > 200 SMA)": bool(last["uptrend"]),
        f"not extended (RSI < {strategies.RSI_MAX}, close < {strategies.EXTENDED_ATR} ATR above 20 EMA)": bool(last["not_extended"]),
        "a trigger fired on the last close": bool(triggers),
    }
    reasons = []
    if days_to_earnings is not None:
        ok = days_to_earnings > 5
        checks["no earnings report in the next 5 days"] = ok
        if not ok:
            reasons.append(f"Earnings in {days_to_earnings} days: a gap can jump the stop.")

    if last["downtrend"] or bearish:
        verdict = AVOID
        if last["downtrend"]:
            reasons.append("Price is below a falling 200-day trend: these rules only buy uptrends.")
        if bearish:
            reasons.append("Confirmed bearish pattern in the last 10 bars: " + ", ".join(bearish) + ".")
    elif all(checks.values()):
        verdict = RULES_MET
        reasons.append("Triggers: " + ", ".join(f"{t} ({strategies.STRATEGIES[t]})" for t in triggers))
    else:
        verdict = WAIT
        if not last["uptrend"]:
            reasons.append("Trend filter not met yet.")
        if not last["not_extended"]:
            reasons.append("Price is stretched; waiting for a pullback lowers the risk per share.")
        if not triggers:
            reasons.append("No trigger on the last close.")

    prior_high = float(df["high"].tail(strategies.BREAKOUT_BARS).max())
    watch = {
        "breakout buy-stop": _r(prior_high + 0.01 * float(li["atr14"])),
        "pullback zone (20 EMA)": _r(li["ema20"]),
    }
    for s in short:
        if s.name in ("NR7", "NR4", "Inside Bar") and s.trigger_long:
            watch[f"{s.name} buy-stop"] = _r(s.trigger_long)
    return {
        "symbol": symbol,
        "date": str(df.index[-1].date()),
        "close": _r(close),
        "verdict": verdict,
        "checks": checks,
        "triggers": triggers,
        "reasons": reasons,
        "watch_levels": watch,
        "context": {
            "rsi14": _r(li["rsi14"], 1),
            "adx": _r(li["adx"], 1),
            "rel_volume": _r(li["rel_volume"]),
            "atr14": _r(li["atr14"]),
            "confirmed_bullish_patterns": bullish,
            "patterns": [{"name": p.name, "stage": p.stage, "bias": p.bias} for p in all_pats[:6]],
            "setups": [s.name for s in short],
            "latest_candles": [c.name for c in detect_candles(df, ind, last_n=3)],
        },
        "rules_version": strategies.RULES_VERSION,
        "next_step": "Run the time machine on this symbol to see how these rules did before risking money.",
    }
