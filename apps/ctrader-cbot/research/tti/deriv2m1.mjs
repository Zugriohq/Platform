// Converts jump-history.html's download (symbol,epoch,open,high,low,close; .csv or .csv.gz) into one .m1 file per
// index in hdfetch.py's format (float64 rows: epoch, o, h, l, c), named by TTI key: J10.m1 ... J100.m1.
// node deriv2m1.mjs <download.csv[.gz]> <out dir>
import fs from "fs";
import zlib from "zlib";

const KEY = { JD10: "J10", JD25: "J25", JD50: "J50", JD75: "J75", JD100: "J100" };

export function parse(text) {
  const by = {};
  for (const line of text.split(/\r?\n/)) {
    const p = line.split(","); if (p.length !== 6 || !KEY[p[0]]) continue;
    const row = p.slice(1).map(Number); if (row.some((x) => !Number.isFinite(x))) continue;
    (by[KEY[p[0]]] ??= new Map()).set(row[0], row);
  }
  const out = {};
  for (const [k, m] of Object.entries(by)) out[k] = [...m.values()].sort((a, b) => a[0] - b[0]);
  return out;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  const [src, dir] = process.argv.slice(2);
  let buf = fs.readFileSync(src); if (buf[0] === 0x1f && buf[1] === 0x8b) buf = zlib.gunzipSync(buf);
  fs.mkdirSync(dir, { recursive: true });
  for (const [k, rows] of Object.entries(parse(buf.toString("utf8")))) {
    const f = new Float64Array(rows.length * 5); rows.forEach((r, i) => f.set(r, 5 * i));
    fs.writeFileSync(`${dir}/${k}.m1`, Buffer.from(f.buffer));
    console.log(`${k}: ${rows.length} M1 bars, ${new Date(rows[0][0] * 1000).toISOString().slice(0, 16)} to ${new Date(rows[rows.length - 1][0] * 1000).toISOString().slice(0, 16)} UTC`);
  }
}
