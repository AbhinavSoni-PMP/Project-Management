"""Order execution. Paper trading by default.

PaperBroker keeps a ledger in data/desk/ledger.json: cash, positions, open
orders, fills and a daily equity history. Market orders fill at the price you
pass (the CLI uses the last available close) plus slippage and fees. Limit,
stop and bracket exits fill when `update` sees a bar that reaches them.
Every new order is checked by the risk manager and the budget first.

Live orders go only through AlpacaBroker (US stocks; Alpaca offers free
paper and live accounts). A live order needs all three of:
    1. the environment variable DESK_ALLOW_LIVE=1
    2. the --live flag on that one command
    3. typing the confirmation phrase shown, e.g. "LIVE BUY 10 AAPL"
Nothing in this package sends a live order on its own: alerts and the scanner
never place orders.
"""

from __future__ import annotations

import datetime as dt
import json
import os
import urllib.error
import urllib.request
import uuid
from pathlib import Path

from . import state
from .risk import RiskLimits, check_trade

SLIPPAGE_BPS = 5.0
FEE_BPS = 5.0


class OrderError(RuntimeError):
    pass


def _now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def _bar(p) -> dict:
    if isinstance(p, dict):
        c = float(p["close"])
        return {"open": float(p.get("open", c)), "high": float(p.get("high", c)), "low": float(p.get("low", c)), "close": c}
    return {"open": float(p), "high": float(p), "low": float(p), "close": float(p)}


