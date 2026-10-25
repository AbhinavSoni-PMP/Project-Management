import numpy as np
import pandas as pd

from nse_research.candles import detect_candles
from nse_research.indicators import compute_all
from nse_research.patterns import detect_patterns
from nse_research.swings import find_swings
from synth import path


def with_spike_after(df, start, level, direction, mult=3.0):
    """Put a volume spike on the first close beyond `level` after bar `start`."""
    c = df["close"].to_numpy()
    for i in range(start, len(df)):
        if (c[i] < level) if direction == "down" else (c[i] > level):
            df.iloc[i, df.columns.get_loc("volume")] *= mult
            return i
    raise AssertionError("no breakout bar in synthetic path")


def find(pats, name):
    hits = [p for p in pats if p.name == name]
    assert hits, f"{name} not detected; got {[p.name for p in pats]}"
    return hits[0]


DOUBLE_TOP = [(0, 100), (40, 120), (55, 110), (70, 120.5), (100, 95)]


def test_swings_alternate_and_are_confirmed_after_k_bars():
    df = path(DOUBLE_TOP)
    sw = find_swings(df, 5)
    kinds = [s.kind for s in sw]
    assert all(a != b for a, b in zip(kinds, kinds[1:]))
    assert all(s.confirmed_idx == s.idx + 5 for s in sw)


def test_double_top_confirmed_with_volume():
    df = path(DOUBLE_TOP)
    neck = df["low"].iloc[55]
    with_spike_after(df, 70, neck, "down")
    p = find(detect_patterns(df, compute_all(df)), "Double Top")
    assert p.stage == "CONFIRMED"
    assert p.breakout_level == neck
    assert p.invalidation_level == df["high"].iloc[70]
    assert p.breakout["checks"] == {"distance": True, "multiple_closes": True, "volume": True}
    assert p.as_dict()["historical_reliability"] == "NOT YET BACKTESTED"


def test_double_top_without_volume_is_only_developing():
    df = path(DOUBLE_TOP)
    p = find(detect_patterns(df, compute_all(df)), "Double Top")
    assert p.stage == "DEVELOPING"
    assert p.breakout["checks"]["volume"] is False


def test_close_back_inside_is_a_false_breakout():
    df = path([(0, 100), (40, 120), (55, 110), (70, 120.5), (84, 108.5), (87, 113), (110, 113.5)])
    p = find(detect_patterns(df, compute_all(df)), "Double Top")
    assert p.stage == "FAILED"
    assert p.breakout["status"] == "FALSE_BREAKOUT_RISK"


def test_rally_above_the_peaks_invalidates_before_breakout():
    df = path([(0, 100), (40, 120), (55, 110), (70, 120.5), (78, 114), (100, 132)])
    p = find(detect_patterns(df, compute_all(df)), "Double Top")
    assert p.stage == "FAILED" and p.breakout["status"] == "INVALIDATED"


def test_double_bottom_mirror():
    df = path([(0, 120), (40, 100), (55, 110), (70, 99.6), (100, 125)])
    neck = df["high"].iloc[55]
    with_spike_after(df, 70, neck, "up")
    p = find(detect_patterns(df, compute_all(df)), "Double Bottom")
    assert p.stage == "CONFIRMED" and p.bias == "bullish"


def test_head_and_shoulders():
    df = path([(0, 100), (30, 115), (40, 108), (55, 125), (70, 108.5), (85, 115.5), (115, 95)])
    with_spike_after(df, 85, 108, "down")
    pats = detect_patterns(df, compute_all(df))
    p = find(pats, "Head and Shoulders")
    assert p.stage == "CONFIRMED"
    assert [pt["label"] for pt in p.points] == ["left shoulder", "neckline", "head", "neckline", "right shoulder"]


def test_rectangle_breakout_up():
    df = path([(0, 90), (15, 110), (25, 100), (35, 110), (45, 100), (55, 110), (65, 100), (82, 120)])
    top = df["high"].iloc[[15, 35, 55]].max()
    with_spike_after(df, 65, top, "up")
    p = find(detect_patterns(df, compute_all(df)), "Rectangle")
    assert p.stage == "CONFIRMED"
    assert p.boundary["resistance"] == round(top, 2)


def test_short_history_gives_no_patterns():
    df = path([(0, 100), (40, 110)])
    assert detect_patterns(df, compute_all(df)) == []


def test_random_walk_runs_and_uses_known_stages():
    rng = np.random.default_rng(3)
    close = 100 * np.exp(np.cumsum(rng.normal(0, 0.015, 400)))
    idx = pd.bdate_range("2023-01-02", periods=400)
    df = pd.DataFrame({"close": close}, index=idx)
    df["open"] = df["close"].shift(1).fillna(close[0])
    df["high"] = df[["open", "close"]].max(axis=1) * 1.005
    df["low"] = df[["open", "close"]].min(axis=1) * 0.995
    df["raw_close"] = df["close"]
    df["volume"] = rng.integers(5e5, 2e6, 400).astype(float)
    for p in detect_patterns(df, compute_all(df)):
        assert p.stage in {"CANDIDATE", "DEVELOPING", "CONFIRMED", "FAILED"}
        assert p.confidence in {"low", "medium"}


def candle_frame(rows):
    idx = pd.bdate_range("2024-01-01", periods=len(rows))
    df = pd.DataFrame(rows, columns=["open", "high", "low", "close"], index=idx)
    df["raw_close"] = df["close"]
    df["volume"] = 1e6
    return df


def test_bullish_engulfing_after_a_decline():
    rows = [(110 - i, 110.5 - i, 108.5 - i, 109 - i) for i in range(20)]
    rows += [(90.5, 91, 89, 89.5), (89.2, 92.5, 89, 92)]
    df = candle_frame(rows)
    sig = [c for c in detect_candles(df, compute_all(df)) if c.name == "Bullish Engulfing"]
    assert sig and sig[-1].context["preceding_trend"] == "down"
    assert sig[-1].context["fits_preceding_trend"] is True
    assert sig[-1].context["next_candle_confirmed"] is None  # last bar: not knowable yet


def test_hammer_shape_in_a_range_is_ignored():
    rows = [(100, 101, 99, 100.2), (100.2, 101, 99, 100)] * 8
    rows += [(100, 100.4, 97, 100.3)]  # long lower shadow, no prior trend
    df = candle_frame(rows)
    names = {c.name for c in detect_candles(df, compute_all(df))}
    assert "Hammer" not in names and "Hanging Man" not in names
