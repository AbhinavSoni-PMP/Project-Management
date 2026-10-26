"""Time machine: replay the entry and exit rules on a stock's history, then
run thousands of simulated futures before any money is at risk.

1. Replay. Walk forward bar by bar. When the entry rules fire on a close,
   buy at the next open, then exit with the exit plan. One position at a
   time, costs on both sides, no look-ahead.

2. Trade Monte Carlo. Resample the replay's trades (with replacement) into
   10,000 alternative one-year sequences, compounding at a fixed risk per
   trade. This shows the spread of outcomes the same edge could have
   produced in a different order, including drawdowns.

3. Path Monte Carlo ("if I buy today"). Build 10,000 future price paths by
   stitching together random 5-day blocks of this stock's own daily bars,
   start them at today's close, and apply the exit plan to every path. It is
   run twice: with the stock's past drift, and with the drift removed, which
   is what the odds look like if the past trend does not repeat.

Every number here is an estimate from past data. Markets change, and a
rule that worked on one history can fail on the next. Treat a weak or
negative result as a reason not to trade; treat a good result as a reason
to paper trade first, not as a promise.
"""

from __future__ import annotations

from dataclasses import asdict

import numpy as np
import pandas as pd

from ..indicators import compute_all
from . import DISCLAIMER, strategies
from .exits import REASONS, ExitRules, net_return, walk_many

RULES_VERSION = "timemachine-v1"
WARMUP = 200
BLOCK = 5
TRADING_DAYS = 252


def replay(df: pd.DataFrame, strategy: str = "any", rules: ExitRules | None = None) -> dict:
    rules = rules or ExitRules()
    ind = compute_all(df)
    sig = strategies.signals(df, ind, strategy)
    o, h, l, c = (df[k].to_numpy(float) for k in ("open", "high", "low", "close"))
    atr = ind["atr14"].to_numpy(float)
    n = len(df)
    trades = []
    i = WARMUP
    while i < n - 1:
        if not sig[i] or np.isnan(atr[i]):
            i += 1
            continue
        e = i + 1
        entry = o[e]
        stop = entry - rules.stop_atr * atr[i]
        px, bar, why = walk_many(o[e:], h[e:], l[e:], c[e:], entry, stop, atr[i], rules)
        x = e + int(bar[0])
        ret = float(net_return(entry, px[0], rules.cost_bps))
        open_trade = x == n - 1 and why[0] == 4 and (x - e + 1) < rules.max_bars
        trades.append({
            "signal_date": str(df.index[i].date()),
            "entry_date": str(df.index[e].date()),
            "entry": round(float(entry), 2),
            "stop": round(float(stop), 2),
            "exit_date": str(df.index[x].date()),
            "exit": round(float(px[0]), 2),
            "exit_reason": "still open (marked at last close)" if open_trade else REASONS[int(why[0])],
            "bars": x - e + 1,
            "return_pct": round(100 * ret, 2),
            "r_multiple": round(ret * entry / (entry - stop), 2),
            "open": open_trade,
        })
        i = x + 1
    closed = [t for t in trades if not t["open"]]
    years = max((n - WARMUP) / TRADING_DAYS, 1e-9)
    return {"trades": trades, "stats": _stats(closed, df, years, rules), "strategy": strategy}


def _stats(trades: list[dict], df: pd.DataFrame, years: float, rules: ExitRules, risk_pct: float = 1.0) -> dict:
    tested = df.iloc[WARMUP:]
    bh = float(tested["close"].iloc[-1] / tested["close"].iloc[0] - 1) if len(tested) > 1 else None
    if not trades:
        return {"trades": 0, "years_tested": round(years, 1), "buy_and_hold_pct": None if bh is None else round(100 * bh, 1),
                "note": "The rules never fired on this history, so there is nothing to estimate from."}
    r = np.array([t["r_multiple"] for t in trades])
    ret = np.array([t["return_pct"] for t in trades]) / 100
    wins, losses = ret[ret > 0], ret[ret <= 0]
    eq = np.cumprod(1 + risk_pct / 100 * r)
    dd = 1 - eq / np.maximum.accumulate(np.r_[1.0, eq])[1:]
    pf = float(wins.sum() / -losses.sum()) if losses.sum() < 0 else None
    out = {
        "trades": len(trades),
        "trades_per_year": round(len(trades) / years, 1),
        "years_tested": round(years, 1),
        "win_rate_pct": round(100 * len(wins) / len(ret), 1),
        "avg_win_pct": round(float(100 * wins.mean()), 2) if len(wins) else None,
        "avg_loss_pct": round(float(100 * losses.mean()), 2) if len(losses) else None,
        "expectancy_r": round(float(r.mean()), 3),
        "profit_factor": None if pf is None else round(pf, 2),
        "avg_bars_held": round(float(np.mean([t["bars"] for t in trades])), 1),
        f"equity_change_pct_at_{risk_pct:g}pct_risk": round(float(100 * (eq[-1] - 1)), 1),
        f"max_drawdown_pct_at_{risk_pct:g}pct_risk": round(100 * float(dd.max()), 1),
        "buy_and_hold_pct": None if bh is None else round(100 * bh, 1),
        "exit_reasons": pd.Series([t["exit_reason"] for t in trades]).value_counts().to_dict(),
    }
    if len(trades) < 30:
        out["sample_warning"] = f"Only {len(trades)} trades: too few to trust the averages. Test more symbols or a longer history."
    return out


