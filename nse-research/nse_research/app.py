"""Local web app. Data changes only when POST /api/refresh is called
(the Refresh button); every other route reads the local store."""

from __future__ import annotations

import threading
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse

from . import analysis, config, labels
from .normalize import now_ist
from .refresh import refresh
from .store import Store
from .tapetide import TapetideClient

STATIC = Path(__file__).resolve().parent.parent / "static"


def create_app(settings: config.Settings | None = None, client: TapetideClient | None = None) -> FastAPI:
    settings = settings or config.load()
    store = Store(settings.db_path)
    lock = threading.Lock()
    app = FastAPI(title="NSE Research Terminal")

    @app.get("/")
    def index():
        return FileResponse(STATIC / "index.html")

    @app.get("/api/status")
    def status():
        return {
            "universe": settings.symbols,
            "token_configured": bool(settings.token or client),
            "now_ist": now_ist().isoformat(timespec="minutes"),
            "recent_fetches": store.recent_fetches(20),
            "disclaimer": labels.DISCLAIMER,
        }

    @app.post("/api/refresh")
    def do_refresh():
        c = client
        if c is None:
            if not settings.token:
                raise HTTPException(400, "TAPETIDE_TOKEN is not set. Add it to nse-research/.env and restart.")
            c = TapetideClient(settings.token)
        if not lock.acquire(blocking=False):
            raise HTTPException(409, "A refresh is already running.")
        try:
            return refresh(store, c, settings.symbols, settings.history_days).as_dict()
        finally:
            lock.release()

    @app.get("/api/stocks")
    def stocks():
        now = now_ist()
        syms = list(dict.fromkeys(settings.symbols + store.symbols()))
        return {"stocks": [analysis.summary(store, s, now) for s in syms]}

    @app.get("/api/stocks/{symbol}")
    def stock(symbol: str):
        return analysis.detail(store, symbol.upper(), now_ist())

    # Trading desk ---------------------------------------------------------
    # Read-only views over stored bars, plus the TradingView webhook. None of
    # these routes places an order.

    def _desk_bars(symbol: str):
        df = store.bars(symbol.upper())
        if df.empty:
            raise HTTPException(404, f"No stored bars for {symbol}. Press Refresh first.")
        return df

    @app.get("/api/desk/scan")
    def desk_scan():
        from .desk import scanner

        syms = list(dict.fromkeys(settings.symbols + store.symbols()))
        return scanner.scan(syms, loader=lambda s: _desk_bars(s))

    @app.get("/api/desk/entry/{symbol}")
    def desk_entry(symbol: str):
        from .desk import entry

        return entry.check(_desk_bars(symbol), symbol.upper())

    @app.get("/api/desk/exit/{symbol}")
    def desk_exit(symbol: str, entry: float | None = None):
        from .desk import exits

        return exits.plan(_desk_bars(symbol), entry)

    @app.get("/desk/timemachine/{symbol}", response_class=HTMLResponse)
    def desk_timemachine(symbol: str, strategy: str = "any", paths: int = 10_000):
        from .desk import report, timemachine

        df = _desk_bars(symbol)
        return report.render(df, timemachine.run(df, symbol.upper(), strategy, paths=min(paths, 20_000)))

    @app.post("/api/desk/tradingview")
    async def desk_tradingview(request: Request):
        from .desk import alerts, tradingview

        try:
            payload = await request.json()
        except ValueError:
            raise HTTPException(400, "Body must be JSON.")
        if not tradingview.verify_webhook(payload):
            raise HTTPException(403, "Bad or missing secret. Set DESK_WEBHOOK_SECRET and the same secret in the Pine Script.")
        event = {k: payload.get(k) for k in ("symbol", "event", "price")}
        alerts.Alerts().record({"source": "tradingview", **event})
        alerts.send(f"TradingView: {event['symbol']} {event['event']} at {event['price']}")
        return {"received": event, "orders_placed": 0}

    return app


def main() -> None:
    import uvicorn

    uvicorn.run(create_app(), host="127.0.0.1", port=8000)


if __name__ == "__main__":
    main()
