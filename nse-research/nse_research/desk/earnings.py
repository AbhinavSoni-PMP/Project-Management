"""Earnings analyst for US-listed companies, from SEC EDGAR (free, official).

For each of the last quarters: revenue, diluted EPS, net income and their
year-on-year change, taken from the company's 10-Q and 10-K filings. The
fourth quarter is not filed on its own, so it is the annual figure minus the
three quarters inside that year (labelled derived).

With price data it also measures how the stock moved around past filings,
which is a fair guide to the size of the gap risk on the next report. Filing
dates can trail the earnings press release by a few days, so the move is
measured from the close before the filing date and is labelled approximate.

Analyst consensus and "beat/miss" need paid data and are not included.
NSE companies: use the Tapetide connector's financials (see the skill).

The SEC asks every client to identify itself: set DESK_SEC_CONTACT to
"Your Name your@email" (it is only sent to sec.gov).
"""

from __future__ import annotations

import datetime as dt
import json
import os

import pandas as pd

from . import data

REVENUE_TAGS = ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax", "SalesRevenueNet", "RevenueFromContractWithCustomerIncludingAssessedTax"]
EPS_TAGS = ["EarningsPerShareDiluted", "EarningsPerShareBasic"]
NI_TAGS = ["NetIncomeLoss", "ProfitLoss"]


def _headers():
    return {"User-Agent": os.environ.get("DESK_SEC_CONTACT", "nse-research-desk personal-research@example.com")}


def cik_for(ticker: str, opener=None) -> tuple[str, str]:
    rows = json.loads(data.http_get("https://www.sec.gov/files/company_tickers.json", opener, _headers()))
    t = ticker.upper().replace("-", ".")
    for r in rows.values():
        if r["ticker"].upper() == t:
            return f"{int(r['cik_str']):010d}", r["title"]
    raise data.DataError(f"SEC: no CIK for {ticker} (US-listed companies only)")


def _series(facts: dict, tags: list[str], unit: str) -> pd.DataFrame:
    """Quarterly values for the first tag with the most recent data."""
    best = None
    for tag in tags:
        units = facts.get("facts", {}).get("us-gaap", {}).get(tag, {}).get("units", {})
        rows = units.get(unit) or []
        rows = [r for r in rows if r.get("start") and r.get("form") in ("10-Q", "10-K", "10-Q/A", "10-K/A")]
        if not rows:
            continue
        df = pd.DataFrame(rows)
        df["start"], df["end"], df["filed"] = (pd.to_datetime(df[k]) for k in ("start", "end", "filed"))
        if best is None or df["end"].max() > best["end"].max():
            best = df
    if best is None:
        return pd.DataFrame(columns=["end", "value", "filed", "derived"])
    best["days"] = (best["end"] - best["start"]).dt.days
    first_filed = best.groupby("end")["filed"].min()
    latest = best.sort_values("filed").drop_duplicates(["start", "end"], keep="last")
    q = latest[(latest["days"] >= 80) & (latest["days"] <= 100)].copy()
    q["derived"] = False
    annual = latest[(latest["days"] >= 350) & (latest["days"] <= 380)]
    extra = []
    for _, a in annual.iterrows():
        if (q["end"] == a["end"]).any():
            continue
        inside = q[(q["start"] >= a["start"] - pd.Timedelta(days=7)) & (q["end"] < a["end"])]
        if len(inside) == 3:
            extra.append({"start": inside["end"].max() + pd.Timedelta(days=1), "end": a["end"], "val": a["val"] - inside["val"].sum(),
                          "filed": a["filed"], "derived": True})
    if extra:
        q = pd.concat([q, pd.DataFrame(extra)], ignore_index=True)
    q["filed"] = q["end"].map(first_filed).fillna(q["filed"])
    q = q.sort_values("end").drop_duplicates("end", keep="first")
    return q.rename(columns={"val": "value"})[["end", "value", "filed", "derived"]]


