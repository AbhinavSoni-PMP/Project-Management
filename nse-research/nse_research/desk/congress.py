"""Congress trades tracker (the "Pelosi tracker").

Members of the US House must report stock trades over $1,000 within 45 days
in a Periodic Transaction Report (PTR). The House Clerk publishes them free:

    index   https://disclosures-clerk.house.gov/public_disc/financial-pdfs/<YEAR>FD.zip
    report  https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/<YEAR>/<DocID>.pdf

`fetch` downloads the index, then each new PTR PDF, and reads the trade lines
(ticker, buy/sell, dates, amount range). Electronically filed reports parse
well; scanned paper reports cannot be read and are listed with their link.
Parsed reports are cached under data/desk/congress/.

Senate reports sit behind a terms-of-use page at efdsearch.senate.gov and
are not downloaded automatically; `import_csv` takes trades you export from
there (or any other source) so they appear in the same summaries.

Keep the timing in mind: a trade can be disclosed up to 45 days after it
happened, and amounts are ranges, not exact values. Copying a disclosed trade
means buying weeks after the member did.
"""

from __future__ import annotations

import csv
import datetime as dt
import io
import re
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

from . import data, state

INDEX_URL = "https://disclosures-clerk.house.gov/public_disc/financial-pdfs/{year}FD.zip"
PTR_URL = "https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/{year}/{doc}.pdf"
TYPES = {"P": "buy", "S": "sell", "S (partial)": "sell (partial)", "E": "exchange"}

TRADE_RX = re.compile(
    r"(?:(?P<owner>SP|JT|DC)\s+)?(?P<asset>[^\[\]]{0,160}?)\((?P<ticker>[A-Z][A-Z0-9.\-]{0,7})\)\s*"
    r"\[(?P<kind>[A-Z]{2})\]\s*(?P<type>S \(partial\)|P|S|E)\s+"
    r"(?P<tdate>\d{2}/\d{2}/\d{4})\s+(?P<ndate>\d{2}/\d{2}/\d{4})\s+"
    r"(?P<amount>\$[\d,]+\s*-\s*\$[\d,]+|Over \$[\d,]+|\$[\d,]+)"
)


def _dir() -> Path:
    return state.path("congress")


def _money(s: str) -> float:
    return float(s.replace("$", "").replace(",", "").strip())


def amount_mid(amount: str) -> float | None:
    nums = [_money(x) for x in re.findall(r"\$[\d,]+", amount)]
    if not nums:
        return None
    return sum(nums) / len(nums)


def parse_index(xml_bytes: bytes) -> list[dict]:
    root = ET.fromstring(xml_bytes)
    out = []
    for m in root.iter("Member"):
        g = lambda k: (m.findtext(k) or "").strip()
        out.append({
            "name": " ".join(x for x in (g("Prefix"), g("First"), g("Last"), g("Suffix")) if x),
            "last": g("Last"), "first": g("First"), "district": g("StateDst"),
            "filing_type": g("FilingType"), "year": g("Year"), "filing_date": g("FilingDate"), "doc_id": g("DocID"),
        })
    return out


def index(year: int, opener=None) -> list[dict]:
    raw = data.http_get(INDEX_URL.format(year=year), opener)
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        name = next(n for n in z.namelist() if n.lower().endswith(".xml"))
        return parse_index(z.read(name))


def parse_ptr_text(text: str) -> list[dict]:
    flat = re.sub(r"\s+", " ", text.replace("\x00", ""))
    trades = []
    for m in TRADE_RX.finditer(flat):
        # The lazy match can start inside the previous line's leftovers, so
        # the owner code and asset name are taken from the last owner token.
        parts = re.split(r"(?:^|\s)(SP|JT|DC)\s", " " + m["asset"])
        owner = m["owner"] or (parts[-2] if len(parts) >= 3 else "")
        asset = parts[-1].split("$200?")[-1].split(": New")[-1].strip(" -")
        tdate = dt.datetime.strptime(m["tdate"], "%m/%d/%Y").date()
        ndate = dt.datetime.strptime(m["ndate"], "%m/%d/%Y").date()
        trades.append({
            "ticker": m["ticker"], "asset": asset[-120:], "asset_type": m["kind"],
            "owner": {"SP": "spouse", "JT": "joint", "DC": "dependent child"}.get(owner, "self"),
            "type": TYPES[m["type"]], "transaction_date": str(tdate), "notification_date": str(ndate),
            "amount": m["amount"].replace("  ", " "), "amount_mid": amount_mid(m["amount"]),
            "days_to_disclose": (ndate - tdate).days,
        })
    return trades


def _pdf_text(raw: bytes) -> str:
    import pdfplumber  # optional dependency, only needed here

    with pdfplumber.open(io.BytesIO(raw)) as pdf:
        return "\n".join(p.extract_text() or "" for p in pdf.pages)


