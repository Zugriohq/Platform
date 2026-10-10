# Daily bars for 11 world equity indices since 1990 (Yahoo). Usage: python3 -I ifetch.py OUTDIR
# range=max returns monthly bars for long histories, so the request uses explicit period1/period2.
# Timestamps are the exchange's session open in UTC (they differ per market; idx2.mjs groups by local date).
import json, sys, time, urllib.request
from datetime import datetime, timezone

out = sys.argv[1]
END = int(time.time())
for ysym, sym in [("^GSPC", "SPX"), ("^NDX", "NDX"), ("^DJI", "DJI"), ("^RUT", "RUT"), ("^GDAXI", "DAX"), ("^FTSE", "FTSE"),
                  ("^N225", "N225"), ("^STOXX50E", "SX5E"), ("^FCHI", "CAC"), ("^HSI", "HSI"), ("^AXJO", "ASX200")]:
    try:
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ysym}?interval=1d&period1=631152000&period2={END}"
        r = json.loads(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=60).read())["chart"]["result"][0]
        q = r["indicators"]["quote"][0]
        rows = [[t * 1000, q["open"][i], q["high"][i], q["low"][i], q["close"][i]] for i, t in enumerate(r["timestamp"])
                if None not in (q["open"][i], q["high"][i], q["low"][i], q["close"][i]) and q["low"][i] > 0 and q["high"][i] >= q["low"][i]][:-1]
        json.dump({"symbol": sym, "bars": rows}, open(f"{out}/{sym}.json", "w"))
        print(sym, len(rows), datetime.fromtimestamp(rows[0][0] / 1000, timezone.utc).date())
    except Exception as e:
        print(sym, "FAILED", e)
    time.sleep(0.5)
