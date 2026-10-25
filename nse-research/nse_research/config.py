"""Settings from config.toml plus the Tapetide token from the environment or .env."""

from __future__ import annotations

import os
import tomllib
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


@dataclass
class Settings:
    symbols: list[str]
    history_days: int
    db_path: Path
    token: str | None


def _read_dotenv(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    if not path.exists():
        return out
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def load(root: Path = ROOT) -> Settings:
    cfg_file = root / "config.toml"
    cfg = tomllib.loads(cfg_file.read_text()) if cfg_file.exists() else {}
    symbols = [s.strip().upper() for s in cfg.get("universe", {}).get("symbols", []) if s.strip()]
    refresh = cfg.get("refresh", {})
    token = os.environ.get("TAPETIDE_TOKEN") or _read_dotenv(root / ".env").get("TAPETIDE_TOKEN")
    return Settings(
        symbols=symbols,
        history_days=int(refresh.get("history_days", 2000)),
        db_path=root / refresh.get("db_path", "data/market.db"),
        token=token or None,
    )