class PaperBroker:
    mode = "PAPER"

    def __init__(self, path: Path | None = None, slippage_bps: float = SLIPPAGE_BPS, fee_bps: float = FEE_BPS):
        self.path = path or state.path("ledger.json")
        self.slip = slippage_bps / 1e4
        self.fee = fee_bps / 1e4
        self.s = state.load(self.path, {"cash": 0.0, "positions": {}, "orders": [], "fills": [], "realized_pnl": 0.0,
                                        "equity_history": [], "created": _now()})

    def save(self) -> None:
        state.save(self.path, self.s)

    # money ---------------------------------------------------------------
    def deposit(self, amount: float) -> None:
        self.s["cash"] += float(amount)
        self.save()

    def equity(self, prices: dict | None = None) -> float:
        prices = prices or {}
        val = sum(p["qty"] * _bar(prices.get(s, p.get("last", p["avg_price"])))["close"] for s, p in self.s["positions"].items())
        return self.s["cash"] + val

    def loss_today(self) -> float:
        today = dt.date.today().isoformat()
        return -sum(f.get("pnl", 0.0) for f in self.s["fills"] if f["at"][:10] == today and f.get("pnl", 0.0) < 0)

    # orders --------------------------------------------------------------
    def place(self, symbol: str, side: str, qty: int, order_type: str = "market", price: float | None = None,
              market_price: float | None = None, stop: float | None = None, target: float | None = None,
              limits: RiskLimits | None = None, override: bool = False, reserve: float = 0.0) -> dict:
        side, order_type, symbol = side.lower(), order_type.lower(), symbol.upper()
        if side not in ("buy", "sell") or order_type not in ("market", "limit", "stop") or qty <= 0:
            raise OrderError("side must be buy/sell, type market/limit/stop, qty > 0")
        if order_type != "market" and price is None:
            raise OrderError(f"a {order_type} order needs a price")
        if order_type == "market" and market_price is None:
            raise OrderError("a market order needs the current price to fill against")
        held = self.s["positions"].get(symbol, {}).get("qty", 0)
        if side == "sell" and qty > held:
            raise OrderError(f"cannot sell {qty} {symbol}: holding {held} (paper broker is long only)")
        order = {"id": uuid.uuid4().hex[:8], "symbol": symbol, "side": side, "qty": int(qty), "type": order_type,
                 "price": price, "stop": stop, "target": target, "status": "open", "created": _now(), "mode": self.mode}
        if side == "buy":
            ref = market_price if order_type == "market" else price
            risk = check_trade(self.equity(), self.s["positions"], symbol, qty, ref, stop, target, limits, self.loss_today())
            cost = qty * ref * (1 + self.slip + self.fee)
            if cost > self.s["cash"] - reserve:
                risk["blocks"].append(f"Needs {cost:,.2f} but only {self.s['cash'] - reserve:,.2f} cash is free after the reserve.")
                risk["approved"], risk["status"] = False, "BLOCKED"
            order["risk_check"] = risk
            if not risk["approved"] and not override:
                order["status"] = "rejected"
                self.s["orders"].append(order)
                self.save()
                return order
        self.s["orders"].append(order)
        if order_type == "market":
            self._fill(order, market_price)
        self.save()
        return order

    def cancel(self, order_id: str) -> dict:
        for o in self.s["orders"]:
            if o["id"] == order_id and o["status"] == "open":
                o["status"] = "cancelled"
                self.save()
                return o
        raise OrderError(f"no open order {order_id}")

    def _fill(self, order: dict, px: float, reason: str | None = None) -> None:
        sign = 1 if order["side"] == "buy" else -1
        fill = px * (1 + sign * self.slip)
        fee = order["qty"] * fill * self.fee
        sym = order["symbol"]
        pos = self.s["positions"].get(sym)
        rec = {"order_id": order["id"], "symbol": sym, "side": order["side"], "qty": order["qty"], "price": round(fill, 4),
               "fee": round(fee, 4), "at": _now(), "reason": reason or order["type"]}
        if sign > 0:
            self.s["cash"] -= order["qty"] * fill + fee
            if pos:
                q = pos["qty"] + order["qty"]
                pos["avg_price"] = (pos["avg_price"] * pos["qty"] + fill * order["qty"]) / q
                pos["qty"] = q
                pos["stop"] = order.get("stop") or pos.get("stop")
                pos["target"] = order.get("target") or pos.get("target")
            else:
                self.s["positions"][sym] = {"qty": order["qty"], "avg_price": fill, "stop": order.get("stop"),
                                            "target": order.get("target"), "opened": _now(), "last": fill}
        else:
            pnl = (fill - pos["avg_price"]) * order["qty"] - fee
            rec["pnl"] = round(pnl, 2)
            self.s["realized_pnl"] += pnl
            self.s["cash"] += order["qty"] * fill - fee
            pos["qty"] -= order["qty"]
            if pos["qty"] == 0:
                del self.s["positions"][sym]
        order["status"], order["filled_at"], order["fill_price"] = "filled", rec["at"], rec["price"]
        self.s["fills"].append(rec)

    def update(self, prices: dict) -> list[dict]:
        """Feed the latest bar per symbol ({sym: {open, high, low, close}} or
        {sym: price}). Fills resting orders and bracket exits. Returns fills."""
        before = len(self.s["fills"])
        for o in [o for o in self.s["orders"] if o["status"] == "open" and o["symbol"] in prices]:
            b = _bar(prices[o["symbol"]])
            if o["type"] == "limit":
                hit = b["low"] <= o["price"] if o["side"] == "buy" else b["high"] >= o["price"]
                px = min(o["price"], b["open"]) if o["side"] == "buy" else max(o["price"], b["open"])
            else:  # stop entry / stop exit
                hit = b["high"] >= o["price"] if o["side"] == "buy" else b["low"] <= o["price"]
                px = max(o["price"], b["open"]) if o["side"] == "buy" else min(o["price"], b["open"])
            if hit and (o["side"] == "buy" or o["symbol"] in self.s["positions"]):
                self._fill(o, px)
        for sym, pos in list(self.s["positions"].items()):
            if sym not in prices:
                continue
            b = _bar(prices[sym])
            pos["last"] = b["close"]
            exit_px, why = None, None
            if pos.get("stop") is not None and b["low"] <= pos["stop"]:
                exit_px, why = min(pos["stop"], b["open"]), "stop"
            elif pos.get("target") is not None and b["high"] >= pos["target"]:
                exit_px, why = max(pos["target"], b["open"]), "target"
            if exit_px is not None:
                o = {"id": uuid.uuid4().hex[:8], "symbol": sym, "side": "sell", "qty": pos["qty"], "type": "market",
                     "status": "open", "created": _now(), "mode": self.mode}
                self.s["orders"].append(o)
                self._fill(o, exit_px, why)
        self.s["equity_history"].append({"at": _now(), "equity": round(self.equity(prices), 2)})
        self.save()
        return self.s["fills"][before:]

    def set_stop(self, symbol: str, stop: float | None = None, target: float | None = None) -> dict:
        pos = self.s["positions"].get(symbol.upper())
        if not pos:
            raise OrderError(f"no position in {symbol}")
        if stop is not None:
            if pos.get("stop") is not None and stop < pos["stop"]:
                raise OrderError("the exit plan never moves a stop further away")
            pos["stop"] = stop
        if target is not None:
            pos["target"] = target
        self.save()
        return pos

    def summary(self, prices: dict | None = None) -> dict:
        eq = self.equity(prices)
        return {
            "mode": self.mode,
            "cash": round(self.s["cash"], 2),
            "equity": round(eq, 2),
            "realized_pnl": round(self.s["realized_pnl"], 2),
            "positions": self.s["positions"],
            "open_orders": [o for o in self.s["orders"] if o["status"] == "open"],
            "recent_fills": self.s["fills"][-10:],
        }


