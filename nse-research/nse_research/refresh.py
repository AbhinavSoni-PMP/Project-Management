"""Manual refresh: runs only when the user presses Refresh.

Fetches only what is missing (plus a short overlap to catch provider
revisions), normalises it and stores it. A failed symbol is reported as
DATA SOURCE UNAVAILABLE and keeps its previous data untouched.
"""

from __future__ import annotations

import datetime as dt
from dataclasses import dataclass, field

from . import labels
from .normalize import normalize_bars, now_ist
from .store import Store
from .tapetide import TapetideClient, TapetideError

OVERLAP_DAYS = 10


@dataclass
class RefreshResult:
    started_at: str
    finished_at: str | None = None
    calendar: str = "not refreshed"
    symbols: list[dict] = field(default_factory=list)
    requests: int = 0

    def as_dict(self) -> dict:
        return self.__dict__.copy()


def refresh(store: Store, client: TapetideClient, symbols: list[str], history_days: int, today: dt.date | None = None) -> RefreshResult:
    today = today or now_ist().date()
    stamp = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    result = RefreshResult(started_at=stamp)

    if symbols:
        ref = symbols[0]
        route = f"observation-status ({ref})"
        try:
            days = client.observation_status(ref, days=30)
            result.requests += 1
            store.save_calendar(days, labels.SOURCE_TAPETIDE, stamp)
            store.log_fetch(ref, route, True, len(days), "trading calendar")
            result.calendar = f"updated from {ref}, {len(days)} days"
        except TapetideError as e:
            result.requests += 1
            store.log_fetch(ref, route, False, None, str(e))
            result.calendar = f"{labels.SOURCE_UNAVAILABLE}: {e}"

    for sym in symbols:
        last = store.last_bar_date(sym)
        days = history_days if last is None else max(OVERLAP_DAYS, (today - last).days + OVERLAP_DAYS)
        route = f"price ({days} days)"
        try:
            rows, meta = client.price_history(sym, days)
            result.requests += max(1, -(-days // 2000))
        except TapetideError as e:
            result.requests += 1
            store.log_fetch(sym, route, False, None, str(e))
            result.symbols.append({"symbol": sym, "ok": False, "message": f"{labels.SOURCE_UNAVAILABLE}: {e}"})
            continue
        df, report = normalize_bars(rows, sym)
        n = store.upsert_bars(sym, df, labels.SOURCE_TAPETIDE, stamp)
        store.save_issues(sym, [i.as_dict() for i in report.issues], stamp)
        msg = f"{n} bars stored, last {report.last_date}" if n else "no new bars returned"
        if report.issues:
            msg += f"; {len(report.issues)} data-quality issue(s)"
        store.log_fetch(sym, route, True, n, msg)
        result.symbols.append({"symbol": sym, "ok": True, "message": msg, "last_bar": report.last_date})

    result.finished_at = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    return result
