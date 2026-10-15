"""Predeclaration lock (#118 acceptance test 1).

The predeclaration file fixes signals, windows, cost model, correction method, alpha, N and seeds.
The first time the test or holdout window is opened, the file's SHA-256 is written to a lock file
next to it. Any later change to the predeclaration makes the harness refuse to open those windows.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

PROTECTED_WINDOWS = ("test", "holdout")
REQUIRED_KEYS = ("signals", "windows", "cost_model", "correction", "alpha", "n_null", "seed")


class PredeclarationViolation(RuntimeError):
    pass


@dataclass(frozen=True)
class Predeclaration:
    path: Path
    sha256: str
    content: dict

    @classmethod
    def load(cls, path: str | Path) -> "Predeclaration":
        p = Path(path)
        raw = p.read_bytes()
        content = json.loads(raw)
        missing = [k for k in REQUIRED_KEYS if k not in content]
        if missing:
            raise PredeclarationViolation(f"predeclaration missing keys: {missing}")
        return cls(p, hashlib.sha256(raw).hexdigest(), content)

    @property
    def lock_path(self) -> Path:
        return self.path.with_suffix(self.path.suffix + ".lock")

    def open_window(self, window: str) -> dict:
        """Return the window spec; locks the predeclaration on first access to a protected window."""
        spec = self.content["windows"][window]
        if window not in PROTECTED_WINDOWS:
            return spec
        lock = self.lock_path
        if lock.exists():
            locked = json.loads(lock.read_text())
            if locked["sha256"] != self.sha256:
                raise PredeclarationViolation(
                    f"predeclaration changed after {locked['locked_at']} (locked {locked['sha256'][:12]}, "
                    f"now {self.sha256[:12]}); test/holdout results from this file are void"
                )
        else:
            lock.write_text(
                json.dumps(
                    {"sha256": self.sha256, "locked_at": datetime.now(timezone.utc).isoformat(), "first_window": window},
                    indent=2,
                )
            )
        return spec
