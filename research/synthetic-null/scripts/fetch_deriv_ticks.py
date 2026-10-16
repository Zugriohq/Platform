"""Download Deriv ``ticks_history`` (spot) as JSON lines. Secondary source only — see DATA_SOURCE.md.

Run on a machine with direct internet access (the agent environment's proxy blocks WebSocket upgrades):

    pip install websockets
    python scripts/fetch_deriv_ticks.py R_75 2026-09-15T00:00:00Z 2026-10-15T00:00:00Z data/R_75.jsonl

No API token is needed or accepted: ``ticks_history`` is public. ``app_id`` 1089 is Deriv's public test app.
The output is admissible only after ``synthnull.feed_check`` passes against an MT5 export.
"""

from __future__ import annotations

import asyncio
import json
import sys
from datetime import datetime

import websockets

URL = "wss://ws.derivws.com/websockets/v3?app_id=1089"
PAGE = 5000  # documented maximum ticks per request


def _epoch(s: str) -> int:
    return int(datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp())


async def fetch(symbol: str, start: int, end: int, out_path: str) -> None:
    rows: dict[int, float] = {}
    async with websockets.connect(URL, open_timeout=30) as ws:
        cursor_end = end
        while cursor_end > start:
            req = {"ticks_history": symbol, "start": start, "end": cursor_end, "count": PAGE, "style": "ticks"}
            await ws.send(json.dumps(req))
            resp = json.loads(await ws.recv())
            if "error" in resp:
                raise SystemExit(f"Deriv API error: {resp['error']}")
            times, prices = resp["history"]["times"], resp["history"]["prices"]
            if not times:
                break
            rows.update(zip(times, prices))
            if times[0] <= start or len(times) < PAGE:
                break
            cursor_end = times[0] - 1  # page backwards
            print(f"{symbol}: {len(rows)} ticks, back to {datetime.utcfromtimestamp(times[0])}Z", file=sys.stderr)
    with open(out_path, "w") as f:
        for t in sorted(rows):
            if start <= t <= end:
                f.write(json.dumps({"epoch": t, "quote": rows[t]}) + "\n")


if __name__ == "__main__":
    if len(sys.argv) != 5:
        sys.exit("usage: fetch_deriv_ticks.py <symbol> <start ISO> <end ISO> <out.jsonl>")
    asyncio.run(fetch(sys.argv[1], _epoch(sys.argv[2]), _epoch(sys.argv[3]), sys.argv[4]))
