# Daily Dukascopy M1 candle files (BID and ASK), fetched politely and cached per file; then M1 bars with spread.
# Usage: python3 -I fetch2.py CACHE OUTDIR SCALE FROM TO SYM [SYM...]
import sys, os, struct, lzma, json, datetime, urllib.request, urllib.error, time
cache, out, scale, d0, d1, syms = sys.argv[1], sys.argv[2], float(sys.argv[3]), sys.argv[4], sys.argv[5], sys.argv[6:]
def days():
    d = datetime.date.fromisoformat(d0)
    while d <= datetime.date.fromisoformat(d1):
        if d.weekday() != 5: yield d
        d += datetime.timedelta(days=1)
def fetch(sym, d, side):
    path = os.path.join(cache, sym, f"{d:%Y%m%d}_{side}.bi5")
    if os.path.exists(path): return open(path, "rb").read()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    url = f"https://datafeed.dukascopy.com/datafeed/{sym}/{d.year}/{d.month-1:02d}/{d.day:02d}/{side}_candles_min_1.bi5"
    for attempt in range(8):
        try:
            with urllib.request.urlopen(url, timeout=60) as r: data = r.read()
            open(path, "wb").write(data); time.sleep(0.7); return data
        except urllib.error.HTTPError as e:
            if e.code == 404: open(path, "wb").write(b""); return b""
            time.sleep(30 * (attempt + 1))
        except Exception:
            time.sleep(5 * (attempt + 1))
    return None
def candles(data, d):
    if not data: return {}
    raw = lzma.decompress(data, format=lzma.FORMAT_ALONE)
    base = int(datetime.datetime(d.year, d.month, d.day, tzinfo=datetime.timezone.utc).timestamp())
    res = {}
    for t, o, c, l, h, v in struct.iter_unpack(">IIIIIf", raw):
        if v > 0: res[(base + t) * 1000] = (o / scale, h / scale, l / scale, c / scale)
    return res
for sym in syms:
    rows = []; miss = 0
    for d in days():
        b, a = fetch(sym, d, "BID"), fetch(sym, d, "ASK")
        if b is None or a is None: miss += 1; continue
        bid, ask = candles(b, d), candles(a, d)
        for t in sorted(bid):
            o, h, l, c = bid[t]
            s = (ask[t][3] - c) if t in ask else None
            if s is None or s < 0: continue
            rows.append([t, o, h, l, c, s])
    json.dump({"symbol": sym, "bars": rows, "missingDays": miss}, open(os.path.join(out, sym + ".json"), "w"))
    print(sym, len(rows), "M1 bars, missing days", miss, "first", rows[0] if rows else None, flush=True)
