"""Small JSON files that hold the desk's own state (budget, paper ledger,
alerts). They live under data/desk/, which is git-ignored with data/."""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path

from ..config import ROOT

DESK_DIR = Path(os.environ.get("DESK_DIR", ROOT / "data" / "desk"))


def path(name: str, base: Path | None = None) -> Path:
    return (base or DESK_DIR) / name


def load(p: Path, default):
    if not p.exists():
        return default
    return json.loads(p.read_text())


def save(p: Path, data) -> None:
    """Write atomically so a crash never leaves half a ledger."""
    p.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=p.parent, suffix=".tmp")
    with os.fdopen(fd, "w") as f:
        json.dump(data, f, indent=2, default=str)
    os.replace(tmp, p)
