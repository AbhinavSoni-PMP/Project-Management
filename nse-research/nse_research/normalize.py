"""OHLCV normalisation: turn provider rows into one clean, checked frame.

Rules:
- Bad records are flagged, never repaired with guessed values.
- Freshness is judged against the exchange calendar, not the wall clock alone.
"""

from __future__ import annotations

import datetime as dt
from dataclasses import dataclass, field

import numpy as np
import pandas as pd

COLUMNS = ["open", "high", "low", "close", "raw_close", "volume"]

# A daily close-to-close move larger than this is flagged for a corporate-action check.
ABNORMAL_MOVE = 0.20

# EOD bars are assumed to be published by this time (IST) on the session day.
EOD_READY_IST = dt.time(18, 0)
IST = dt.timezone(dt.timedelta(hours=5, minutes=30))


@dataclass
class QualityIssue:
    date: str
    field: str
    problem: str

    def as_dict(self) -> dict:
        return {"date": self.date, "field": self.field, "problem": self.problem}


@dataclass
class QualityReport:
    symbol: str
    bars: int = 0
    first_date: str | None = None
    last_date: str | None = None
    issues: list[QualityIssue] = field(default_factory=list)

    def add(self, date, field_name: str, problem: str) -> None:
        self.issues.append(QualityIssue(str(pd.Timestamp(date).date()), field_name, problem))

    def as_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "bars": self.bars,
            "first_date": self.first_date,
            "last_date": self.last_date,
            "issues": [i.as_dict() for i in self.issues],
        }


def normalize_bars(rows: list[dict], symbol: str) -> tuple[pd.DataFrame, QualityReport]:
    """Build a date-indexed OHLCV frame from provider rows and report problems.

    Rows that cannot be used (missing or non-positive prices, inconsistent
    high/low) are dropped and listed in the report; nothing is filled in.
    """
    report = QualityReport(symbol=symbol)
    if not rows:
        return pd.DataFrame(columns=COLUMNS, index=pd.DatetimeIndex([], name="date")), report

    df = pd.DataFrame(rows)
    if "date" not in df.columns:
        raise ValueError("price rows have no 'date' field")
    for col in COLUMNS:
        if col not in df.columns:
            df[col] = np.nan
    df["date"] = pd.to_datetime(df["date"])
    df = df[["date", *COLUMNS]]
    for col in COLUMNS:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    dupes = df["date"].duplicated(keep="last")
    for d in df.loc[dupes, "date"]:
        report.add(d, "date", "duplicate bar; later row kept")
    df = df[~dupes].sort_values("date").set_index("date")

    bad = pd.Series(False, index=df.index)
    for col in ["open", "high", "low", "close"]:
        missing = df[col].isna() | (df[col] <= 0)
        for d in df.index[missing]:
            report.add(d, col, "missing or non-positive price; bar dropped")
        bad |= missing

    ok = ~bad
    hi_bad = ok & (df["high"] < df[["open", "close"]].max(axis=1) - 1e-9)
    lo_bad = ok & (df["low"] > df[["open", "close"]].min(axis=1) + 1e-9)
    for d in df.index[hi_bad]:
        report.add(d, "high", "high is below open or close; bar dropped")
    for d in df.index[lo_bad]:
        report.add(d, "low", "low is above open or close; bar dropped")
    bad |= hi_bad | lo_bad

    vol_bad = df["volume"].isna() | (df["volume"] < 0)
    for d in df.index[vol_bad & ~bad]:
        report.add(d, "volume", "missing or negative volume; kept, volume treated as unknown")
    df.loc[vol_bad, "volume"] = np.nan

    df = df[~bad]

    move = df["close"].pct_change().abs()
    for d in df.index[move > ABNORMAL_MOVE]:
        report.add(d, "close", f"close moved more than {ABNORMAL_MOVE:.0%} in one session; check for a corporate action")

    report.bars = len(df)
    if len(df):
        report.first_date = str(df.index[0].date())
        report.last_date = str(df.index[-1].date())
    return df, report


def resample(df: pd.DataFrame, rule: str) -> pd.DataFrame:
    """Weekly ('W') or monthly ('M') bars built from daily bars.

    Each bar is labelled with its last actual trading date, so no future date
    ever appears in the index.
    """
    if df.empty:
        return df.copy()
    freq = {"W": "W-FRI", "M": "ME"}[rule]
    g = df.groupby(pd.Grouper(freq=freq))
    out = pd.DataFrame(
        {
            "open": g["open"].first(),
            "high": g["high"].max(),
            "low": g["low"].min(),
            "close": g["close"].last(),
            "raw_close": g["raw_close"].last(),
            "volume": g["volume"].sum(min_count=1),
        }
    )
    last_dates = g.apply(lambda x: x.index.max() if len(x) else pd.NaT)
    out.index = pd.DatetimeIndex(last_dates.values, name="date")
    return out.dropna(subset=["close"])


@dataclass
class Freshness:
    status: str  # CURRENT | ONE_SESSION_BEHIND | STALE | NO_DATA
    last_bar: str | None
    expected_session: str | None
    sessions_behind: int | None
    calendar_basis: str
    usable_for_signals: bool

    def as_dict(self) -> dict:
        return self.__dict__.copy()


class _Calendar:
    """Exchange sessions where the provider's calendar covers the date,
    weekdays minus known holidays elsewhere."""

    def __init__(self, sessions: set[dt.date] | None, holidays: set[dt.date], calendar_end: dt.date | None):
        self.sessions = sessions
        self.holidays = holidays
        self.end = calendar_end if sessions else None

    def covers(self, day: dt.date) -> bool:
        return self.end is not None and day <= self.end

    def is_session(self, day: dt.date) -> bool:
        if self.covers(day):
            return day in self.sessions
        return day.weekday() < 5 and day not in self.holidays


def expected_last_session(now_ist: dt.datetime, cal: _Calendar) -> tuple[dt.date, str]:
    """The most recent session whose EOD bar should already be published."""
    day = now_ist.date()
    if now_ist.time() < EOD_READY_IST:
        day -= dt.timedelta(days=1)
    for _ in range(30):
        if cal.is_session(day):
            basis = "exchange calendar" if cal.covers(day) else "weekdays minus known holidays (calendar not fetched for this date)"
            return day, basis
        day -= dt.timedelta(days=1)
    raise ValueError("no trading session found in the last 30 days")


def freshness(
    last_bar: dt.date | None,
    now_ist: dt.datetime,
    sessions: set[dt.date] | None = None,
    holidays: set[dt.date] | None = None,
    calendar_end: dt.date | None = None,
) -> Freshness:
    """Compare the last stored bar with the session that should be available.

    `sessions` is the set of known trading days from the provider's calendar,
    valid up to `calendar_end` (default: its latest date). Outside it, weekdays
    minus `holidays` are used and the basis says so.
    """
    if sessions and calendar_end is None:
        calendar_end = max(sessions)
    cal = _Calendar(sessions, holidays or set(), calendar_end)
    expected, basis = expected_last_session(now_ist, cal)
    if last_bar is None:
        return Freshness("NO_DATA", None, str(expected), None, basis, False)
    behind = 0
    day = last_bar + dt.timedelta(days=1)
    while day <= expected:
        behind += int(cal.is_session(day))
        day += dt.timedelta(days=1)
    status = "CURRENT" if behind == 0 else "ONE_SESSION_BEHIND" if behind == 1 else "STALE"
    return Freshness(status, str(last_bar), str(expected), behind, basis, behind <= 1)


def now_ist() -> dt.datetime:
    return dt.datetime.now(IST)
