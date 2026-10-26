"""Command line for the trading desk: python -m nse_research.desk <tool> ...

Run `python -m nse_research.desk -h` for the list, and `<tool> -h` for options.
Prints JSON so the output can be read by people, scripts and Claude alike.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from . import DISCLAIMER, data


def _out(obj) -> None:
    print(json.dumps(obj, indent=2, default=str))


def _bars(args):
    return data.load(args.symbol, args.source)


def _last_bar(symbol: str, source: str) -> dict:
    df = data.load(symbol, source)
    r = df.iloc[-1]
    return {"open": float(r["open"]), "high": float(r["high"]), "low": float(r["low"]), "close": float(r["close"]),
            "date": str(df.index[-1].date())}


def _exit_rules(a):
    from .exits import ExitRules

    return ExitRules(stop_atr=a.stop_atr, target_r=None if a.target_r == 0 else a.target_r,
                     trail_atr=None if a.trail_atr == 0 else a.trail_atr, max_bars=a.max_bars, cost_bps=a.cost_bps)


def cmd_scan(a):
    from . import scanner

    syms = a.symbols or scanner.universe(a.universe, limit=a.limit)
    res = scanner.scan(syms, a.source, a.workers)
    res["results"] = res["results"][: a.top]
    _out(res)


def cmd_news(a):
    from . import news

    _out(news.monitor(a.symbols) if a.new_only else {s: news.fetch(s, a.query) for s in a.symbols})


def cmd_entry(a):
    from . import entry

    _out(entry.check(_bars(a), a.symbol, a.days_to_earnings))


def cmd_exit(a):
    from . import exits

    _out(exits.plan(_bars(a), a.entry, _exit_rules(a), a.stop))


def cmd_timemachine(a):
    from . import report, timemachine

    df = _bars(a)
    res = timemachine.run(df, a.symbol, a.strategy, _exit_rules(a), a.paths, a.risk, a.years)
    if a.html:
        Path(a.html).write_text(report.render(df, res))
        res["html_report"] = str(Path(a.html).resolve())
    res["trade_monte_carlo"].pop("hist", None)
    for v in res["buy_today_monte_carlo"].values():
        v.pop("fan", None)
    if not a.all_trades:
        res["replay"]["trades"] = res["replay"]["trades"][-10:]
    _out(res)


def cmd_risk(a):
    from .budget import Budget
    from .risk import check_trade, position_size

    b = Budget()
    eq = a.equity or b.broker.equity()
    size = position_size(eq, a.entry, a.stop, b.limits, None if a.equity else b.broker.s["cash"] - b.reserve())
    qty = a.qty or size["shares"]
    _out({"equity": eq, "size": size,
          "check": check_trade(eq, b.broker.s["positions"], a.symbol, qty, a.entry, a.stop, a.target, b.limits, b.broker.loss_today())})


def cmd_budget(a):
    from .budget import Budget

    b = Budget()
    if a.action == "init":
        _out(b.init(a.amount, a.currency, reserve_pct=a.reserve_pct, monthly_loss_limit_pct=a.monthly_loss_limit_pct,
                    risk_per_trade_pct=a.risk_per_trade_pct))
    elif a.action == "deposit":
        _out(b.deposit(a.amount, a.note))
    elif a.action == "withdraw":
        _out(b.withdraw(a.amount, a.note))
    else:
        _out(b.status())


def cmd_order(a):
    from .budget import Budget
    from .orders import AlpacaBroker, OrderError, confirmation_phrase

    try:
        if a.action in ("buy", "sell"):
            if a.broker == "alpaca" or a.live:
                br = AlpacaBroker(live=a.live)
                typed = None
                if a.live:
                    phrase = confirmation_phrase(a.action, a.qty, a.symbol)
                    print(f"LIVE ORDER with real money: {a.action.upper()} {a.qty} {a.symbol.upper()} "
                          f"{a.type} {a.price or ''} stop={a.stop} target={a.target}", file=sys.stderr)
                    typed = input(f"Type exactly '{phrase}' to send, anything else cancels: ")
                _out(br.place(a.symbol, a.action, a.qty, a.type, a.price, a.stop, a.target, typed))
                return
            b = Budget()
            px = _last_bar(a.symbol, a.source) if a.type == "market" else None
            o = b.place(a.symbol, a.action, a.qty, a.override, order_type=a.type, price=a.price,
                        market_price=px["close"] if px else None, stop=a.stop, target=a.target)
            if px:
                o["priced_from"] = f"last close {px['close']:.2f} on {px['date']} (end-of-day data)"
            _out(o)
        elif a.action == "update":
            b = Budget()
            syms = {o["symbol"] for o in b.broker.s["orders"] if o["status"] == "open"} | set(b.broker.s["positions"])
            _out({"fills": b.broker.update({s: _last_bar(s, a.source) for s in syms}), "summary": b.broker.summary()})
        elif a.action == "cancel":
            _out(Budget().broker.cancel(a.symbol))
        elif a.action == "stop":
            _out(Budget().broker.set_stop(a.symbol, a.stop, a.target))
        else:
            _out(Budget().broker.summary())
    except OrderError as e:
        _out({"error": str(e)})
        sys.exit(1)


def cmd_alert(a):
    from .alerts import Alerts

    al = Alerts()
    if a.action == "add":
        _out(al.add(a.symbol, a.rule, a.value, a.note, a.repeat))
    elif a.action == "remove":
        al.remove(a.symbol)
        _out({"removed": a.symbol})
    elif a.action == "check":
        _out(al.check(lambda s: data.load(s, a.source)))
    else:
        _out({"active": al.active(), "recent": al.s["history"][-20:]})


def cmd_earnings(a):
    from . import earnings

    prices = None
    try:
        prices = data.load(a.symbol, a.source)
    except data.DataError:
        pass
    _out(earnings.analyse(a.symbol, prices=prices))


def cmd_congress(a):
    from . import congress

    if a.action == "fetch":
        _out(congress.fetch(a.year, a.days, a.member, a.max_reports))
    elif a.action == "import":
        _out({"imported": congress.import_csv(a.file, a.chamber)})
    else:
        _out(congress.summary(a.days, a.member, a.ticker))


def cmd_tradingview(a):
    from .tradingview import pine_script

    text = pine_script(_exit_rules(a), a.secret)
    if a.out:
        Path(a.out).write_text(text)
        print(f"Wrote {a.out}. Paste it into TradingView > Pine Editor > Add to chart.")
    else:
        print(text)


def build() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="python -m nse_research.desk", description="Trading desk tools. " + DISCLAIMER)
    sub = p.add_subparsers(dest="tool", required=True)

    def sym(sp, many=False):
        if many:
            sp.add_argument("symbols", nargs="*")
        else:
            sp.add_argument("symbol", help="AAPL, RELIANCE.NS, RELIANCE (local store) or a .csv file")
        sp.add_argument("--source", default="auto", choices=["auto", "store", "yahoo", "stooq", "csv"])

    def exitargs(sp):
        sp.add_argument("--stop-atr", type=float, default=2.0)
        sp.add_argument("--target-r", type=float, default=2.0, help="0 for no fixed target")
        sp.add_argument("--trail-atr", type=float, default=3.0, help="0 for no trailing stop")
        sp.add_argument("--max-bars", type=int, default=40)
        sp.add_argument("--cost-bps", type=float, default=10.0)

    s = sub.add_parser("scan", help="chart scanner: patterns and setups across many symbols")
    sym(s, many=True)
    s.add_argument("--universe", default="config", help="config, nse-all, us-all or a file of symbols")
    s.add_argument("--limit", type=int)
    s.add_argument("--workers", type=int, default=4)
    s.add_argument("--top", type=int, default=50)
    s.set_defaults(fn=cmd_scan)

    s = sub.add_parser("news", help="news monitor: tagged headlines per stock")
    s.add_argument("symbols", nargs="+")
    s.add_argument("--query")
    s.add_argument("--new-only", action="store_true", help="only headlines not shown before")
    s.set_defaults(fn=cmd_news)

    s = sub.add_parser("entry", help="entry timer: are the entry rules met now")
    sym(s)
    s.add_argument("--days-to-earnings", type=int)
    s.set_defaults(fn=cmd_entry)

    s = sub.add_parser("exit", help="exit planner: stop, targets, trailing and time stop")
    sym(s)
    s.add_argument("--entry", type=float)
    s.add_argument("--stop", type=float)
    exitargs(s)
    s.set_defaults(fn=cmd_exit)

    s = sub.add_parser("timemachine", help="replay on history plus 10,000-path Monte Carlo")
    sym(s)
    s.add_argument("--strategy", default="any", choices=["any", "breakout20", "pullback", "nr7"])
    s.add_argument("--paths", type=int, default=10_000)
    s.add_argument("--risk", type=float, default=1.0, help="%% of equity risked per trade")
    s.add_argument("--years", type=float, default=1.0, help="length of each resampled future")
    s.add_argument("--html", help="write an animated HTML report here")
    s.add_argument("--all-trades", action="store_true")
    exitargs(s)
    s.set_defaults(fn=cmd_timemachine)

    s = sub.add_parser("risk", help="risk manager: position size and limit check")
    s.add_argument("symbol")
    s.add_argument("--entry", type=float, required=True)
    s.add_argument("--stop", type=float, required=True)
    s.add_argument("--target", type=float)
    s.add_argument("--qty", type=int)
    s.add_argument("--equity", type=float, help="defaults to the paper ledger's equity")
    s.set_defaults(fn=cmd_risk)

    s = sub.add_parser("budget", help="budget manager: capital, reserve, loss limits")
    s.add_argument("action", choices=["init", "deposit", "withdraw", "status"])
    s.add_argument("amount", type=float, nargs="?", default=0)
    s.add_argument("--currency", default="USD")
    s.add_argument("--reserve-pct", type=float)
    s.add_argument("--monthly-loss-limit-pct", type=float)
    s.add_argument("--risk-per-trade-pct", type=float)
    s.add_argument("--note", default="")
    s.set_defaults(fn=cmd_budget)

    s = sub.add_parser("order", help="order execution: paper by default")
    s.add_argument("action", choices=["buy", "sell", "update", "cancel", "stop", "status"])
    s.add_argument("symbol", nargs="?", help="symbol, or the order id for cancel")
    s.add_argument("qty", type=int, nargs="?")
    s.add_argument("--type", default="market", choices=["market", "limit", "stop"])
    s.add_argument("--price", type=float)
    s.add_argument("--stop", type=float)
    s.add_argument("--target", type=float)
    s.add_argument("--source", default="auto", choices=["auto", "store", "yahoo", "stooq", "csv"])
    s.add_argument("--override", action="store_true", help="paper only: place even if the risk check blocks it")
    s.add_argument("--broker", default="paper", choices=["paper", "alpaca"], help="alpaca uses Alpaca's paper account")
    s.add_argument("--live", action="store_true", help="real money via Alpaca; needs DESK_ALLOW_LIVE=1 and typed confirmation")
    s.set_defaults(fn=cmd_order)

    s = sub.add_parser("alert", help="price alerts")
    s.add_argument("action", choices=["add", "list", "check", "remove"])
    s.add_argument("symbol", nargs="?", help="symbol, or the alert id for remove")
    s.add_argument("rule", nargs="?")
    s.add_argument("value", type=float, nargs="?")
    s.add_argument("--note", default="")
    s.add_argument("--repeat", action="store_true")
    s.add_argument("--source", default="auto", choices=["auto", "store", "yahoo", "stooq", "csv"])
    s.set_defaults(fn=cmd_alert)

    s = sub.add_parser("earnings", help="earnings analyst (US, SEC EDGAR)")
    sym(s)
    s.set_defaults(fn=cmd_earnings)

    s = sub.add_parser("congress", help="Pelosi tracker: US House trade disclosures")
    s.add_argument("action", choices=["fetch", "summary", "import"])
    s.add_argument("--year", type=int)
    s.add_argument("--days", type=int, default=90)
    s.add_argument("--member")
    s.add_argument("--ticker")
    s.add_argument("--max-reports", type=int, default=200)
    s.add_argument("--file")
    s.add_argument("--chamber", default="senate")
    s.set_defaults(fn=cmd_congress)

    s = sub.add_parser("tradingview", help="write the rules as a TradingView Pine Script")
    s.add_argument("--out")
    s.add_argument("--secret", default="change-me")
    exitargs(s)
    s.set_defaults(fn=cmd_tradingview)
    return p


def main(argv=None) -> None:
    a = build().parse_args(argv)
    try:
        a.fn(a)
    except (data.DataError, ValueError) as e:
        _out({"error": str(e)})
        sys.exit(1)
