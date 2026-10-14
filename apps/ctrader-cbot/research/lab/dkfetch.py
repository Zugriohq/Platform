"""Dukascopy 1-minute bars (bid, optionally ask) -> one compact file per instrument.

python3 -I dkfetch.py <out_dir> <from YYYY-MM-DD> <to YYYY-MM-DD> <side BID|ASK> SYMBOL [SYMBOL...]

Day files are cached raw in <out_dir>/raw/<SYM>/<SIDE>/<date>.bi5 (resumable). Each instrument is then written to
<out_dir>/<SYM>_<SIDE>.m1 as little-endian float64 rows: epoch_seconds, open, high, low, close.
Dukascopy months in URLs are zero-based; record layout: int32 seconds-from-midnight, open, close, low, high (big-endian
int32 scaled by the instrument's point), float32 volume. Saturdays carry no data and are skipped. Minutes with zero
volume and an unchanged price (market closed) are dropped.
"""
import lzma, os, struct, sys, time, urllib.error, urllib.request
from datetime import date, datetime, timedelta, timezone

SCALE = {"XAUUSD": 1e3, "XAGUSD": 1e3, "USDJPY": 1e3, "EURJPY": 1e3, "GBPJPY": 1e3, "USA500IDXUSD": 1e3, "USATECHIDXUSD": 1e3,
         "USA30IDXUSD": 1e3, "DEUIDXEUR": 1e3, "LIGHTCMDUSD": 1e3, "BRENTCMDUSD": 1e3}


def get(url):
    for k in range(12):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=40) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return b""
            time.sleep(min(180, 15 * (k + 1)))
        except Exception:
            time.sleep(min(180, 15 * (k + 1)))
    raise RuntimeError("failed " + url)


def main():
    out, d0, d1, side, syms = sys.argv[1], date.fromisoformat(sys.argv[2]), date.fromisoformat(sys.argv[3]), sys.argv[4], sys.argv[5:]
    for s in syms:
        raw = os.path.join(out, "raw", s, side)
        os.makedirs(raw, exist_ok=True)
        d, rows, n = d0, [], 0
        while d <= d1:
            if d.weekday() != 5:
                p = os.path.join(raw, d.isoformat() + ".bi5")
                if not os.path.exists(p):
                    b = get(f"https://datafeed.dukascopy.com/datafeed/{s}/{d.year:04d}/{d.month - 1:02d}/{d.day:02d}/{side}_candles_min_1.bi5")
                    open(p, "wb").write(b)
                    time.sleep(float(os.environ.get("DK_PAUSE", "1.5")))
                    n += 1
                b = open(p, "rb").read()
                if b:
                    x = lzma.decompress(b)
                    base = datetime(d.year, d.month, d.day, tzinfo=timezone.utc).timestamp()
                    sc = SCALE.get(s, 1e5)
                    prev = None
                    for i in range(len(x) // 24):
                        t, o, c, lo, hi, v = struct.unpack(">5if", x[i * 24:(i + 1) * 24])
                        if v == 0 and o == c == lo == hi and prev == c:
                            continue
                        prev = c
                        rows.append((base + t, o / sc, hi / sc, lo / sc, c / sc))
            d += timedelta(days=1)
        with open(os.path.join(out, f"{s}_{side}.m1"), "wb") as f:
            for r in rows:
                f.write(struct.pack("<5d", *r))
        print(s, side, len(rows), "bars,", n, "downloaded", flush=True)


if __name__ == "__main__":
    main()
