"""Local web app. Data changes only when POST /api/refresh is called
(the Refresh button); every other route reads the local store."""

from __future__ import annotations

import threading
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse

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

    return app


def main() -> None:
    import uvicorn

    uvicorn.run(create_app(), host="127.0.0.1", port=8000)


if __name__ == "__main__":
    main()
