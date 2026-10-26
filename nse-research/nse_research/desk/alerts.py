"""Price alerts: rules checked against the latest bars, with optional free
push notifications.

Rules
    above PRICE           close at or above PRICE
    below PRICE           close at or below PRICE
    move PCT              close moved PCT% or more from the previous close
    cross_above_sma N     close crossed above its N-day SMA on the last bar
    cross_below_sma N     close crossed below its N-day SMA on the last bar
    entry_ready           the entry timer says RULES MET
    stop_near PRICE       close within 1 ATR of a stop at PRICE

Notifications (all optional, all free), set in the environment or .env:
    DESK_NTFY_TOPIC       push to the ntfy app (https://ntfy.sh/<topic>)
    DESK_WEBHOOK_URL      POST JSON to a Discord/Slack-style webhook
    TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID   message from your Telegram bot

Alerts only notify. They never place orders.
"""

from __future__ import annotations

import datetime as dt
import json
import os
import urllib.parse
import urllib.request
import uuid

from ..indicators import compute_all, sma
from . import data, entry, state

RULES = ("above", "below", "move", "cross_above_sma", "cross_below_sma", "entry_ready", "stop_near")


class Alerts:
    def __init__(self, path=None):
        self.path = path or state.path("alerts.json")
        self.s = state.load(self.path, {"alerts": [], "history": []})

    def save(self) -> None:
        state.save(self.path, self.s)

    def add(self, symbol: str, rule: str, value: float | None = None, note: str = "", repeat: bool = False) -> dict:
        if rule not in RULES:
            raise ValueError(f"rule must be one of {', '.join(RULES)}")
        if rule != "entry_ready" and value is None:
            raise ValueError(f"rule {rule} needs a value")
        a = {"id": uuid.uuid4().hex[:6], "symbol": symbol.upper(), "rule": rule, "value": value, "note": note,
             "repeat": repeat, "active": True, "created": dt.datetime.now().isoformat(timespec="seconds")}
        self.s["alerts"].append(a)
        self.save()
        return a

    def remove(self, alert_id: str) -> None:
        self.s["alerts"] = [a for a in self.s["alerts"] if a["id"] != alert_id]
        self.save()

    def active(self) -> list[dict]:
        return [a for a in self.s["alerts"] if a["active"]]

    def record(self, event: dict) -> None:
        self.s["history"].append({"at": dt.datetime.now().isoformat(timespec="seconds"), **event})
        self.s["history"] = self.s["history"][-500:]
        self.save()

    def check(self, loader=None, notify: bool = True) -> list[dict]:
        load = loader or (lambda s: data.load(s))
        fired, frames = [], {}
        for a in self.active():
            sym = a["symbol"]
            try:
                if sym not in frames:
                    frames[sym] = load(sym)
                hit, msg = evaluate(a, frames[sym])
            except Exception as e:
                fired.append({"alert": a, "error": str(e)})
                continue
            if hit:
                ev = {"alert_id": a["id"], "symbol": sym, "rule": a["rule"], "message": msg}
                fired.append(ev)
                self.record(ev)
                a["last_triggered"] = dt.datetime.now().isoformat(timespec="seconds")
                if not a["repeat"]:
                    a["active"] = False
                if notify:
                    send(f"{sym}: {msg}")
        self.save()
        return fired


def evaluate(a: dict, df) -> tuple[bool, str]:
    c = df["close"]
    last, prev = float(c.iloc[-1]), float(c.iloc[-2])
    v = a.get("value")
    date = str(df.index[-1].date())
    if a["rule"] == "above":
        return last >= v, f"closed {last:.2f}, at or above {v} ({date})"
    if a["rule"] == "below":
        return last <= v, f"closed {last:.2f}, at or below {v} ({date})"
    if a["rule"] == "move":
        ch = 100 * (last / prev - 1)
        return abs(ch) >= v, f"moved {ch:+.2f}% to {last:.2f} ({date})"
    if a["rule"] in ("cross_above_sma", "cross_below_sma"):
        s = sma(c, int(v))
        now, before = last - s.iloc[-1], prev - s.iloc[-2]
        up = a["rule"] == "cross_above_sma"
        hit = (before <= 0 < now) if up else (before >= 0 > now)
        return bool(hit), f"crossed {'above' if up else 'below'} its {int(v)}-day SMA at {last:.2f} ({date})"
    if a["rule"] == "entry_ready":
        e = entry.check(df, a["symbol"])
        return e["verdict"] == entry.RULES_MET, f"entry rules met ({', '.join(e.get('triggers', []))}) at {last:.2f} ({date})"
    if a["rule"] == "stop_near":
        atr = float(compute_all(df)["atr14"].iloc[-1])
        return last - v <= atr, f"closed {last:.2f}, within 1 ATR ({atr:.2f}) of the stop {v} ({date})"
    raise ValueError(a["rule"])


def send(text: str, env=os.environ, opener=None) -> list[str]:
    """Send to every configured channel. Returns the channels used."""
    op = opener or urllib.request.urlopen
    used = []
    print(f"[ALERT] {text}")
    jobs = []
    if env.get("DESK_NTFY_TOPIC"):
        jobs.append(("ntfy", urllib.request.Request(f"https://ntfy.sh/{urllib.parse.quote(env['DESK_NTFY_TOPIC'])}",
                                                    data=text.encode(), method="POST", headers={"Title": "Trading desk alert"})))
    if env.get("DESK_WEBHOOK_URL"):
        jobs.append(("webhook", urllib.request.Request(env["DESK_WEBHOOK_URL"], data=json.dumps({"content": text, "text": text}).encode(),
                                                       method="POST", headers={"Content-Type": "application/json"})))
    if env.get("TELEGRAM_BOT_TOKEN") and env.get("TELEGRAM_CHAT_ID"):
        url = f"https://api.telegram.org/bot{env['TELEGRAM_BOT_TOKEN']}/sendMessage"
        body = urllib.parse.urlencode({"chat_id": env["TELEGRAM_CHAT_ID"], "text": text}).encode()
        jobs.append(("telegram", urllib.request.Request(url, data=body, method="POST")))
    for name, req in jobs:
        try:
            with op(req, timeout=15):
                used.append(name)
        except Exception as e:  # a failed channel must not hide the alert
            print(f"[ALERT] {name} failed: {e}")
    return used