def quarters(facts: dict, n: int = 8) -> list[dict]:
    rev = _series(facts, REVENUE_TAGS, "USD").set_index("end")
    eps = _series(facts, EPS_TAGS, "USD/shares").set_index("end")
    ni = _series(facts, NI_TAGS, "USD").set_index("end")
    ends = sorted(set(rev.index) | set(eps.index) | set(ni.index))
    out = []
    for e in ends:
        def get(df):
            return float(df.loc[e, "value"]) if e in df.index else None

        def yoy(df):
            prior = [p for p in df.index if abs((e - p).days - 365) <= 15]
            if e not in df.index or not prior:
                return None
            a, b = float(df.loc[e, "value"]), float(df.loc[prior[0], "value"])
            return None if b == 0 else round(100 * (a - b) / abs(b), 1)

        filed = next((df.loc[e, "filed"] for df in (rev, eps, ni) if e in df.index), None)
        derived = any(bool(df.loc[e, "derived"]) for df in (rev, eps, ni) if e in df.index)
        out.append({
            "period_end": str(e.date()),
            "filed": None if filed is None else str(pd.Timestamp(filed).date()),
            "revenue": get(rev), "revenue_yoy_pct": yoy(rev),
            "eps_diluted": get(eps), "eps_yoy_pct": yoy(eps),
            "net_income": get(ni), "net_income_yoy_pct": yoy(ni),
            "q4_derived_from_annual": derived,
        })
    return out[-n:]


def reaction(prices: pd.DataFrame, filed_dates: list[str]) -> dict:
    """Close-to-close move from the session before each filing date."""
    c = prices["close"]
    moves = []
    for d in filed_dates:
        if not d:
            continue
        t = pd.Timestamp(d)
        before = c[c.index < t]
        after = c[c.index >= t]
        if before.empty or len(after) < 5:
            continue
        b = float(before.iloc[-1])
        moves.append({"filed": d, "day1_pct": round(100 * (float(after.iloc[0]) / b - 1), 2),
                      "day5_pct": round(100 * (float(after.iloc[4]) / b - 1), 2)})
    if not moves:
        return {"moves": [], "note": "No filings inside the price history."}
    d1 = pd.Series([m["day1_pct"] for m in moves])
    return {
        "moves": moves,
        "avg_abs_day1_move_pct": round(float(d1.abs().mean()), 2),
        "max_abs_day1_move_pct": round(float(d1.abs().max()), 2),
        "up_share_pct": round(100 * float((d1 > 0).mean()), 1),
        "note": "Approximate: measured from the close before the SEC filing date, which can trail the press release.",
    }


def analyse(ticker: str, opener=None, prices: pd.DataFrame | None = None, facts: dict | None = None) -> dict:
    name = None
    if facts is None:
        cik, name = cik_for(ticker, opener)
        facts = json.loads(data.http_get(f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json", opener, _headers()))
    name = name or facts.get("entityName")
    qs = quarters(facts)
    notes = []
    revs = [q["revenue_yoy_pct"] for q in qs if q["revenue_yoy_pct"] is not None]
    if len(revs) >= 3:
        trend = "accelerating" if revs[-1] > revs[-2] > revs[-3] else "slowing" if revs[-1] < revs[-2] < revs[-3] else "mixed"
        notes.append(f"Revenue growth over the last three quarters is {trend}: " + ", ".join(f"{r:+.1f}%" for r in revs[-3:]) + ".")
    eps = [q["eps_diluted"] for q in qs if q["eps_diluted"] is not None]
    if eps and eps[-1] < 0:
        notes.append("Latest diluted EPS is negative (a loss).")
    last_filed = max((q["filed"] for q in qs if q["filed"]), default=None)
    nxt = None
    if last_filed:
        nxt = str((pd.Timestamp(last_filed) + pd.Timedelta(days=91)).date())
        days = (pd.Timestamp(nxt).date() - dt.date.today()).days
        notes.append(f"Next report estimated around {nxt} ({days} days), from the usual 13-week cycle; check the company's investor page for the real date.")
    out = {
        "ticker": ticker.upper(),
        "company": name,
        "source": "SEC EDGAR company facts (official, free)",
        "quarters": qs,
        "next_report_estimate": nxt,
        "notes": notes,
    }
    if prices is not None:
        out["price_reaction"] = reaction(prices, [q["filed"] for q in qs])
    return out