def trade_monte_carlo(r_multiples, trades_per_year: float, paths: int = 10_000, years: float = 1.0,
                      risk_pct: float = 1.0, seed: int = 7) -> dict:
    r = np.asarray(r_multiples, float)
    if len(r) == 0:
        return {"note": "No trades to resample."}
    k = max(1, int(round(trades_per_year * years)))
    rng = np.random.default_rng(seed)
    draws = rng.choice(r, size=(paths, k), replace=True)
    eq = np.cumprod(1 + risk_pct / 100 * draws, axis=1)
    final = eq[:, -1] - 1
    peak = np.maximum.accumulate(np.concatenate([np.ones((paths, 1)), eq], axis=1), axis=1)[:, 1:]
    mdd = (1 - eq / peak).max(axis=1)
    q = lambda a, p: round(100 * float(np.percentile(a, p)), 1)
    return {
        "paths": paths,
        "trades_per_path": k,
        "risk_per_trade_pct": risk_pct,
        "prob_profit_pct": round(100 * float((final > 0).mean()), 1),
        "median_return_pct": q(final, 50),
        "p5_return_pct": q(final, 5),
        "p95_return_pct": q(final, 95),
        "prob_loss_over_10pct": round(100 * float((final < -0.10).mean()), 1),
        "median_max_drawdown_pct": q(mdd, 50),
        "p95_max_drawdown_pct": q(mdd, 95),
        "hist": np.histogram(100 * final, bins=40),
    }


def _bars_relative(df: pd.DataFrame) -> np.ndarray:
    """Each bar as log ratios to the previous close: open, high, low, close."""
    pc = df["close"].shift(1)
    rel = np.log(df[["open", "high", "low", "close"]].div(pc, axis=0)).iloc[1:]
    return rel.dropna().to_numpy(float)


