# Yahoo Finance hourly bars (up to ~2.8 years) -> hbars/SYM.json, base for the higher timeframes and the SWING style.
import sys, json, os, urllib.request
out = sys.argv[1]
for ysym, sym in [("EURUSD=X","EURUSD"),("GBPUSD=X","GBPUSD"),("AUDUSD=X","AUDUSD"),("JPY=X","USDJPY"),("GC=F","XAUUSD")]:
    req = urllib.request.Request(f"https://query1.finance.yahoo.com/v8/finance/chart/{ysym}?interval=1h&range=730d", headers={"User-Agent":"Mozilla/5.0"})
    r = json.loads(urllib.request.urlopen(req, timeout=60).read())["chart"]["result"][0]; q = r["indicators"]["quote"][0]
    rows = [[t*1000, q["open"][i], q["high"][i], q["low"][i], q["close"][i], 0.0] for i, t in enumerate(r["timestamp"])
            if None not in (q["open"][i], q["high"][i], q["low"][i], q["close"][i]) and t % 3600 == 0][:-1]
    json.dump({"symbol": sym, "bars": rows, "baseMinutes": 60, "source": "yahoo 1h " + ysym}, open(os.path.join(out, sym + ".json"), "w"))
    print(sym, len(rows), "hourly bars")
