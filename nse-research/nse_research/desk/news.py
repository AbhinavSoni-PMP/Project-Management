"""News monitor: recent headlines for each stock, tagged by event type.

Sources (free, no key, RSS):
    Google News search  "<name or symbol> stock"
    Yahoo Finance       per-ticker headline feed (US tickers, and NSE with .NS)

Tags come from keyword rules (earnings, guidance, rating change, deal,
legal, offering, buyback, dividend, insider, management, regulator). The
tone score counts positive and negative words in the headline. Both are
crude: they help you decide what to read, they do not predict the price.

`monitor` remembers what it has shown before (data/desk/news_seen.json) so
each run lists only new headlines.
"""

from __future__ import annotations

import datetime as dt
import email.utils
import hashlib
import re
import urllib.parse
import xml.etree.ElementTree as ET

from . import data, state

TAGS = {
    "earnings": r"\b(earnings|results|quarter|q[1-4]|eps|revenue|profit|net income|loss widens|beats?|miss(es|ed)?)\b",
    "guidance": r"\b(guidance|outlook|forecast|raises? (its )?(full-year|fy)|cuts? (its )?(outlook|forecast))\b",
    "rating": r"\b(upgrade[sd]?|downgrade[sd]?|price target|initiat\w+ coverage|overweight|underweight|outperform)\b",
    "deal": r"\b(acquir\w+|acquisition|merger|takeover|buyout|stake|joint venture|deal)\b",
    "legal": r"\b(lawsuit|sued|probe|investigation|fraud|sec charges|penalty|fine[sd]?|settle\w*)\b",
    "offering": r"\b(offering|share sale|dilution|qip|rights issue|fpo|ipo)\b",
    "buyback": r"\b(buyback|repurchase)\b",
    "dividend": r"\b(dividend|payout|bonus issue|split)\b",
    "insider": r"\b(insider|promoter|director (buys|sells)|form 4)\b",
    "management": r"\b(ceo|cfo|chairman|resign\w*|appoint\w*|steps down)\b",
    "regulator": r"\b(sebi|fda|rbi|approval|recall|ban(ned)?|license)\b",
}
POSITIVE = set("beat beats record surge surges soar soars jump jumps rally rallies gain gains upgrade upgraded raise raises strong growth approval wins win profit higher outperform buyback".split())
NEGATIVE = set("miss misses plunge plunges slump slumps fall falls drop drops downgrade downgraded cut cuts weak loss losses probe lawsuit fraud recall lower underperform resign resigns warning".split())


def _items(xml_bytes: bytes, source: str) -> list[dict]:
    root = ET.fromstring(xml_bytes)
    out = []
    for it in root.iter("item"):
        title = (it.findtext("title") or "").strip()
        if not title:
            continue
        pub = it.findtext("pubDate")
        try:
            when = email.utils.parsedate_to_datetime(pub).astimezone(dt.timezone.utc) if pub else None
        except (TypeError, ValueError):
            when = None
        out.append({
            "title": title,
            "link": (it.findtext("link") or "").strip(),
            "published": when.isoformat(timespec="minutes") if when else None,
            "publisher": (it.findtext("source") or "").strip() or None,
            "source": source,
        })
    return out


def tag(title: str) -> dict:
    t = title.lower()
    tags = [k for k, rx in TAGS.items() if re.search(rx, t)]
    words = re.findall(r"[a-z]+", t)
    score = sum(w in POSITIVE for w in words) - sum(w in NEGATIVE for w in words)
    return {"tags": tags, "tone": "positive" if score > 0 else "negative" if score < 0 else "neutral", "tone_score": score}


def fetch(symbol: str, query: str | None = None, opener=None, max_age_days: int = 7) -> dict:
    q = query or f"{symbol.split('.')[0]} stock"
    feeds = {
        "Google News": f"https://news.google.com/rss/search?q={urllib.parse.quote(q)}+when:{max_age_days}d&hl=en-US&gl=US&ceid=US:en",
        "Yahoo Finance": f"https://feeds.finance.yahoo.com/rss/2.0/headline?s={urllib.parse.quote(symbol)}&region=US&lang=en-US",
    }
    items, errors = [], []
    for name, url in feeds.items():
        try:
            items += _items(data.http_get(url, opener), name)
        except (data.DataError, ET.ParseError) as e:
            errors.append(f"{name}: {e}")
    cutoff = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=max_age_days)
    seen, out = set(), []
    for it in items:
        key = re.sub(r"\W+", " ", it["title"].lower()).strip()[:80]
        if key in seen or (it["published"] and dt.datetime.fromisoformat(it["published"]) < cutoff):
            continue
        seen.add(key)
        out.append({**it, **tag(it["title"])})
    out.sort(key=lambda x: x["published"] or "", reverse=True)
    counts = {k: sum(k in i["tags"] for i in out) for k in TAGS}
    return {
        "symbol": symbol,
        "headlines": out,
        "tag_counts": {k: v for k, v in counts.items() if v},
        "tone_balance": sum(i["tone_score"] for i in out),
        "errors": errors,
        "note": "Tags and tone are keyword rules, not a prediction. Read the article before acting.",
    }


def monitor(symbols: list[str], opener=None, path=None) -> dict:
    p = path or state.path("news_seen.json")
    seen = set(state.load(p, []))
    report = {}
    for s in symbols:
        r = fetch(s, opener=opener)
        new = []
        for h in r["headlines"]:
            k = hashlib.sha1((s + h["title"]).encode()).hexdigest()[:16]
            if k not in seen:
                seen.add(k)
                new.append(h)
        report[s] = {"new": new, "errors": r["errors"], "flagged": [h for h in new if set(h["tags"]) & {"earnings", "guidance", "legal", "offering", "rating"}]}
    state.save(p, sorted(seen)[-5000:])
    return report
