import datetime as dt
import io
import json
import urllib.error

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from nse_research.app import create_app
from nse_research.config import Settings
from nse_research.refresh import refresh
from nse_research.store import Store
from nse_research.tapetide import TapetideClient, TapetideError


class FakeClient:
    """Stands in for Tapetide; serves synthetic bars and records requests."""

    def __init__(self, bars: dict[str, list[dict]], fail: set[str] = frozenset()):
        self.bars = bars
        self.fail = fail
        self.calls = []

    def observation_status(self, symbol, days=30):
        self.calls.append(("calendar", symbol, days))
        return [{"date": r["date"], "status": "traded"} for r in self.bars[symbol][-days:]]

    def price_history(self, symbol, days, end_date=None):
        self.calls.append(("price", symbol, days))
        if symbol in self.fail:
            raise TapetideError(503, f"/v1/stocks/{symbol}/price", "unavailable")
        return self.bars[symbol], {}


def synth_rows(n=300, start="2025-08-01", drift=0.1):
    idx = pd.bdate_range(start, periods=n)
    out, c = [], 100.0
    for i, d in enumerate(idx):
        o = c
        c = c + drift + (1 if i % 7 == 0 else -0.5 if i % 3 == 0 else 0.2)
        out.append({"date": str(d.date()), "open": o, "high": max(o, c) + 0.5, "low": min(o, c) - 0.5,
                    "close": c, "raw_close": c, "volume": 1e6 + 1000 * i})
    return out


def test_first_refresh_loads_history_then_only_the_gap():
    rows = synth_rows()
    client = FakeClient({"AAA": rows})
    store = Store(":memory:")
    last = dt.date.fromisoformat(rows[-1]["date"])
    r = refresh(store, client, ["AAA"], history_days=2000, today=last)
    assert r.symbols[0]["ok"] and store.last_bar_date("AAA") == last
    assert ("price", "AAA", 2000) in client.calls
    refresh(store, client, ["AAA"], history_days=2000, today=last + dt.timedelta(days=3))
    assert client.calls[-1] == ("price", "AAA", 13)  # 3-day gap + 10-day overlap


def test_provider_revision_is_logged_not_silently_overwritten():
    rows = synth_rows(30)
    store = Store(":memory:")
    refresh(store, FakeClient({"AAA": rows}), ["AAA"], 2000)
    changed = [dict(r) for r in rows]
    changed[-1]["close"] += 0.2  # stays inside the high-low range
    refresh(store, FakeClient({"AAA": changed}), ["AAA"], 2000)
    revs = store.revisions("AAA")
    assert revs and revs[0]["field"] == "close" and revs[0]["date"] == rows[-1]["date"]


def test_failed_symbol_reports_unavailable_and_keeps_old_data():
    rows = synth_rows(30)
    store = Store(":memory:")
    refresh(store, FakeClient({"AAA": rows}), ["AAA"], 2000)
    before = len(store.bars("AAA"))
    r = refresh(store, FakeClient({"AAA": rows}, fail={"AAA"}), ["AAA"], 2000)
    assert not r.symbols[0]["ok"] and r.symbols[0]["message"].startswith("DATA SOURCE UNAVAILABLE")
    assert len(store.bars("AAA")) == before


def make_app(tmp_path, client=None, token="t"):
    s = Settings(symbols=["AAA", "BBB"], history_days=2000, db_path=tmp_path / "m.db", token=token)
    return TestClient(create_app(s, client))


def test_api_shows_nothing_until_refresh_is_pressed(tmp_path):
    client = FakeClient({"AAA": synth_rows(), "BBB": synth_rows(drift=-0.05)})
    api = make_app(tmp_path, client)
    stocks = api.get("/api/stocks").json()["stocks"]
    assert all(s["status"] == "DATA NOT AVAILABLE" for s in stocks)
    assert client.calls == []  # reading never fetches

    r = api.post("/api/refresh").json()
    assert [s["ok"] for s in r["symbols"]] == [True, True]
    stocks = api.get("/api/stocks").json()["stocks"]
    assert {s["symbol"] for s in stocks} == {"AAA", "BBB"}
    d = api.get("/api/stocks/aaa").json()
    assert d["header"]["source"] == "Tapetide (secondary source)"
    assert d["indicators"]["label"] == "CALCULATED FROM OHLCV DATA"
    assert d["timeframes"]["4H / 1H / intraday"] == "NOT AVAILABLE WITH CURRENT DATA SOURCE"
    assert len(d["chart"]["dates"]) == 260


def test_refresh_without_token_explains_what_to_do(tmp_path):
    api = make_app(tmp_path, client=None, token=None)
    r = api.post("/api/refresh")
    assert r.status_code == 400 and "TAPETIDE_TOKEN" in r.json()["detail"]
    assert api.get("/api/status").json()["token_configured"] is False


def test_rest_client_pages_back_and_sends_bearer_token():
    pages = [
        {"data": [{"date": "2026-01-02"}], "meta": {"window": {"has_more": True, "next_cursor": "2026-01-01"}}},
        {"data": [{"date": "2025-12-31"}], "meta": {"window": {"has_more": False}}},
    ]
    seen = []

    def opener(req, timeout):
        seen.append((req.full_url, req.get_header("Authorization")))
        return io.BytesIO(json.dumps(pages[len(seen) - 1]).encode())

    c = TapetideClient("tok", opener=opener)
    rows, _ = c.price_history("M&M", 4000)
    assert [r["date"] for r in rows] == ["2025-12-31", "2026-01-02"]
    assert seen[0][0].startswith("https://api.tapetide.com/v1/stocks/M%26M/price?days=2000")
    assert "end_date=2026-01-01" in seen[1][0]
    assert seen[0][1] == "Bearer tok"


def test_rest_client_raises_on_http_error():
    def opener(req, timeout):
        raise urllib.error.HTTPError(req.full_url, 401, "Unauthorized", {}, io.BytesIO(b'{"error":"bad token"}'))

    with pytest.raises(TapetideError) as e:
        TapetideClient("tok", opener=opener).price_history("TCS", 10)
    assert e.value.status == 401
