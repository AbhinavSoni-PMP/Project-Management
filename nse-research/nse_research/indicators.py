"""Technical indicators calculated from OHLCV bars.

Every function is pure: it takes a frame or series and returns new values,
with NaN until enough bars exist. Nothing here fetches data, and every value
is labelled CALCULATED FROM OHLCV DATA when shown.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

VERSION = "indicators-v1"
TRADING_DAYS = 252


def sma(s: pd.Series, n: int) -> pd.Series:
    return s.rolling(n, min_periods=n).mean()


def ema(s: pd.Series, n: int) -> pd.Series:
    """EMA seeded with the SMA of the first n values (no partial-window values)."""
    out = pd.Series(np.nan, index=s.index)
    vals = s.to_numpy(dtype=float)
    valid = np.flatnonzero(~np.isnan(vals))
    if len(valid) < n:
        return out
    start = valid[0]
    alpha = 2.0 / (n + 1)
    seed_end = start + n - 1
    prev = vals[start : seed_end + 1].mean()
    res = np.full(len(vals), np.nan)
    res[seed_end] = prev
    for i in range(seed_end + 1, len(vals)):
        prev = alpha * vals[i] + (1 - alpha) * prev
        res[i] = prev
    return pd.Series(res, index=s.index)


def wilder(s: pd.Series, n: int) -> pd.Series:
    """Wilder smoothing: seed with the mean of the first n values, then
    prev + (x - prev) / n. Leading NaNs are skipped."""
    vals = s.to_numpy(dtype=float)
    res = np.full(len(vals), np.nan)
    valid = np.flatnonzero(~np.isnan(vals))
    if len(valid) < n:
        return pd.Series(res, index=s.index)
    start = valid[0]
    seed_end = start + n - 1
    prev = vals[start : seed_end + 1].mean()
    res[seed_end] = prev
    for i in range(seed_end + 1, len(vals)):
        prev = prev + (vals[i] - prev) / n
        res[i] = prev
    return pd.Series(res, index=s.index)


def rsi(close: pd.Series, n: int = 14) -> pd.Series:
    delta = close.diff()
    gain = wilder(delta.clip(lower=0), n)
    loss = wilder((-delta).clip(lower=0), n)
    with np.errstate(divide="ignore", invalid="ignore"):
        rs = gain / loss
        out = 100 - 100 / (1 + rs)
    out[(loss == 0) & (gain > 0)] = 100.0
    out[(loss == 0) & (gain == 0)] = 50.0
    return out


def macd(close: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9) -> pd.DataFrame:
    line = ema(close, fast) - ema(close, slow)
    sig = ema(line, signal)
    return pd.DataFrame({"macd": line, "macd_signal": sig, "macd_hist": line - sig})


def true_range(df: pd.DataFrame) -> pd.Series:
    prev_close = df["close"].shift(1)
    tr = pd.concat(
        [df["high"] - df["low"], (df["high"] - prev_close).abs(), (df["low"] - prev_close).abs()],
        axis=1,
    ).max(axis=1, skipna=True)
    tr.iloc[0] = df["high"].iloc[0] - df["low"].iloc[0] if len(df) else np.nan
    return tr


def atr(df: pd.DataFrame, n: int = 14) -> pd.Series:
    return wilder(true_range(df), n)


def adx(df: pd.DataFrame, n: int = 14) -> pd.DataFrame:
    up = df["high"].diff()
    down = -df["low"].diff()
    plus_dm = pd.Series(np.where((up > down) & (up > 0), up, 0.0), index=df.index)
    minus_dm = pd.Series(np.where((down > up) & (down > 0), down, 0.0), index=df.index)
    plus_dm.iloc[0] = np.nan
    minus_dm.iloc[0] = np.nan
    tr = true_range(df)
    tr.iloc[0] = np.nan
    atr_n = wilder(tr, n)
    with np.errstate(divide="ignore", invalid="ignore"):
        plus_di = 100 * wilder(plus_dm, n) / atr_n
        minus_di = 100 * wilder(minus_dm, n) / atr_n
        dx = 100 * (plus_di - minus_di).abs() / (plus_di + minus_di)
    return pd.DataFrame({"plus_di": plus_di, "minus_di": minus_di, "adx": wilder(dx, n)})


def bollinger(close: pd.Series, n: int = 20, k: float = 2.0) -> pd.DataFrame:
    mid = sma(close, n)
    sd = close.rolling(n, min_periods=n).std(ddof=0)
    return pd.DataFrame({"bb_mid": mid, "bb_upper": mid + k * sd, "bb_lower": mid - k * sd})


def stochastic(df: pd.DataFrame, n: int = 14, smooth_k: int = 3, d: int = 3) -> pd.DataFrame:
    lo = df["low"].rolling(n, min_periods=n).min()
    hi = df["high"].rolling(n, min_periods=n).max()
    with np.errstate(divide="ignore", invalid="ignore"):
        raw = 100 * (df["close"] - lo) / (hi - lo)
    k = sma(raw, smooth_k)
    return pd.DataFrame({"stoch_k": k, "stoch_d": sma(k, d)})


def roc(close: pd.Series, n: int = 12) -> pd.Series:
    return 100 * (close / close.shift(n) - 1)


def obv(df: pd.DataFrame) -> pd.Series:
    direction = np.sign(df["close"].diff()).fillna(0)
    return (direction * df["volume"].fillna(0)).cumsum()


def hist_vol(close: pd.Series, n: int = 20) -> pd.Series:
    """Annualised standard deviation of daily log returns, in percent."""
    r = np.log(close / close.shift(1))
    return 100 * r.rolling(n, min_periods=n).std() * np.sqrt(TRADING_DAYS)


def compute_all(df: pd.DataFrame) -> pd.DataFrame:
    """All standard indicators for one symbol's daily bars."""
    c = df["close"]
    out = pd.DataFrame(index=df.index)
    for n in (20, 50, 100, 200):
        out[f"sma{n}"] = sma(c, n)
    for n in (20, 50, 200):
        out[f"ema{n}"] = ema(c, n)
    out = out.join(macd(c))
    out = out.join(adx(df))
    out["rsi14"] = rsi(c)
    out = out.join(stochastic(df))
    out["roc12"] = roc(c)
    out["atr14"] = atr(df)
    out["atr_pct"] = 100 * out["atr14"] / c
    out = out.join(bollinger(c))
    out["hv20"] = hist_vol(c, 20)
    out["hv60"] = hist_vol(c, 60)
    out["vol_sma20"] = sma(df["volume"], 20)
    with np.errstate(divide="ignore", invalid="ignore"):
        out["rel_volume"] = df["volume"] / out["vol_sma20"]
    out["obv"] = obv(df)
    out["traded_value_cr_median20"] = (c * df["volume"]).rolling(20, min_periods=20).median() / 1e7
    return out


def relative_strength(close: pd.Series, benchmark: pd.Series, n: int) -> float | None:
    """Stock return minus benchmark return over n sessions, in percentage points."""
    joined = pd.concat([close, benchmark], axis=1, join="inner").dropna()
    if len(joined) <= n:
        return None
    a = joined.iloc[-1] / joined.iloc[-1 - n] - 1
    return float(100 * (a.iloc[0] - a.iloc[1]))