def simulate_paths(df: pd.DataFrame, bars: int, paths: int = 10_000, drift: bool = True, seed: int = 11) -> np.ndarray:
    """(4, paths, bars) arrays of open, high, low, close from block bootstrap."""
    rel = _bars_relative(df)
    if len(rel) < BLOCK * 4:
        raise ValueError("not enough history to simulate")
    if not drift:
        rel = rel - rel[:, 3].mean()  # shift every field so the mean close-to-close move is zero
    rng = np.random.default_rng(seed)
    nblocks = -(-bars // BLOCK)
    starts = rng.integers(0, len(rel) - BLOCK + 1, size=(paths, nblocks))
    idx = (starts[:, :, None] + np.arange(BLOCK)).reshape(paths, -1)[:, :bars]
    r = rel[idx]  # (paths, bars, 4)
    prev = float(df["close"].iloc[-1]) * np.exp(np.concatenate([np.zeros((paths, 1)), np.cumsum(r[:, :-1, 3], axis=1)], axis=1))
    ohlc = prev[None] * np.exp(np.moveaxis(r, 2, 0))
    ohlc[1] = np.maximum.reduce(ohlc)  # keep high >= open, close and low >= ... after rounding
    ohlc[2] = np.minimum.reduce(ohlc[[0, 2, 3]])
    return ohlc


def path_monte_carlo(df: pd.DataFrame, rules: ExitRules | None = None, paths: int = 10_000, drift: bool = True, seed: int = 11) -> dict:
    rules = rules or ExitRules()
    ind = compute_all(df)
    atr = float(ind["atr14"].iloc[-1])
    o, h, l, c = simulate_paths(df, rules.max_bars, paths, drift, seed)
    entry = o[:, 0]
    stop = entry - rules.stop_atr * atr
    px, bar, why = walk_many(o, h, l, c, entry, stop, atr, rules)
    ret = net_return(entry, px, rules.cost_bps)
    r = ret * entry / (entry - stop)
    q = lambda a, p: round(float(np.percentile(a, p)), 2)
    band = {f"p{p}": np.percentile(c, p, axis=0).round(2).tolist() for p in (5, 25, 50, 75, 95)}
    return {
        "paths": paths,
        "drift": "past drift kept" if drift else "drift removed",
        "start_price": round(float(df["close"].iloc[-1]), 2),
        "prob_profit_pct": round(100 * float((ret > 0).mean()), 1),
        "prob_target_pct": round(100 * float((why == 2).mean()), 1),
        "prob_stop_pct": round(100 * float((why == 1).mean()), 1),
        "prob_trailing_pct": round(100 * float((why == 3).mean()), 1),
        "prob_time_exit_pct": round(100 * float((why == 4).mean()), 1),
        "expected_r": round(float(r.mean()), 3),
        "median_return_pct": q(100 * ret, 50),
        "p5_return_pct": q(100 * ret, 5),
        "p95_return_pct": q(100 * ret, 95),
        "avg_bars_held": round(float(bar.mean() + 1), 1),
        "fan": band,
    }


def verdict(stats: dict, mc_trades: dict, mc_drift: dict, mc_flat: dict) -> dict:
    """Plain-language summary with the reason, never stronger than the data."""
    notes = []
    n = stats.get("trades", 0)
    exp = stats.get("expectancy_r")
    if not n:
        label = "NO EVIDENCE"
        notes.append("The rules never fired on this history.")
    elif n < 30:
        label = "NOT ENOUGH TRADES"
        notes.append(f"{n} historical trades is too few to estimate an edge.")
    elif exp is not None and exp > 0.1 and mc_trades.get("prob_profit_pct", 0) >= 70:
        label = "HISTORICAL EDGE"
        notes.append(f"Average trade +{exp:.2f}R over {n} trades; {mc_trades['prob_profit_pct']}% of resampled years ended up.")
    elif exp is not None and exp > 0:
        label = "WEAK EDGE"
        notes.append(f"Average trade +{exp:.2f}R, but outcomes vary widely between resampled years.")
    else:
        label = "NO EDGE"
        notes.append(f"Average trade {exp:+.2f}R: these rules lost money on this history.")
    gap = mc_drift["prob_profit_pct"] - mc_flat["prob_profit_pct"]
    if gap > 10:
        notes.append(f"Buying today looks {gap:.0f} points better with the stock's past drift than without it, so the odds lean on the past trend continuing.")
    notes.append(DISCLAIMER)
    return {"label": label, "notes": notes}


def run(df: pd.DataFrame, symbol: str = "", strategy: str = "any", rules: ExitRules | None = None,
        paths: int = 10_000, risk_pct: float = 1.0, years: float = 1.0) -> dict:
    rules = rules or ExitRules()
    rep = replay(df, strategy, rules)
    closed = [t for t in rep["trades"] if not t["open"]]
    tpy = rep["stats"].get("trades_per_year") or 0
    mc_t = trade_monte_carlo([t["r_multiple"] for t in closed], tpy, paths, years, risk_pct)
    mc_d = path_monte_carlo(df, rules, paths, drift=True)
    mc_f = path_monte_carlo(df, rules, paths, drift=False)
    return {
        "symbol": symbol,
        "as_of": str(df.index[-1].date()),
        "source": str(df["source"].iloc[-1]) if "source" in df else None,
        "strategy": strategy,
        "strategy_rules": strategies.STRATEGIES if strategy == "any" else {strategy: strategies.STRATEGIES[strategy]},
        "exit_rules": asdict(rules),
        "replay": rep,
        "trade_monte_carlo": mc_t,
        "buy_today_monte_carlo": {"with_drift": mc_d, "without_drift": mc_f},
        "verdict": verdict(rep["stats"], mc_t, mc_d, mc_f),
        "rules_version": RULES_VERSION,
        "disclaimer": DISCLAIMER,
    }
