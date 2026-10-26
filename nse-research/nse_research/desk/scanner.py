"""Chart scanner: run every pattern and setup detector over many symbols and
rank what it finds.

Universes:
    config     the symbols in config.toml
    nse-all    every NSE equity, from NSE's free EQUITY_L.csv
    us-all     every SEC-registered ticker, from the SEC's free company_tickers.json
    a path     a text file with one symbol per line

Scanning thousands of symbols over free sources is slow and can be rate
limited; use --limit and --workers, and prefer the local store for NSE.
"""

from __future__ import annotations

import csv
import io
import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pandas as pd

from .. import config
from ..indicators import compute_all
from ..patterns import detect_patterns
from . import data, entry, setups

STAGE_SCORE = {"CONFIRMED": 3, "DEVELOPING": 2, "CANDIDATE": 1, "FAILED": 0}
VERDICT_SCORE = {entry.RULES_MET: 10, entry.WAIT: 3, entry.AVOID: 0}


def universe(name: str, opener=None, limit: int | None = None) -> list[str]:
    if name == "config":
        syms = config.load().symbols
    elif name == "nse-all":
        text = data.http_get("https://archives.nseindia.com/content/equities/EQUITY_L.csv", opener).decode("utf-8", "replace")
        syms = [r["SYMBOL"].strip() + ".NS" for r in csv.DictReader(io.StringIO(text)) if r.get("SYMBOL")]
    elif name == "us-all":
        rows = json.loads(data.http_get("https://www.sec.gov/files/company_tickers.json", opener))
        syms = sorted({r["ticker"].replace(".", "-") for r in rows.values()})
    else:
        syms = [s.strip() for s in Path(name).read_text().splitlines() if s.strip() and not s.startswith("#")]
    return syms[:limit] if limit else syms


def scan_one(symbol: str, df: pd.DataFrame) -> dict:
    ind = compute_all(df)
    pats = detect_patterns(df, ind) + setups.detect_all(df, ind)[0]
    short = setups.short_term(df, ind)
    e = entry.check(df, symbol)
    score = VERDICT_SCORE.get(e["verdict"], 0)
    for p in pats:
        if p.bias in ("bullish", "either"):
            score += STAGE_SCORE[p.stage]
        elif p.stage == "CONFIRMED":
            score -= 3
    last = float(df["close"].iloc[-1])
    return {
        "symbol": symbol,
        "date": str(df.index[-1].date()),
        "close": round(last, 2),
        "verdict": e["verdict"],
        "triggers": e.get("triggers", []),
        "score": score,
        "patterns": [
            {"name": p.name, "stage": p.stage, "bias": p.bias, "breakout_level": round(p.breakout_level, 2),
             "target": None if p.target_textbook is None else round(p.target_textbook, 2)}
            for p in pats
        ],
        "setups": [s.as_dict() for s in short],
        "source": str(df["source"].iloc[-1]) if "source" in df else None,
    }


def scan(symbols: list[str], source: str = "auto", workers: int = 4, opener=None, loader=None) -> dict:
    load = loader or (lambda s: data.load(s, source, opener))

    def job(sym):
        try:
            return scan_one(sym, load(sym))
        except Exception as e:  # one bad symbol must not stop a scan of thousands
            return {"symbol": sym, "error": str(e)}

    with ThreadPoolExecutor(max_workers=max(1, workers)) as ex:
        rows = list(ex.map(job, symbols))
    ok = sorted((r for r in rows if "error" not in r), key=lambda r: -r["score"])
    return {
        "scanned": len(symbols),
        "results": ok,
        "errors": [r for r in rows if "error" in r],
        "pattern_counts": pd.Series([p["name"] for r in ok for p in r["patterns"]]).value_counts().to_dict(),
        "note": "Score ranks how many rules and bullish structures line up; it is not a probability.",
    }
