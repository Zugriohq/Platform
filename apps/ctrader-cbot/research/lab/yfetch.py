# Yahoo Finance 5-minute bars (60 days) -> base bars [t_ms, o, h, l, c, spread=0]; the backtest applies a spread floor.
import sys, json, urllib.request, os
out, raw = sys.argv[1], sys.argv[2]
for ysym, sym in [("EURUSD=X", "EURUSD"), ("GBPUSD=X", "GBPUSD"), ("AUDUSD=X", "AUDUSD"), ("JPY=X", "USDJPY"), ("GC=F", "XAUUSD")]:
    req = urllib.request.Request(f"https://query1.finance.yahoo.com/v8/finance/chart/{ysym}?interval=5m&range=60d", headers={"User-Agent": "Mozilla/5.0"})
    data = urllib.request.urlopen(req, timeout=60).read()
    open(os.path.join(raw, sym + ".json"), "wb").write(data)
    r = json.loads(data)["chart"]["result"][0]; q = r["indicators"]["quote"][0]
    rows = []
    for i, t in enumerate(r["timestamp"]):
        o, h, l, c = q["open"][i], q["high"][i], q["low"][i], q["close"][i]
        if None in (o, h, l, c) or t % 300: continue
        rows.append([t * 1000, o, h, l, c, 0.0])
    rows = rows[:-1]   # the last bar may still be forming
    json.dump({"symbol": sym, "bars": rows, "baseMinutes": 5, "source": "yahoo " + ysym}, open(os.path.join(out, sym + ".json"), "w"))
    from datetime import datetime, timezone
    print(sym, len(rows), "bars", datetime.fromtimestamp(rows[0][0]/1000, timezone.utc), "->", datetime.fromtimestamp(rows[-1][0]/1000, timezone.utc), "last close", rows[-1][4])
