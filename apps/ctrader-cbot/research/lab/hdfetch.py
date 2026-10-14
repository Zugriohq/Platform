"""HistData.com free 1-minute bars (one zip per month) -> one compact file per instrument.

python3 -I hdfetch.py <out_dir> <from YYYY-MM> <to YYYY-MM> SYMBOL [SYMBOL...]     (e.g. XAUUSD EURUSD SPXUSD)

Zips are cached in <out_dir>/raw/<SYM>/<YYYYMM>.zip (resumable). Output <out_dir>/<SYM>.m1: little-endian float64 rows
epoch_seconds (UTC, bar open), open, high, low, close.
Time zone: the files are documented as EST without daylight saving, but the 2025-09-05 payrolls spike (08:30 New York,
EDT) sits at 08:30 in the file, so file times are read as New York local time WITH daylight saving (checked on
gold and EURUSD around the payrolls minute; see README round 6).
"""
import io, os, re, struct, sys, time, urllib.parse, urllib.request, zipfile
from http.cookiejar import CookieJar
from datetime import datetime, timedelta, timezone

UA = {"User-Agent": "Mozilla/5.0"}


def ny_to_utc(dt):
    """New York wall time -> UTC (US rules since 2007: second Sunday of March to first Sunday of November)."""
    def nth_sunday(y, m, n):
        d = datetime(y, m, 1)
        return d + timedelta(days=(6 - d.weekday()) % 7 + 7 * (n - 1))
    start, end = nth_sunday(dt.year, 3, 2).replace(hour=2), nth_sunday(dt.year, 11, 1).replace(hour=2)
    return (dt + timedelta(hours=4 if start <= dt < end else 5)).replace(tzinfo=timezone.utc)


def fetch_month(sym, y, m):
    """One month's zip; m=None fetches the whole-year zip (HistData serves older years as one file)."""
    page = f"https://www.histdata.com/download-free-forex-historical-data/?/ascii/1-minute-bar-quotes/{sym.lower()}/{y}" + (f"/{m}" if m else "")
    op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(CookieJar()))
    for k in range(6):
        try:
            html = op.open(urllib.request.Request(page, headers=UA), timeout=60).read().decode("utf-8", "replace")
            tk = re.search(r'name="tk" id="tk" value="([a-f0-9]+)"', html)
            if not tk:
                return b""
            body = urllib.parse.urlencode({"tk": tk.group(1), "date": str(y), "datemonth": f"{y}{m:02d}" if m else str(y), "platform": "ASCII", "timeframe": "M1", "fxpair": sym}).encode()
            z = op.open(urllib.request.Request("https://www.histdata.com/get.php", data=body, headers={**UA, "Referer": page}), timeout=120).read()
            if z[:2] == b"PK":
                return z
        except Exception:
            pass
        time.sleep(10 * (k + 1))
    raise RuntimeError(f"failed {sym} {y}-{m}")


def main():
    out, a, b, syms = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4:]
    y0, m0 = map(int, a.split("-")); y1, m1 = map(int, b.split("-"))
    for s in syms:
        raw = os.path.join(out, "raw", s); os.makedirs(raw, exist_ok=True)
        rows, y, m = [], y0, m0
        while (y, m) <= (y1, m1):
            p = os.path.join(raw, f"{y}{m:02d}.zip")
            if not os.path.exists(p):
                open(p, "wb").write(fetch_month(s, y, m)); time.sleep(2)
            data = open(p, "rb").read()
            if not data:
                py = os.path.join(raw, f"{y}.zip")
                if not os.path.exists(py):
                    open(py, "wb").write(fetch_month(s, y, None)); time.sleep(2)
                data, month_only = open(py, "rb").read(), f"{y}{m:02d}"
            else:
                month_only = None
            if data:
                zf = zipfile.ZipFile(io.BytesIO(data))
                name = next(n for n in zf.namelist() if n.endswith(".csv"))
                for line in zf.read(name).decode().splitlines():
                    f = line.split(";")
                    if len(f) < 5 or (month_only and not f[0].startswith(month_only)):
                        continue
                    t = ny_to_utc(datetime.strptime(f[0], "%Y%m%d %H%M%S")).timestamp()
                    rows.append((t, float(f[1]), float(f[2]), float(f[3]), float(f[4])))
            m += 1
            if m == 13:
                y, m = y + 1, 1
        rows.sort()
        with open(os.path.join(out, f"{s}.m1"), "wb") as fo:
            for r in rows:
                fo.write(struct.pack("<5d", *r))
        print(s, len(rows), "bars", datetime.fromtimestamp(rows[0][0], timezone.utc) if rows else "", "->", datetime.fromtimestamp(rows[-1][0], timezone.utc) if rows else "", flush=True)


if __name__ == "__main__":
    main()