# live ----------------------------------------------------------------------

def confirmation_phrase(side: str, qty: int, symbol: str) -> str:
    return f"LIVE {side.upper()} {int(qty)} {symbol.upper()}"


def require_live_confirmation(side: str, qty: int, symbol: str, typed: str | None, env=os.environ) -> None:
    if env.get("DESK_ALLOW_LIVE") != "1":
        raise OrderError("Live trading is off. Set DESK_ALLOW_LIVE=1 to allow it for this session.")
    want = confirmation_phrase(side, qty, symbol)
    if (typed or "").strip() != want:
        raise OrderError(f"Live order not sent: confirmation did not match {want!r}.")


class AlpacaBroker:
    """Alpaca REST orders. Uses the paper endpoint unless live=True, and a
    live order must pass require_live_confirmation first."""

    PAPER = "https://paper-api.alpaca.markets"
    LIVE = "https://api.alpaca.markets"

    def __init__(self, key: str | None = None, secret: str | None = None, live: bool = False, opener=None):
        self.key = key or os.environ.get("ALPACA_KEY_ID")
        self.secret = secret or os.environ.get("ALPACA_SECRET_KEY")
        if not self.key or not self.secret:
            raise OrderError("Set ALPACA_KEY_ID and ALPACA_SECRET_KEY (free at alpaca.markets).")
        self.live = live
        self.mode = "LIVE" if live else "ALPACA PAPER"
        self.base = self.LIVE if live else self.PAPER
        self._open = opener or urllib.request.urlopen

    def _req(self, method: str, path: str, body: dict | None = None) -> dict:
        req = urllib.request.Request(
            self.base + path, method=method, data=None if body is None else json.dumps(body).encode(),
            headers={"APCA-API-KEY-ID": self.key, "APCA-API-SECRET-KEY": self.secret, "Content-Type": "application/json"},
        )
        try:
            with self._open(req, timeout=30) as r:
                return json.loads(r.read() or b"{}")
        except urllib.error.HTTPError as e:
            raise OrderError(f"Alpaca {e.code}: {e.read().decode('utf-8', 'replace')[:300]}") from None

    def place(self, symbol: str, side: str, qty: int, order_type: str = "market", price: float | None = None,
              stop: float | None = None, target: float | None = None, typed_confirmation: str | None = None) -> dict:
        if self.live:
            require_live_confirmation(side, qty, symbol, typed_confirmation)
        body = {"symbol": symbol.upper(), "qty": str(int(qty)), "side": side.lower(), "type": order_type, "time_in_force": "day"}
        if order_type == "limit":
            body["limit_price"] = str(price)
        if order_type == "stop":
            body["stop_price"] = str(price)
        if side.lower() == "buy" and stop is not None and target is not None:
            body.update(order_class="bracket", take_profit={"limit_price": str(target)}, stop_loss={"stop_price": str(stop)})
            body["time_in_force"] = "gtc"
        elif side.lower() == "buy" and stop is not None:
            body.update(order_class="oto", stop_loss={"stop_price": str(stop)})
            body["time_in_force"] = "gtc"
        return {"mode": self.mode, **self._req("POST", "/v2/orders", body)}

    def account(self) -> dict:
        return self._req("GET", "/v2/account")

    def positions(self) -> list:
        return self._req("GET", "/v2/positions")
