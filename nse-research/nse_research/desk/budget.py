"""Budget manager: how much money the desk may use, and when it must stop.

Settings live in data/desk/budget.json; the money itself is the paper
ledger's cash. The budget sets
    reserve_pct              cash kept aside that trades may never use
    monthly_loss_limit_pct   pause new trades after losing this much in a month
    risk limits              passed to the risk manager for every order
and reports what is free to trade right now.
"""

from __future__ import annotations

import copy
import datetime as dt
from dataclasses import asdict

from . import state
from .orders import PaperBroker
from .risk import RiskLimits

DEFAULTS = {"currency": "USD", "reserve_pct": 20.0, "monthly_loss_limit_pct": 8.0, "limits": asdict(RiskLimits()), "log": []}


class Budget:
    def __init__(self, path=None, broker: PaperBroker | None = None):
        self.path = path or state.path("budget.json")
        self.s = {**copy.deepcopy(DEFAULTS), **state.load(self.path, {})}
        self.broker = broker or PaperBroker()

    def save(self) -> None:
        state.save(self.path, self.s)

    @property
    def limits(self) -> RiskLimits:
        return RiskLimits.from_dict(self.s.get("limits"))

    def init(self, capital: float, currency: str = "USD", **settings) -> dict:
        if self.s["log"]:
            raise ValueError("budget already set up; use deposit or withdraw")
        self.s["currency"] = currency.upper()
        for k, v in settings.items():
            if v is None:
                continue
            if k in self.s["limits"]:
                self.s["limits"][k] = v
            elif k in DEFAULTS:
                self.s[k] = v
        return self.deposit(capital, "starting capital")

    def deposit(self, amount: float, note: str = "") -> dict:
        if amount <= 0:
            raise ValueError("amount must be positive")
        self.broker.deposit(amount)
        self.s["log"].append({"date": dt.date.today().isoformat(), "amount": float(amount), "note": note})
        self.save()
        return self.status()

    def withdraw(self, amount: float, note: str = "") -> dict:
        if amount <= 0 or amount > self.broker.s["cash"]:
            raise ValueError("amount must be positive and at most the cash balance")
        self.broker.deposit(-amount)
        self.s["log"].append({"date": dt.date.today().isoformat(), "amount": -float(amount), "note": note})
        self.save()
        return self.status()

    def reserve(self, prices: dict | None = None) -> float:
        return self.broker.equity(prices) * self.s["reserve_pct"] / 100

    def month_pnl(self, prices: dict | None = None) -> float:
        """Equity change this month net of deposits and withdrawals."""
        month = dt.date.today().strftime("%Y-%m")
        hist = [h for h in self.broker.s["equity_history"] if h["at"][:7] < month]
        flows = sum(e["amount"] for e in self.s["log"] if e["date"][:7] == month)
        start = hist[-1]["equity"] if hist else sum(e["amount"] for e in self.s["log"] if e["date"][:7] < month)
        return self.broker.equity(prices) - start - flows

    def status(self, prices: dict | None = None) -> dict:
        eq = self.broker.equity(prices)
        cash = self.broker.s["cash"]
        res = self.reserve(prices)
        mp = self.month_pnl(prices)
        limit = eq * self.s["monthly_loss_limit_pct"] / 100
        paused = mp < 0 and -mp >= limit
        lim = self.limits
        return {
            "currency": self.s["currency"],
            "equity": round(eq, 2),
            "cash": round(cash, 2),
            "invested": round(eq - cash, 2),
            "reserve": round(res, 2),
            "free_to_trade": round(max(0.0, cash - res), 2),
            "risk_per_trade": round(eq * lim.risk_per_trade_pct / 100, 2),
            "month_pnl": round(mp, 2),
            "monthly_loss_limit": round(limit, 2),
            "trading_paused": paused,
            "status": "PAUSED: monthly loss limit reached" if paused else "OK",
            "limits": asdict(lim),
        }

    def place(self, symbol: str, side: str, qty: int, override: bool = False, **kw) -> dict:
        """Place a paper order with this budget's limits, reserve and pause."""
        if side.lower() == "buy" and not override and self.status().get("trading_paused"):
            return {"status": "rejected", "symbol": symbol.upper(), "side": side, "qty": qty,
                    "risk_check": {"blocks": ["Monthly loss limit reached: new buys are paused until next month."]}}
        return self.broker.place(symbol, side, qty, limits=self.limits, reserve=self.reserve(), override=override, **kw)
