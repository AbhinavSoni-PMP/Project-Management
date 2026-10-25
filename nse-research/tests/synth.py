"""Synthetic price paths for tests. Clearly artificial: never shown as market data."""

import numpy as np
import pandas as pd


def path(anchors: list[tuple[int, float]], spread: float = 0.3, volume: float = 1e6, spikes: dict | None = None) -> pd.DataFrame:
    """Linear close path through (bar, price) anchors, with simple OHLC around it."""
    n = anchors[-1][0] + 1
    xs, ys = zip(*anchors)
    close = np.interp(np.arange(n), xs, ys)
    open_ = np.r_[close[0], close[:-1]]
    high = np.maximum(open_, close) + spread
    low = np.minimum(open_, close) - spread
    vol = np.full(n, volume)
    for i, mult in (spikes or {}).items():
        vol[i] = volume * mult
    idx = pd.bdate_range("2024-01-01", periods=n, name="date")
    return pd.DataFrame(
        {"open": open_, "high": high, "low": low, "close": close, "raw_close": close, "volume": vol}, index=idx
    )
