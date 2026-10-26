"""Risk manager: how many shares, and whether a trade fits the limits.

Position size comes from the stop, not from conviction: risk a fixed share of
equity per trade (default 1%), so a loss at the stop costs the same whatever
the stock. The trade is then checked against portfolio limits. A trade that
breaks a limit is BLOCKED; the paper broker refuses it unless overridden.
"""

from __future__ import annotations

import math
from dataclasses import asdict, dataclass, fields


@dataclass
class RiskLimits:
    risk_per_trade_pct: float = 1.0  # loss at the stop, as % of equity
    max_position_pct: float = 20.0  # one position's value, as % of equity
    max_open_risk_pct: float = 6.0  # sum of all positions' loss-at-stop
    max_positions: int = 8
    daily_loss_limit_pct: float = 3.0  # stop opening trades after this loss today
    min_reward_risk: float = 1.5  # target distance / stop distance

    @classmethod
    def from_dict(cls, d: dict | None) -> "RiskLimits":
        names = {f.name for f in fields(cls)}
        return cls(**{k: v for k, v in (d or {}).items() if k in names})


def position_size(equity: float, entry: float, stop: float, limits: RiskLimits | None = None, cash: float | None = None) -> dict:
    limits = limits or RiskLimits()
    if stop >= entry:
        raise ValueError("stop must be below entry for a long trade")
    per_share = entry - stop
    budget = equity * limits.risk_per_trade_pct / 100
    by_risk = math.floor(budget / per_share)
    by_size = math.floor(equity * limits.max_position_pct / 100 / entry)
    caps = {"risk": by_risk, "max position size": by_size}
    if cash is not None:
        caps["cash available"] = math.floor(max(cash, 0) / entry)
    qty = max(0, min(caps.values()))
    binding = min(caps, key=caps.get)
    return {
        "shares": qty,
        "position_value": round(qty * entry, 2),
        "risk_if_stopped": round(qty * per_share, 2),
        "risk_pct_of_equity": round(100 * qty * per_share / equity, 2) if equity else None,
        "limited_by": binding,
        "caps": caps,
        "note": "Shares are rounded down. Gaps through the stop can lose more than the planned risk.",
    }


def open_risk(positions: dict) -> float:
    """Money lost if every open position hit its stop now."""
    total = 0.0
    for p in positions.values():
        if p.get("stop") is not None:
            total += max(0.0, p["qty"] * (p["avg_price"] - p["stop"]))
        else:
            total += p["qty"] * p["avg_price"]  # no stop: the whole position is at risk
    return total


def check_trade(equity: float, positions: dict, symbol: str, qty: int, entry: float, stop: float | None,
                target: float | None = None, limits: RiskLimits | None = None, loss_today: float = 0.0) -> dict:
    limits = limits or RiskLimits()
    blocks, warns = [], []
    if equity <= 0:
        blocks.append("No equity: fund the budget first.")
        return {"approved": False, "blocks": blocks, "warnings": warns}
    if stop is None:
        blocks.append("No stop: every trade needs a protective stop before entry.")
        risk = qty * entry
    else:
        if stop >= entry:
            blocks.append("Stop must be below entry for a long trade.")
        risk = qty * max(entry - stop, 0)
    risk_pct = 100 * risk / equity
    if risk_pct > limits.risk_per_trade_pct + 1e-9:
        blocks.append(f"Risk {risk_pct:.2f}% of equity is over the {limits.risk_per_trade_pct}% per-trade limit.")
    value_pct = 100 * qty * entry / equity
    if value_pct > limits.max_position_pct + 1e-9:
        blocks.append(f"Position is {value_pct:.1f}% of equity, over the {limits.max_position_pct}% limit.")
    heat = 100 * (open_risk(positions) + risk) / equity
    if heat > limits.max_open_risk_pct + 1e-9:
        blocks.append(f"Total open risk would be {heat:.1f}% of equity, over the {limits.max_open_risk_pct}% limit.")
    if symbol not in positions and len(positions) >= limits.max_positions:
        blocks.append(f"Already {len(positions)} positions open (limit {limits.max_positions}).")
    if 100 * loss_today / equity >= limits.daily_loss_limit_pct:
        blocks.append(f"Daily loss limit of {limits.daily_loss_limit_pct}% reached: no new trades today.")
    if target is not None and stop is not None and entry > stop:
        rr = (target - entry) / (entry - stop)
        if rr < limits.min_reward_risk:
            blocks.append(f"Reward to risk {rr:.2f} is under the {limits.min_reward_risk} minimum.")
    elif target is None:
        warns.append("No target set; the trailing stop will be the only profit exit.")
    return {
        "approved": not blocks,
        "status": "APPROVED" if not blocks else "BLOCKED",
        "blocks": blocks,
        "warnings": warns,
        "risk": round(risk, 2),
        "risk_pct": round(risk_pct, 2),
        "open_risk_after_pct": round(heat, 2),
        "limits": asdict(limits),
    }
