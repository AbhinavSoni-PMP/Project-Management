"""Export synthetic cases and Python engine outputs for artifact/compare_engine.js."""

import dataclasses
import json
import sys

import numpy as np
import pandas as pd

sys.path[:0] = [".", "tests"]
from nse_research.analysis import weekly_trend  # noqa: E402
from nse_research.candles import detect_candles  # noqa: E402
from nse_research.indicators import compute_all  # noqa: E402
from nse_research.normalize import resample  # noqa: E402
from nse_research.patterns import detect_patterns  # noqa: E402
from nse_research.swings import find_swings  # noqa: E402
from synth import path  # noqa: E402


def walk(seed, n=700):
    rng = np.random.default_rng(seed)
    close = 100 * np.exp(np.cumsum(rng.normal(0, 0.015, n)))
    df = pd.DataFrame({"close": close}, index=pd.bdate_range("2022-01-03", periods=n, name="date"))
    df["open"] = df["close"].shift(1).fillna(close[0]) * (1 + rng.normal(0, 0.003, n))
    df["high"] = df[["open", "close"]].max(axis=1) * (1 + rng.uniform(0, 0.01, n))
    df["low"] = df[["open", "close"]].min(axis=1) * (1 - rng.uniform(0, 0.01, n))
    df["raw_close"] = df["close"]
    df["volume"] = rng.integers(5e5, 3e6, n).astype(float)
    return df


def clean(v):
    if isinstance(v, float) and (np.isnan(v) or np.isinf(v)):
        return None
    if isinstance(v, (np.floating,)):
        return clean(float(v))
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.bool_,)):
        return bool(v)
    if isinstance(v, dict):
        return {k: clean(x) for k, x in v.items()}
    if isinstance(v, (list, tuple)):
        return [clean(x) for x in v]
    return v


cases = []
synthetic = {
    "double_top": path([(0, 100), (40, 120), (55, 110), (70, 120.5), (100, 95)], spikes={83: 3}),
    "hs": path([(0, 100), (30, 115), (45, 105), (65, 125), (80, 106), (100, 114), (115, 104), (140, 92)]),
    "rect": path([(0, 100), (15, 110), (25, 100), (35, 110), (45, 100), (55, 110), (65, 100), (75, 109), (90, 118)]),
}
frames = list(synthetic.items()) + [(f"walk{s}", walk(s)) for s in range(12)]
for name, df in frames:
    ind = compute_all(df)
    wk = resample(df, "W")
    wt = weekly_trend(df)
    bars = [
        {"date": str(d.date()), **{c: clean(float(df.loc[d, c])) for c in ["open", "high", "low", "close", "raw_close", "volume"]}}
        for d in df.index
    ]
    cases.append({
        "name": name,
        "bars": bars,
        "indicators": {c: clean(ind[c].tolist()) for c in ind.columns},
        "swings": [clean(dataclasses.asdict(s) | {"date": str(s.date)[:10]}) for s in find_swings(df)],
        "patterns": [clean(p.as_dict()) for p in detect_patterns(df, ind)],
        "candles": [clean(dataclasses.asdict(c)) for c in detect_candles(df, ind, weekly_trend=wt.get("trend") if isinstance(wt, dict) else wt)],
        "weekly": [{"date": str(d.date()), "close": float(r.close), "volume": clean(float(r.volume))} for d, r in wk.iterrows()],
        "weekly_trend": wt,
    })
json.dump(cases, open(sys.argv[1], "w"))
print(len(cases), "cases")
