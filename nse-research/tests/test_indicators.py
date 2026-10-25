import numpy as np
import pandas as pd
import pytest

from nse_research import indicators as ta
from synth import path


def series(vals):
    return pd.Series(vals, index=pd.bdate_range("2024-01-01", periods=len(vals)), dtype=float)


def test_sma_needs_full_window():
    s = ta.sma(series([1, 2, 3, 4, 5]), 3)
    assert s.isna().sum() == 2
    assert s.iloc[-1] == 4


def test_ema_seed_and_recursion():
    vals = [10, 11, 12, 13, 14, 15]
    e = ta.ema(series(vals), 3)
    a = 2 / 4
    expected = np.mean(vals[:3])
    assert e.iloc[2] == pytest.approx(expected)
    for v in vals[3:]:
        expected = a * v + (1 - a) * expected
    assert e.iloc[-1] == pytest.approx(expected)


def reference_rsi(close, n=14):
    """Independent loop implementation of Wilder's RSI."""
    d = np.diff(close)
    g, l = np.clip(d, 0, None), np.clip(-d, 0, None)
    ag, al = g[:n].mean(), l[:n].mean()
    out = [100 - 100 / (1 + ag / al)]
    for i in range(n, len(d)):
        ag = (ag * (n - 1) + g[i]) / n
        al = (al * (n - 1) + l[i]) / n
        out.append(100 - 100 / (1 + ag / al))
    return np.array(out)


def test_rsi_matches_reference_implementation():
    rng = np.random.default_rng(7)
    close = 100 + np.cumsum(rng.normal(0, 1, 120))
    got = ta.rsi(series(close)).dropna().to_numpy()
    assert np.allclose(got, reference_rsi(close))


def test_rsi_extremes():
    assert ta.rsi(series(range(1, 40))).iloc[-1] == 100
    assert ta.rsi(series(range(40, 1, -1))).iloc[-1] == 0
    assert ta.rsi(series([5.0] * 30)).iloc[-1] == 50


def test_atr_of_constant_range_bars():
    df = pd.DataFrame({"open": 100.0, "high": 101.0, "low": 99.0, "close": 100.0}, index=pd.bdate_range("2024-01-01", periods=30))
    assert ta.atr(df).iloc[-1] == pytest.approx(2.0)


def test_bollinger_collapses_on_flat_prices():
    b = ta.bollinger(series([50.0] * 25)).iloc[-1]
    assert b.bb_upper == b.bb_lower == b.bb_mid == 50


def test_adx_is_high_in_a_steady_trend_and_bounded():
    df = path([(0, 100), (120, 220)])
    a = ta.adx(df).dropna()
    assert ((a["adx"] >= 0) & (a["adx"] <= 100)).all()
    assert a["adx"].iloc[-1] > 50
    assert a["plus_di"].iloc[-1] > a["minus_di"].iloc[-1]


def test_obv_direction():
    df = pd.DataFrame({"close": [10, 11, 10.5, 10.5], "volume": [100, 200, 50, 70]}, index=pd.bdate_range("2024-01-01", periods=4))
    assert ta.obv(df).tolist() == [0, 200, 150, 150]


def test_compute_all_has_no_values_before_enough_bars():
    df = path([(0, 100), (150, 130)])
    ind = ta.compute_all(df)
    assert ind["sma200"].isna().all()
    assert ind["sma50"].notna().sum() == len(df) - 49


def test_relative_strength():
    a = series([100, 110])
    b = series([100, 105])
    assert ta.relative_strength(a, b, 1) == pytest.approx(5.0)
