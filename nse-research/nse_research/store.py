"""Local SQLite store for bars, the trading calendar and the fetch log.

Every bar keeps its source and fetch time. When a provider sends a different
value for a bar we already hold, the change is logged as a revision rather
than silently overwritten without trace.
"""

from __future__ import annotations

import datetime as dt
import sqlite3
from pathlib import Path

import pandas as pd

SCHEMA = """
CREATE TABLE IF NOT EXISTS bars (
    symbol TEXT NOT NULL,
    date TEXT NOT NULL,
    open REAL, high REAL, low REAL, close REAL, raw_close REAL, volume REAL,
    source TEXT NOT NULL,
    fetched_at TEXT NOT NULL,
    PRIMARY KEY (symbol, date)
);
CREATE TABLE IF NOT EXISTS revisions (
    symbol TEXT, date TEXT, field TEXT, old REAL, new REAL, source TEXT, seen_at TEXT
);
CREATE TABLE IF NOT EXISTS calendar (
    date TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    source TEXT NOT NULL,
    fetched_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS fetch_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at TEXT NOT NULL,
    symbol TEXT,
    route TEXT,
    ok INTEGER NOT NULL,
    rows INTEGER,
    message TEXT
);
CREATE TABLE IF NOT EXISTS quality_issues (
    symbol TEXT, date TEXT, field TEXT, problem TEXT, seen_at TEXT
);
"""

PRICE_FIELDS = ("open", "high", "low", "close", "raw_close", "volume")


class Store:
    def __init__(self, path: str | Path):
        self.path = str(path)
        if self.path != ":memory:":
            Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(self.path, check_same_thread=False)
        self.db.executescript(SCHEMA)

    def last_bar_date(self, symbol: str) -> dt.date | None:
        row = self.db.execute("SELECT MAX(date) FROM bars WHERE symbol = ?", (symbol,)).fetchone()
        return dt.date.fromisoformat(row[0]) if row and row[0] else None

    def upsert_bars(self, symbol: str, df: pd.DataFrame, source: str, fetched_at: str) -> int:
        existing = {
            r[0]: r[1:]
            for r in self.db.execute(
                f"SELECT date, {', '.join(PRICE_FIELDS)} FROM bars WHERE symbol = ?", (symbol,)
            )
        }
        rows, revisions = [], []
        for date, r in df.iterrows():
            d = str(date.date())
            vals = tuple(None if pd.isna(r[f]) else float(r[f]) for f in PRICE_FIELDS)
            old = existing.get(d)
            if old is not None:
                for f, a, b in zip(PRICE_FIELDS, old, vals):
                    if a is not None and b is not None and abs(a - b) > 1e-6:
                        revisions.append((symbol, d, f, a, b, source, fetched_at))
            rows.append((symbol, d, *vals, source, fetched_at))
        with self.db:
            self.db.executemany(
                "INSERT OR REPLACE INTO bars VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", rows
            )
            self.db.executemany("INSERT INTO revisions VALUES (?, ?, ?, ?, ?, ?, ?)", revisions)
        return len(rows)

    def bars(self, symbol: str) -> pd.DataFrame:
        df = pd.read_sql_query(
            "SELECT date, open, high, low, close, raw_close, volume, source, fetched_at "
            "FROM bars WHERE symbol = ? ORDER BY date",
            self.db,
            params=(symbol,),
            parse_dates=["date"],
        )
        return df.set_index("date")

    def symbols(self) -> list[str]:
        return [r[0] for r in self.db.execute("SELECT DISTINCT symbol FROM bars ORDER BY symbol")]

    def save_calendar(self, days: list[dict], source: str, fetched_at: str) -> None:
        with self.db:
            self.db.executemany(
                "INSERT OR REPLACE INTO calendar VALUES (?, ?, ?, ?)",
                [(d["date"], d["status"], source, fetched_at) for d in days],
            )

    def calendar(self) -> tuple[set[dt.date] | None, dt.date | None]:
        """Known trading days and the last date the calendar covers."""
        rows = self.db.execute("SELECT date, status FROM calendar").fetchall()
        if not rows:
            return None, None
        # "traded" and "no_print" are both exchange sessions; the rest are not.
        sessions = {dt.date.fromisoformat(d) for d, s in rows if s in ("traded", "no_print")}
        return sessions, max(dt.date.fromisoformat(d) for d, _ in rows)

    def log_fetch(self, symbol: str | None, route: str, ok: bool, rows: int | None, message: str) -> None:
        with self.db:
            self.db.execute(
                "INSERT INTO fetch_log (at, symbol, route, ok, rows, message) VALUES (?, ?, ?, ?, ?, ?)",
                (dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"), symbol, route, int(ok), rows, message),
            )

    def recent_fetches(self, limit: int = 50) -> list[dict]:
        cur = self.db.execute(
            "SELECT at, symbol, route, ok, rows, message FROM fetch_log ORDER BY id DESC LIMIT ?", (limit,)
        )
        cols = [c[0] for c in cur.description]
        return [dict(zip(cols, r)) for r in cur.fetchall()]

    def save_issues(self, symbol: str, issues: list[dict], seen_at: str) -> None:
        with self.db:
            self.db.executemany(
                "INSERT INTO quality_issues VALUES (?, ?, ?, ?, ?)",
                [(symbol, i["date"], i["field"], i["problem"], seen_at) for i in issues],
            )

    def revisions(self, symbol: str) -> list[dict]:
        cur = self.db.execute(
            "SELECT date, field, old, new, source, seen_at FROM revisions WHERE symbol = ? ORDER BY seen_at DESC LIMIT 50",
            (symbol,),
        )
        cols = [c[0] for c in cur.description]
        return [dict(zip(cols, r)) for r in cur.fetchall()]
