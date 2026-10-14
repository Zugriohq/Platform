// C2 as the EA would run it: weekly decision at the Sunday close, position = sign of the 4-week return, held while the
// signal holds (a flip reverses), protective stop at 3 weekly sigmas (checked on daily closes), 0.2% per change,
// financing 10%/yr. Weekly R as in the registered test.
import fs from "fs";
const SPLIT = Date.UTC(2022, 0, 1) / 1000, END = Date.UTC(2026, 9, 1) / 1000;
for (const stopK of [0, 3, 2]) {
  const all = [];
  for (const s of ["BTCUSDT", "ETHUSDT"]) {
    const rows = JSON.parse(fs.readFileSync(`${s}.json`, "utf8"));
    const ends = []; for (let i = 1; i < rows.length; i++) if (new Date(rows[i][0] * 1000).getUTCDay() === 1) ends.push(i - 1);
    let prev = 0, stops = 0;
    for (let k = 4; k + 1 < ends.length; k++) {
      const i = ends[k], j = ends[k + 1]; if (rows[j][0] > END) break;
      const pos = Math.sign(rows[i][1] - rows[ends[k - 4]][1]);
      let s2 = 0; for (let m = Math.max(1, i - 59); m <= i; m++) s2 += Math.log(rows[m][1] / rows[m - 1][1]) ** 2;
      const sigW = Math.sqrt(s2 / 60) * Math.sqrt(7), entry = rows[i][1];
      let exit = rows[j][1], stopped = false;
      if (stopK && pos !== 0) for (let m = i + 1; m <= j; m++) if (pos * (rows[m][1] / entry - 1) <= -stopK * sigW) { exit = rows[m][1]; stopped = true; stops++; break; }
      const cost = 0.002 * Math.abs(pos - prev) + (stopped ? 0.002 : 0) + 0.10 * Math.abs(pos) * 7 / 365; prev = stopped ? 0 : pos;
      all.push({ t: rows[i][0], r: (pos * (exit / entry - 1) - cost) / sigW });
    }
  }
  const st = (v) => { const n = v.length, m = v.reduce((a, x) => a + x, 0) / n, sd = Math.sqrt(v.reduce((a, x) => a + (x - m) ** 2, 0) / (n - 1)); return `${m >= 0 ? "+" : ""}${m.toFixed(3)}R t ${(m / (sd / Math.sqrt(n))).toFixed(1)}`; };
  console.log(`stop ${stopK ? stopK + " weekly sigma" : "none"}: all ${st(all.map((x) => x.r))}, 2017-21 ${st(all.filter((x) => x.t < SPLIT).map((x) => x.r))}, 2022-26 ${st(all.filter((x) => x.t >= SPLIT).map((x) => x.r))}`);
}
