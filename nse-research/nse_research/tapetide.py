"""Minimal read-only client for the Tapetide REST API.

Only GET routes are used. Errors are raised, never replaced with made-up data.
Each successful request costs one unit of your Tapetide quota.
Docs: https://developers.tapetide.com
"""

from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request

BASE_URL = "https://api.tapetide.com"
MAX_DAYS = 2000


class TapetideError(RuntimeError):
    def __init__(self, status: int | None, route: str, message: str):
        super().__init__(f"{route}: {status or 'network'} {message}")
        self.status = status
        self.route = route


class TapetideClient:
    def __init__(self, token: str, base_url: str = BASE_URL, timeout: float = 30.0, opener=None):
        if not token:
            raise ValueError("TAPETIDE_TOKEN is not set")
        self.token = token
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self._open = opener or urllib.request.urlopen

    def get(self, path: str, **params) -> dict:
        query = urllib.parse.urlencode({k: v for k, v in params.items() if v is not None})
        url = f"{self.base_url}{path}" + (f"?{query}" if query else "")
        req = urllib.request.Request(
            url, headers={"Authorization": f"Bearer {self.token}", "Accept": "application/json"}
        )
        try:
            with self._open(req, timeout=self.timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", "replace")[:300]
            raise TapetideError(e.code, path, body) from None
        except urllib.error.URLError as e:
            raise TapetideError(None, path, str(e.reason)) from None

    def price_history(self, symbol: str, days: int, end_date: str | None = None) -> tuple[list[dict], dict]:
        """Daily OHLCV, paging back with end_date until `days` is covered."""
        path = f"/v1/stocks/{urllib.parse.quote(symbol, safe='')}/price"
        rows: list[dict] = []
        remaining = days
        meta: dict = {}
        while remaining > 0:
            chunk = min(remaining, MAX_DAYS)
            payload = self.get(path, days=chunk, interval="daily", end_date=end_date)
            page = payload.get("data") or []
            meta = payload.get("meta") or {}
            rows = page + rows
            window = meta.get("window") or {}
            remaining -= chunk
            if not page or not window.get("has_more") or not window.get("next_cursor"):
                break
            end_date = window["next_cursor"]
        return rows, meta

    def observation_status(self, symbol: str, days: int = 30) -> list[dict]:
        path = f"/v1/stocks/{urllib.parse.quote(symbol, safe='')}/observation-status"
        return self.get(path, days=days).get("data") or []