def fetch(year: int | None = None, days: int = 90, member: str | None = None, max_reports: int = 200,
          opener=None, pdf_text=None) -> dict:
    """Download and parse PTRs filed in the last `days` days (optionally one member)."""
    year = year or dt.date.today().year
    pdf_text = pdf_text or _pdf_text
    cache = _dir()
    filings = [f for f in index(year, opener) if f["filing_type"] == "P"]
    cutoff = dt.date.today() - dt.timedelta(days=days)
    sel = []
    for f in filings:
        try:
            fd = dt.datetime.strptime(f["filing_date"], "%m/%d/%Y").date()
        except ValueError:
            continue
        if fd < cutoff or (member and member.lower() not in f["name"].lower()):
            continue
        sel.append(f)
    sel = sorted(sel, key=lambda f: dt.datetime.strptime(f["filing_date"], "%m/%d/%Y"), reverse=True)[:max_reports]
    parsed, unreadable = 0, []
    for f in sel:
        p = cache / f"{f['doc_id']}.json"
        if p.exists():
            continue
        url = PTR_URL.format(year=year, doc=f["doc_id"])
        try:
            trades = parse_ptr_text(pdf_text(data.http_get(url, opener)))
        except Exception as e:
            trades, f["error"] = [], str(e)
        if not trades:
            unreadable.append({**f, "url": url})
        state.save(p, {**f, "url": url, "trades": trades})
        parsed += 1
    return {"year": year, "filings_in_window": len(sel), "newly_parsed": parsed, "unreadable": unreadable}


def import_csv(path: str | Path, chamber: str = "senate") -> int:
    """CSV with columns member, ticker, type (buy/sell), transaction_date,
    disclosure_date, amount. Dates as YYYY-MM-DD."""
    rows = list(csv.DictReader(io.StringIO(Path(path).read_text())))
    trades = [{
        "ticker": r["ticker"].strip().upper(), "asset": r.get("asset", ""), "asset_type": "ST", "owner": r.get("owner", "self"),
        "type": r["type"].strip().lower(), "transaction_date": r["transaction_date"], "notification_date": r["disclosure_date"],
        "amount": r["amount"], "amount_mid": amount_mid(r["amount"]) if "$" in r["amount"] else float(r["amount"] or 0),
        "days_to_disclose": (dt.date.fromisoformat(r["disclosure_date"]) - dt.date.fromisoformat(r["transaction_date"])).days,
        "member": r["member"],
    } for r in rows]
    doc = f"import-{chamber}-{Path(path).stem}"
    state.save(_dir() / f"{doc}.json", {"name": f"{chamber} import", "doc_id": doc, "chamber": chamber, "trades": trades})
    return len(trades)


def all_trades() -> list[dict]:
    out = []
    for p in sorted(_dir().glob("*.json")):
        rep = state.load(p, {})
        for t in rep.get("trades", []):
            out.append({"member": t.get("member") or rep.get("name"), "district": rep.get("district"),
                        "filing_date": rep.get("filing_date"), "url": rep.get("url"), **t})
    return out


def summary(days: int = 90, member: str | None = None, ticker: str | None = None, stocks_only: bool = True) -> dict:
    cutoff = str(dt.date.today() - dt.timedelta(days=days))
    ts = [t for t in all_trades() if t["notification_date"] >= cutoff]
    if stocks_only:
        ts = [t for t in ts if t["asset_type"] in ("ST", "OP")]
    if member:
        ts = [t for t in ts if member.lower() in (t["member"] or "").lower()]
    if ticker:
        ts = [t for t in ts if t["ticker"] == ticker.upper()]
    by = {}
    for t in ts:
        b = by.setdefault(t["ticker"], {"ticker": t["ticker"], "buys": 0, "sells": 0, "buy_value_mid": 0.0, "sell_value_mid": 0.0, "members": set()})
        side = "buy" if t["type"] == "buy" else "sell" if t["type"].startswith("sell") else None
        if side:
            b[side + "s"] += 1
            b[side + "_value_mid"] += t["amount_mid"] or 0
        b["members"].add(t["member"])
    table = sorted(({**v, "members": sorted(m for m in v["members"] if m)} for v in by.values()),
                   key=lambda r: (-(len(r["members"])), -r["buy_value_mid"]))
    lag = [t["days_to_disclose"] for t in ts]
    return {
        "window_days": days,
        "trades": len(ts),
        "most_traded": table[:25],
        "latest": sorted(ts, key=lambda t: t["notification_date"], reverse=True)[:25],
        "median_disclosure_lag_days": sorted(lag)[len(lag) // 2] if lag else None,
        "note": ("Disclosed up to 45 days after the trade; amounts are ranges (value_mid is the midpoint). "
                 "This shows what was reported, not why, and is not a signal to copy."),
    }
