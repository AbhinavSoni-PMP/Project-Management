import datetime as dt

from nse_research.normalize import IST, freshness, normalize_bars, resample
from synth import path


def row(d, o=100, h=101, l=99, c=100.5, v=1000):
    return {"date": d, "open": o, "high": h, "low": l, "close": c, "raw_close": c, "volume": v}


def test_bad_rows_are_dropped_and_reported_never_repaired():
    rows = [
        row("2026-10-19"),
        row("2026-10-21", h=99.5),  # high below close
        row("2026-10-22", c=None),  # missing close
        row("2026-10-23"),
        row("2026-10-23", c=100.7),  # duplicate date, later row wins
    ]
    df, rep = normalize_bars(rows, "TEST")
    assert [str(d.date()) for d in df.index] == ["2026-10-19", "2026-10-23"]
    assert df.loc["2026-10-23", "close"] == 100.7
    problems = {(i.date, i.field) for i in rep.issues}
    assert ("2026-10-21", "high") in problems
    assert ("2026-10-22", "close") in problems
    assert ("2026-10-23", "date") in problems


def test_abnormal_move_is_flagged_for_corporate_action_check():
    df, rep = normalize_bars([row("2026-10-22"), row("2026-10-23", o=50, h=51, l=49, c=50)], "TEST")
    assert len(df) == 2
    assert any("corporate action" in i.problem for i in rep.issues)


def test_weekly_bars_are_labelled_with_last_trading_day():
    df = path([(0, 100), (9, 110)])  # 2024-01-01 (Mon) .. 2024-01-12 (Fri)
    df = df.drop(df.index[4])  # drop Friday 5 Jan, as if a holiday
    w = resample(df, "W")
    assert [str(d.date()) for d in w.index] == ["2024-01-04", "2024-01-12"]
    first_week = df.loc[:"2024-01-04"]
    assert w["high"].iloc[0] == first_week["high"].max()
    assert w["open"].iloc[0] == first_week["open"].iloc[0]
    assert w["volume"].iloc[0] == first_week["volume"].sum()


def at(y, m, d, hh=20):
    return dt.datetime(y, m, d, hh, tzinfo=IST)


def test_friday_bar_is_current_on_sunday():
    f = freshness(dt.date(2026, 10, 23), at(2026, 10, 25))
    assert f.status == "CURRENT" and f.usable_for_signals


def test_before_eod_time_the_previous_session_is_expected():
    f = freshness(dt.date(2026, 10, 22), at(2026, 10, 23, hh=11))
    assert f.status == "CURRENT"


def test_holiday_from_calendar_is_not_counted_as_missing():
    sessions = {dt.date(2026, 10, 16), dt.date(2026, 10, 19), dt.date(2026, 10, 21)}  # 20th holiday
    f = freshness(dt.date(2026, 10, 19), at(2026, 10, 20), sessions)
    assert f.status == "CURRENT" and f.calendar_basis == "exchange calendar"


def test_stale_data_blocks_signals():
    f = freshness(dt.date(2026, 10, 16), at(2026, 10, 23))
    assert f.status == "STALE" and not f.usable_for_signals and f.sessions_behind == 5


def test_no_data():
    assert freshness(None, at(2026, 10, 23)).status == "NO_DATA"
