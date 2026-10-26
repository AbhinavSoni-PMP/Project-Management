"""Trading desk tools. Synthetic prices and fake HTTP only: no network."""

import io
import json
import zipfile

import numpy as np
import pandas as pd
import pytest

from nse_research.desk import (alerts, budget, congress, data, earnings, entry, exits, news, orders, risk, scanner,
                               setups, state, strategies, timemachine, tradingview)
from nse_research.indicators import compute_all
from synth import path


class FakeResp(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def opener_for(routes: dict):
    calls = []

    def op(req, timeout=None):
        url = req.full_url
        calls.append(req)
        for k, v in routes.items():
            if k in url:
                return FakeResp(v if isinstance(v, bytes) else v.encode())
        raise AssertionError(f"unexpected url {url}")

    op.calls = calls
    return op


def walk(n=1200, mu=0.0006, sigma=0.015, seed=3):
    rng = np.random.default_rng(seed)
    c = 100 * np.exp(np.cumsum(rng.normal(mu, sigma, n)))
    o = c * np.exp(rng.normal(0, 0.004, n))
    h = np.maximum(o, c) * (1 + abs(rng.normal(0, 0.006, n)))
    l = np.minimum(o, c) * (1 - abs(rng.normal(0, 0.006, n)))
    v = rng.integers(100_000, 1_000_000, n).astype(float)
    return pd.DataFrame({"open": o, "high": h, "low": l, "close": c, "raw_close": c, "volume": v},
                        index=pd.bdate_range("2020-01-01", periods=n, name="date"))


def uptrend_breakout():
    anchors = [(0, 100), (230, 150), (240, 140), (250, 150), (260, 140), (270, 150), (280, 141), (290, 148)]
    df = path(anchors, spread=0.6)
    last = df.index[-1]
    df.loc[last, ["open", "high", "low", "close", "raw_close"]] = [148.2, 151.8, 148, 151.5, 151.5]
    df.loc[last, "volume"] = 3e6
    return df


@pytest.fixture(autouse=True)
def desk_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(state, "DESK_DIR", tmp_path)
    return tmp_path


# data ---------------------------------------------------------------------

def test_parse_yahoo_scales_ohlc_to_adjusted_close():
    payload = {"chart": {"result": [{
        "meta": {"exchangeTimezoneName": "America/New_York"},
        "timestamp": [1704205800, 1704292200, 1704378600],
        "indicators": {"quote": [{"open": [10, 11, None], "high": [11, 12, 13], "low": [9, 10, 11], "close": [10, 12, 12], "volume": [5, 6, 7]}],
                       "adjclose": [{"adjclose": [5, 6, 6]}]},
    }]}}
    df = data.parse_yahoo(payload)
    assert len(df) == 2  # the bar with a missing open is dropped, not filled
    assert df["close"].tolist() == [5, 6] and df["raw_close"].tolist() == [10, 12]
    assert df["high"].iloc[0] == 5.5


def test_parse_csv_reads_tradingview_export_with_unix_time():
    text = "time,open,high,low,close,Volume\n1704153600,1,2,0.5,1.5,100\n1704240000,1.5,2.5,1,2,200\n"
    df = data.parse_csv(text, "tv")
    assert str(df.index[0].date()) == "2024-01-02" and df["volume"].tolist() == [100, 200]


def test_load_auto_falls_back_and_reports_every_failure(monkeypatch):
    monkeypatch.setattr(data, "load_store", lambda *a, **k: (_ for _ in ()).throw(data.DataError("store: none")))
    op = opener_for({"yahoo": json.dumps({"chart": {"result": [], "error": {"description": "Not Found"}}}),
                     "stooq": "No data"})
    with pytest.raises(data.DataError) as e:
        data.load("ZZZZ", opener=op)
    assert "store: none" in str(e.value) and "Not Found" in str(e.value) and "stooq" in str(e.value)


# setups and entry ----------------------------------------------------------

def test_ascending_triangle_is_found():
    anchors = [(0, 80), (100, 100), (115, 90), (130, 100), (145, 93), (160, 100), (175, 96), (185, 99)]
    df = path(anchors, spread=0.3)
    names = [p.name for p in setups.triangles_and_wedges(df, compute_all(df))]
    assert "Ascending Triangle" in names


def test_nr7_and_gap_setups():
    df = walk(120)
    i = df.index
    df.loc[i[-1], ["open", "high", "low", "close"]] = [df["close"].iloc[-2]] * 2 + [df["close"].iloc[-2] - 0.01] * 2
    names = [s.name for s in setups.short_term(df, compute_all(df))]
    assert "NR7" in names
    g = walk(120)
    k = g.index[-5]
    g.loc[g.index[-5]:, ["open", "high", "low", "close"]] *= 1.10
    gaps = [s for s in setups.short_term(g, compute_all(g)) if s.name == "Gap Up"]
    assert any(gp.date == str(k.date()) and gp.extra["gap_type"] == "breakaway" for gp in gaps)


def test_entry_rules_met_on_uptrend_breakout():
    res = entry.check(uptrend_breakout(), "SYN")
    assert res["verdict"] == entry.RULES_MET, res
    assert "breakout20" in res["triggers"]


def test_entry_avoid_in_downtrend():
    df = path([(0, 200), (300, 100)], spread=0.5)
    assert entry.check(df, "SYN")["verdict"] == entry.AVOID


def test_entry_needs_history():
    assert entry.check(walk(100))["verdict"] == "NOT ENOUGH DATA"


# exits ---------------------------------------------------------------------

def _rules(**k):
    return exits.ExitRules(**{"stop_atr": 1, "target_r": 2, "trail_atr": None, "max_bars": 5, "cost_bps": 0, **k})


def test_walk_stop_target_gap_and_time():
    r = _rules()  # entry 100, stop 99, target 102, time stop after 5 bars
    paths = [  # (open, high, low, close) per bar
        [(100, 101, 99.5, 100), (100, 103, 99.5, 101)],  # target on bar 1
        [(100, 101, 99.5, 100), (95, 96, 94, 95)],  # opens below the stop: fills at the open
        [(100, 101, 99.5, 100)] * 5,  # nothing hit: time stop at the close of bar 5
        [(100, 103, 98, 101)],  # stop and target in one bar: counted as the stop
    ]
    n = max(len(p) for p in paths)
    full = [p + [p[-1]] * (n - len(p)) for p in paths]
    o, h, l, c = (np.array([[b[k] for b in p] for p in full]) for k in range(4))
    px, bar, why = exits.walk_many(o, h, l, c, 100, 99, 1, r)
    assert why.tolist() == [2, 1, 4, 1]
    assert px.tolist() == [102, 95, 100, 99]
    assert bar.tolist() == [1, 1, 4, 0]


def test_trailing_stop_only_rises():
    r = _rules(target_r=None, trail_atr=1, max_bars=10)
    h = np.array([[101, 104, 106, 105, 104]])
    l = np.array([[99.5, 102, 104, 104.5, 103]])
    o = np.array([[100, 102, 104, 105, 104]])
    c = np.array([[100, 103, 105, 105, 103.5]])
    px, bar, why = exits.walk_many(o, h, l, c, 100, 99, 1, r)
    assert why[0] == 3 and px[0] == 105 and bar[0] == 3  # stop raised to 106 - 1 ATR, hit on bar 3


def test_exit_plan_levels():
    df = walk(300)
    plan = exits.plan(df, entry=float(df["close"].iloc[-1]))
    assert plan["initial_stop"] < plan["entry"] < plan["target"]
    assert all(v is None or v < plan["entry"] for v in plan["stop_alternatives"].values())
    with pytest.raises(ValueError):
        exits.plan(df, entry=100, stop=101)


# time machine --------------------------------------------------------------

def test_replay_has_no_lookahead():
    df = walk(1200)
    full = timemachine.replay(df)["trades"]
    cut = timemachine.replay(df.iloc[:900])["trades"]
    done = [t for t in full if t["exit_date"] <= str(df.index[898].date())]
    assert done and [t for t in cut if not t["open"]][: len(done)] == done


def test_monte_carlo_is_reproducible_and_drift_removal_works():
    df = walk(1200, mu=0.002)
    a = timemachine.path_monte_carlo(df, paths=2000, drift=True)
    b = timemachine.path_monte_carlo(df, paths=2000, drift=True)
    flat = timemachine.path_monte_carlo(df, paths=2000, drift=False)
    assert a["prob_profit_pct"] == b["prob_profit_pct"]
    assert a["prob_profit_pct"] > flat["prob_profit_pct"]
    total = sum(a[k] for k in ("prob_target_pct", "prob_stop_pct", "prob_trailing_pct", "prob_time_exit_pct"))
    assert abs(total - 100) < 0.5
    o, h, l, c = timemachine.simulate_paths(df, 30, 500)
    assert (h >= np.maximum(o, c) - 1e-9).all() and (l <= np.minimum(o, c) + 1e-9).all()


def test_full_run_reports_verdict_and_honest_note():
    res = timemachine.run(walk(1200), "SYN", paths=1000)
    assert res["trade_monte_carlo"].get("paths", 1000) == 1000
    assert res["verdict"]["label"] in {"HISTORICAL EDGE", "WEAK EDGE", "NO EDGE", "NOT ENOUGH TRADES", "NO EVIDENCE"}
    assert "cannot guarantee profit" in res["verdict"]["notes"][-1]
    from nse_research.desk import report
    html = report.render(walk(1200), res)
    assert "<script>" in html and "SYN time machine" in html


def test_trade_monte_carlo_all_winners():
    mc = timemachine.trade_monte_carlo([1.0, 2.0], trades_per_year=10, paths=500)
    assert mc["prob_profit_pct"] == 100.0 and mc["p95_max_drawdown_pct"] == 0.0


# risk, budget, orders --------------------------------------------------------

def test_position_size_risks_one_percent():
    s = risk.position_size(100_000, 50, 48)
    assert s["shares"] == 400 and s["risk_if_stopped"] == 800
    capped = risk.position_size(100_000, 50, 49.9)
    assert capped["limited_by"] == "max position size" and capped["shares"] == 400


def test_check_trade_blocks_missing_stop_and_poor_reward():
    c = risk.check_trade(100_000, {}, "X", 100, 50, None)
    assert not c["approved"] and any("No stop" in b for b in c["blocks"])
    c = risk.check_trade(100_000, {}, "X", 100, 50, 48, target=51)
    assert not c["approved"] and any("Reward to risk" in b for b in c["blocks"])


def test_paper_flow_with_bracket_exit(desk_dir):
    b = budget.Budget()
    b.init(10_000, "USD", reserve_pct=10)
    o = b.place("abc", "buy", 40, market_price=50, stop=48, target=54)
    assert o["status"] == "filled" and b.broker.s["positions"]["ABC"]["qty"] == 40
    fills = b.broker.update({"ABC": {"open": 50, "high": 55, "low": 49.5, "close": 54.5}})
    assert fills and fills[0]["reason"] == "target" and "ABC" not in b.broker.s["positions"]
    assert b.broker.s["realized_pnl"] > 0
    st = b.status()
    assert st["equity"] > 10_000 and st["free_to_trade"] < st["cash"]


def test_paper_rejects_trades_over_limits_and_selling_unheld():
    b = budget.Budget()
    b.init(10_000)
    o = b.place("abc", "buy", 100, market_price=50, stop=40, target=80)
    assert o["status"] == "rejected" and o["risk_check"]["blocks"]
    with pytest.raises(orders.OrderError):
        b.place("abc", "sell", 1, market_price=50)


def test_monthly_loss_limit_pauses_buys():
    b = budget.Budget()
    b.init(10_000, monthly_loss_limit_pct=1)
    b.place("abc", "buy", 20, market_price=50, stop=45, target=70)
    b.broker.update({"ABC": {"open": 44, "high": 44, "low": 40, "close": 41}})
    assert b.status()["trading_paused"]
    assert b.place("abc", "buy", 1, market_price=41, stop=39, target=46)["status"] == "rejected"


def test_resting_limit_order_fills_when_reached():
    br = orders.PaperBroker(slippage_bps=0, fee_bps=0)
    br.deposit(10_000)
    o = br.place("abc", "buy", 10, "limit", price=45, stop=43, target=52)
    assert o["status"] == "open"
    br.update({"ABC": {"open": 47, "high": 47, "low": 44, "close": 46}})
    assert br.s["positions"]["ABC"]["avg_price"] == 45


def test_live_orders_need_env_and_exact_phrase():
    with pytest.raises(orders.OrderError):
        orders.require_live_confirmation("buy", 1, "AAPL", "LIVE BUY 1 AAPL", env={})
    with pytest.raises(orders.OrderError):
        orders.require_live_confirmation("buy", 1, "AAPL", "yes", env={"DESK_ALLOW_LIVE": "1"})
    orders.require_live_confirmation("buy", 1, "aapl", "LIVE BUY 1 AAPL", env={"DESK_ALLOW_LIVE": "1"})


def test_alpaca_defaults_to_paper_and_sends_bracket():
    op = opener_for({"paper-api.alpaca.markets/v2/orders": json.dumps({"id": "x", "status": "accepted"})})
    br = orders.AlpacaBroker("k", "s", opener=op)
    r = br.place("aapl", "buy", 2, stop=90, target=120)
    body = json.loads(op.calls[0].data)
    assert r["mode"] == "ALPACA PAPER" and body["order_class"] == "bracket" and body["stop_loss"]["stop_price"] == "90"


def test_alpaca_live_refuses_without_confirmation(monkeypatch):
    monkeypatch.setenv("DESK_ALLOW_LIVE", "1")
    br = orders.AlpacaBroker("k", "s", live=True, opener=opener_for({}))
    with pytest.raises(orders.OrderError):
        br.place("aapl", "buy", 2, typed_confirmation="y")


# alerts and TradingView -----------------------------------------------------

def test_alert_fires_once_and_notifies(monkeypatch):
    sent = []
    monkeypatch.setattr(alerts, "send", lambda text, **k: sent.append(text))
    al = alerts.Alerts()
    al.add("SYN", "above", 1.0)
    al.add("SYN", "below", 1.0)
    df = walk(300)
    fired = al.check(loader=lambda s: df)
    assert len(fired) == 1 and fired[0]["rule"] == "above" and len(sent) == 1
    assert al.check(loader=lambda s: df) == []


def test_send_uses_configured_channels():
    op = opener_for({"ntfy.sh/mytopic": b"", "api.telegram.org": b"{}"})
    used = alerts.send("hello", env={"DESK_NTFY_TOPIC": "mytopic", "TELEGRAM_BOT_TOKEN": "t", "TELEGRAM_CHAT_ID": "1"}, opener=op)
    assert used == ["ntfy", "telegram"]


def test_pine_script_matches_python_rules():
    text = tradingview.pine_script(exits.ExitRules(stop_atr=2.5, max_bars=30), secret="s3")
    assert "//@version=5" in text and "input.float(2.5" in text and "input.int(30" in text
    assert f"ta.highest(high, {strategies.BREAKOUT_BARS})[1]" in text and '"s3"' in text


def test_webhook_secret():
    assert tradingview.verify_webhook({"secret": "a"}, env={"DESK_WEBHOOK_SECRET": "a"})
    assert not tradingview.verify_webhook({"secret": "a"}, env={})


# news, earnings, congress -----------------------------------------------------

RSS = b"""<?xml version="1.0"?><rss><channel>
<item><title>Acme beats estimates, raises full-year guidance</title><link>http://x/1</link><pubDate>Mon, 26 Oct 2026 10:00:00 GMT</pubDate></item>
<item><title>Acme faces SEC probe over accounting</title><link>http://x/2</link><pubDate>Mon, 26 Oct 2026 09:00:00 GMT</pubDate></item>
</channel></rss>"""


def test_news_tags_and_dedupes():
    op = opener_for({"news.google.com": RSS, "feeds.finance.yahoo.com": RSS})
    res = news.fetch("ACME", opener=op, max_age_days=36500)
    assert len(res["headlines"]) == 2
    first = res["headlines"][0]
    assert "earnings" in first["tags"] and "guidance" in first["tags"] and first["tone"] == "positive"
    assert "legal" in res["headlines"][1]["tags"]
    first_run = news.monitor(["ACME"], opener=op)
    assert len(first_run["ACME"]["new"]) == 2 and len(first_run["ACME"]["flagged"]) == 2
    again = news.monitor(["ACME"], opener=op)
    assert again["ACME"]["new"] == []


def _fact(start, end, val, filed, form="10-Q"):
    return {"start": start, "end": end, "val": val, "filed": filed, "form": form}


def test_earnings_quarters_derive_q4_and_yoy():
    rev = [
        _fact("2024-01-01", "2024-03-31", 100, "2024-04-25"), _fact("2024-04-01", "2024-06-30", 110, "2024-07-25"),
        _fact("2024-07-01", "2024-09-30", 120, "2024-10-25"), _fact("2024-01-01", "2024-12-31", 460, "2025-02-01", "10-K"),
        _fact("2025-01-01", "2025-03-31", 125, "2025-04-25"),
    ]
    facts = {"entityName": "Acme", "facts": {"us-gaap": {"Revenues": {"units": {"USD": rev}}}}}
    qs = earnings.quarters(facts)
    q4 = next(q for q in qs if q["period_end"] == "2024-12-31")
    assert q4["revenue"] == 130 and q4["q4_derived_from_annual"]
    assert qs[-1]["revenue_yoy_pct"] == 25.0
    out = earnings.analyse("ACME", facts=facts, prices=walk(1500))
    assert out["next_report_estimate"] == "2025-07-25"
    assert "price_reaction" in out


HOUSE_XML = b"""<?xml version="1.0" encoding="utf-8"?><FinancialDisclosure>
<Member><Prefix>Hon.</Prefix><Last>Pelosi</Last><First>Nancy</First><Suffix /><FilingType>P</FilingType><StateDst>CA11</StateDst><Year>2026</Year><FilingDate>{d}</FilingDate><DocID>20012345</DocID></Member>
<Member><Prefix>Hon.</Prefix><Last>Doe</Last><First>Jane</First><Suffix /><FilingType>O</FilingType><StateDst>TX01</StateDst><Year>2026</Year><FilingDate>{d}</FilingDate><DocID>10099999</DocID></Member>
</FinancialDisclosure>"""

PTR_TEXT = """ID Owner Asset Transaction Type Date Notification Date Amount Cap. Gains > $200?
SP NVIDIA Corporation - Common Stock (NVDA) [ST] P 01/14/2026 01/14/2026 $1,000,001 -
$5,000,000
F S : New
SP Apple Inc. - Common Stock (AAPL) [ST] S (partial) 12/31/2025 01/10/2026 $5,000,001 - $25,000,000
"""


def test_congress_fetch_parse_and_summary():
    import datetime as dt

    d = dt.date.today().strftime("%m/%d/%Y")
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("2026FD.xml", HOUSE_XML.replace(b"{d}", d.encode()))
    op = opener_for({"financial-pdfs/2026FD.zip": buf.getvalue(), "ptr-pdfs/2026/20012345.pdf": b"%PDF"})
    res = congress.fetch(2026, days=30, opener=op, pdf_text=lambda raw: PTR_TEXT)
    assert res["filings_in_window"] == 1 and res["newly_parsed"] == 1
    trades = congress.all_trades()
    assert [(t["ticker"], t["type"], t["owner"]) for t in trades] == [("NVDA", "buy", "spouse"), ("AAPL", "sell (partial)", "spouse")]
    assert trades[0]["amount_mid"] == pytest.approx(3_000_000.5) and trades[1]["days_to_disclose"] == 10
    s = congress.summary(days=36500, member="pelosi")
    assert s["trades"] == 2 and {r["ticker"] for r in s["most_traded"]} == {"NVDA", "AAPL"}


def test_congress_csv_import(tmp_path):
    p = tmp_path / "senate.csv"
    p.write_text("member,ticker,type,transaction_date,disclosure_date,amount\nSen. A,MSFT,buy,2026-01-01,2026-01-20,$1,001 - $15,000\n")
    assert congress.import_csv(p) == 1
    assert congress.summary(days=36500, ticker="msft")["trades"] == 1


# scanner -------------------------------------------------------------------

def test_scanner_ranks_and_survives_bad_symbols():
    frames = {"UP": uptrend_breakout(), "DOWN": path([(0, 200), (300, 100)], spread=0.5)}

    def loader(s):
        if s not in frames:
            raise data.DataError("no data")
        return frames[s]

    res = scanner.scan(["DOWN", "UP", "BAD"], loader=loader, workers=2)
    assert res["results"][0]["symbol"] == "UP" and res["results"][0]["verdict"] == entry.RULES_MET
    assert res["errors"][0]["symbol"] == "BAD"


def test_universe_from_file(tmp_path):
    f = tmp_path / "u.txt"
    f.write_text("AAPL\n# comment\nMSFT\n")
    assert scanner.universe(str(f)) == ["AAPL", "MSFT"]


# dashboard routes ------------------------------------------------------------

def _client(tmp_path, bars=None):
    from fastapi.testclient import TestClient

    from nse_research.app import create_app
    from nse_research.config import Settings
    from nse_research.store import Store

    s = Settings(symbols=["SYN"], history_days=2000, db_path=tmp_path / "m.db", token=None)
    if bars is not None:
        Store(s.db_path).upsert_bars("SYN", bars, "test", "2026-01-01T00:00:00")
    return TestClient(create_app(s))


def test_tradingview_webhook_needs_secret_and_never_orders(tmp_path, monkeypatch):
    c = _client(tmp_path)
    assert c.post("/api/desk/tradingview", json={"symbol": "AAPL"}).status_code == 403
    monkeypatch.setenv("DESK_WEBHOOK_SECRET", "s3")
    monkeypatch.setattr(alerts, "send", lambda *a, **k: [])
    r = c.post("/api/desk/tradingview", json={"secret": "s3", "symbol": "AAPL", "event": "entry_rules_met", "price": 10})
    assert r.status_code == 200 and r.json()["orders_placed"] == 0
    assert alerts.Alerts().s["history"][-1]["symbol"] == "AAPL"


def test_desk_routes_read_stored_bars(tmp_path):
    c = _client(tmp_path, walk(400))
    assert c.get("/api/desk/entry/SYN").json()["verdict"] in (entry.RULES_MET, entry.WAIT, entry.AVOID)
    assert c.get("/api/desk/scan").json()["scanned"] == 1
    page = c.get("/desk/timemachine/SYN?paths=500")
    assert page.status_code == 200 and "time machine" in page.text
    assert c.get("/api/desk/entry/NOPE").status_code == 404
