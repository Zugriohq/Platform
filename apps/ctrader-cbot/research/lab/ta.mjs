// Zugrio technical-analysis detectors (research). Causal by construction: every fact carries knownAt, the close
// time of the last bar it depends on, and queries take an "as of" time and only see facts with knownAt <= asOf.
// Follows docs/product/ZUGRIO_STRUCTURAL_BREAK_CLASSIFICATION_CONTRACT.md and ZUGRIO_CONTEXTUAL_PATTERN_ONTOLOGY.md:
// neutral breaks first, then a profile classifies them (BOS / CHoCH / MSS); morphology is not interpretation.
// Bars: { t: open ms, o, h, l, c, closedAt: close ms }, ascending, one timeframe per array.

export const LEN = { M5: 5, M15: 15, H1: 60, H4: 240, D1: 1440 };

/** Aggregate bars into a longer timeframe on UTC boundaries (W1 starts Monday 00:00 UTC, MN on the 1st). */
export function aggregate(bars, tf) {
  const key = (t) => {
    if (tf === "W1") { const d = new Date(t); const day = (d.getUTCDay() + 6) % 7; return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day); }
    if (tf === "MN") { const d = new Date(t); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1); }
    const m = LEN[tf] * 60000; return Math.floor(t / m) * m;
  };
  const end = (k) => {
    if (tf === "W1") return k + 7 * 86400000;
    if (tf === "MN") { const d = new Date(k); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1); }
    return k + LEN[tf] * 60000;
  };
  const out = []; let cur = null;
  for (const b of bars) {
    const k = key(b.t);
    if (!cur || cur.t !== k) { if (cur) out.push(cur); cur = { t: k, o: b.o, h: b.h, l: b.l, c: b.c, closedAt: end(k), lastBarClose: b.closedAt }; }
    else { cur.h = Math.max(cur.h, b.h); cur.l = Math.min(cur.l, b.l); cur.c = b.c; cur.lastBarClose = b.closedAt; }
  }
  if (cur) out.push(cur);
  return out;
}

/** Index of the last bar with closedAt <= t, or -1. */
export function lastClosed(bars, t) {
  let lo = 0, hi = bars.length - 1, r = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (bars[m].closedAt <= t) { r = m; lo = m + 1; } else hi = m - 1; }
  return r;
}

/** Wilder-free simple ATR: mean true range of the n bars ending at index i (needs i >= n). */
export function atrAt(bars, i, n = 14) {
  if (i < n) return NaN;
  let s = 0;
  for (let k = i - n + 1; k <= i; k++) { const b = bars[k], pc = bars[k - 1].c; s += Math.max(b.h - b.l, Math.abs(b.h - pc), Math.abs(b.l - pc)); }
  return s / n;
}

/**
 * Fractal swing points of strength k: a high strictly above the k bars before it and at or above the k bars
 * after it (lows mirrored). Confirmed, and so knowable, only when the k-th bar after it has closed.
 */
export function swings(bars, k) {
  const out = [];
  for (let i = k; i < bars.length - k; i++) {
    let hi = true, lo = true;
    for (let j = 1; j <= k; j++) {
      if (!(bars[i].h > bars[i - j].h) || !(bars[i].h >= bars[i + j].h)) hi = false;
      if (!(bars[i].l < bars[i - j].l) || !(bars[i].l <= bars[i + j].l)) lo = false;
    }
    if (hi) out.push({ type: "H", i, price: bars[i].h, t: bars[i].t, knownAt: bars[i + k].closedAt });
    if (lo) out.push({ type: "L", i, price: bars[i].l, t: bars[i].t, knownAt: bars[i + k].closedAt });
  }
  return out.sort((a, b) => a.knownAt - b.knownAt || a.i - b.i);
}

/**
 * Market structure from confirmed swings (contract: neutral break, then classification).
 * A close beyond the latest unconsumed confirmed swing high (low) is a neutral UP (DOWN) break; the swing is then
 * CONSUMED and cannot break again. Classification by relation to the bias known before the break:
 * continuation = BOS, opposition = CHoCH; an opposition break whose bar is a displacement in the same direction
 * (body >= dispAtr x ATR and close in the outer 25% of the bar) is also MSS.
 * Returns breaks [{ t: break bar close, dir, kind, mss, level, swing, barIndex }] and a bias timeline.
 */
export function structure(bars, k, { dispAtr = 0.7, atrN = 14 } = {}) {
  const sw = swings(bars, k); let si = 0;
  let activeH = null, activeL = null, bias = "NEUTRAL";
  const breaks = [], timeline = [];   // timeline: { t, bias } at each change
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    // Swings confirmed by an earlier close become active before this bar is judged (a level must be known before the break bar closes).
    while (si < sw.length && sw[si].knownAt < b.closedAt) { const s = sw[si++]; if (s.type === "H") activeH = s; else activeL = s; }
    for (const [lvl, dir] of [[activeH, "UP"], [activeL, "DOWN"]]) {
      if (!lvl) continue;
      const beyond = dir === "UP" ? b.c > lvl.price : b.c < lvl.price;
      if (!beyond) continue;
      const relation = bias === "NEUTRAL" ? "neutral" : (bias === "BULL") === (dir === "UP") ? "continuation" : "opposition";
      const a = atrAt(bars, i, atrN), body = Math.abs(b.c - b.o), range = b.h - b.l;
      const outer = range > 0 && (dir === "UP" ? (b.c - b.l) / range >= 0.75 : (b.h - b.c) / range >= 0.75);
      const displacement = a > 0 && body >= dispAtr * a && outer && (dir === "UP" ? b.c > b.o : b.c < b.o);
      const kind = relation === "continuation" ? "BOS" : relation === "opposition" ? "CHoCH" : "INITIAL";
      breaks.push({ t: b.closedAt, dir, kind, mss: relation === "opposition" && displacement, displacement, level: lvl.price, swing: lvl, barIndex: i });
      const nb = dir === "UP" ? "BULL" : "BEAR";
      if (nb !== bias) { bias = nb; timeline.push({ t: b.closedAt, bias }); }
      if (dir === "UP") activeH = null; else activeL = null;   // consumed
    }
  }
  return { swings: sw, breaks, timeline };
}

/** Bias of a structure timeline as of time t. */
export function biasAt(st, t) {
  let lo = 0, hi = st.timeline.length - 1, r = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (st.timeline[m].t <= t) { r = m; lo = m + 1; } else hi = m - 1; }
  return r < 0 ? "NEUTRAL" : st.timeline[r].bias;
}

/** Latest confirmed swing high and low as of t (the dealing range), and price's position in it (0 = low, 1 = high). */
export function dealingRange(st, t, price) {
  let h = null, l = null;
  for (const s of st.swings) { if (s.knownAt > t) break; if (s.type === "H") h = s; else l = s; }
  if (!h || !l || !(h.price > l.price)) return { high: h?.price ?? NaN, low: l?.price ?? NaN, pos: NaN };
  return { high: h.price, low: l.price, pos: (price - l.price) / (h.price - l.price) };
}

/** Three-bar fair value gap whose third bar is bars[i]: bullish if bars[i-2].h < bars[i].l, bearish if bars[i-2].l > bars[i].h. */
export function fvgAt(bars, i) {
  if (i < 2) return null;
  const a = bars[i - 2], c = bars[i];
  if (a.h < c.l) return { dir: "UP", top: c.l, bottom: a.h };
  if (a.l > c.h) return { dir: "DOWN", top: a.l, bottom: c.h };
  return null;
}

/**
 * Candlestick morphology of bars[i] (MORPHOLOGY_ONLY facts: they say what the candle is, not what it means).
 * Ratios are fixed definitions so results are reproducible.
 */
export function candles(bars, i) {
  const b = bars[i], p = bars[i - 1], q = bars[i - 2], out = [];
  const range = b.h - b.l; if (!(range > 0)) return out;
  const body = Math.abs(b.c - b.o), up = b.h - Math.max(b.o, b.c), dn = Math.min(b.o, b.c) - b.l;
  if (body <= 0.1 * range) out.push("DOJI");
  if (dn >= 2 * body && dn >= 0.6 * range && up <= 0.15 * range) out.push("HAMMER");          // long lower wick, close near high
  if (up >= 2 * body && up >= 0.6 * range && dn <= 0.15 * range) out.push("SHOOTING_STAR");
  if (p) {
    const pb = Math.abs(p.c - p.o);
    if (b.c > b.o && p.c < p.o && b.c >= p.o && b.o <= p.c && body > pb) out.push("BULLISH_ENGULFING");
    if (b.c < b.o && p.c > p.o && b.c <= p.o && b.o >= p.c && body > pb) out.push("BEARISH_ENGULFING");
    if (b.h <= p.h && b.l >= p.l) out.push("INSIDE_BAR");
    if (b.h > p.h && b.l < p.l) out.push("OUTSIDE_BAR");
    if (q) {
      const qb = Math.abs(q.c - q.o), qr = q.h - q.l, pr = p.h - p.l;
      // Star: long first candle, small middle candle, third closes past the first candle's midpoint.
      if (q.c < q.o && qb >= 0.6 * qr && pb <= 0.3 * pr && b.c > b.o && b.c > (q.o + q.c) / 2) out.push("MORNING_STAR");
      if (q.c > q.o && qb >= 0.6 * qr && pb <= 0.3 * pr && b.c < b.o && b.c < (q.o + q.c) / 2) out.push("EVENING_STAR");
      if ([q, p, b].every((x) => x.c > x.o && Math.abs(x.c - x.o) >= 0.5 * (x.h - x.l)) && p.c > q.c && b.c > p.c) out.push("THREE_WHITE_SOLDIERS");
      if ([q, p, b].every((x) => x.c < x.o && Math.abs(x.c - x.o) >= 0.5 * (x.h - x.l)) && p.c < q.c && b.c < p.c) out.push("THREE_BLACK_CROWS");
    }
  }
  return out;
}

/**
 * Liquidity levels knowable at time t, from H1 bars and H1 swings: previous UTC day high/low (PDH/PDL),
 * previous week high/low (PWH/PWL), today's Asia range (00:00-07:00 UTC, only once closed), the latest
 * unswept external swing highs/lows, and equal highs/lows (two swings within tol). Each { price, side: "H"|"L", kind }.
 */
export function liquidityLevels(h1, h1Swings, t, { tol, maxSwings = 4, swingBars = h1 }) {
  const out = []; const day = Math.floor(t / 86400000) * 86400000;
  const i = lastClosed(h1, t); if (i < 0) return out;
  let pdH = -Infinity, pdL = Infinity, asH = -Infinity, asL = Infinity, any = false, asia = false;
  const d = new Date(day), wd = (d.getUTCDay() + 6) % 7, week = day - wd * 86400000;
  let pwH = -Infinity, pwL = Infinity;
  for (let k = i; k >= 0 && h1[k].t >= week - 7 * 86400000 - 3 * 86400000; k--) {
    const b = h1[k];
    if (b.t >= day - 86400000 && b.t < day) { pdH = Math.max(pdH, b.h); pdL = Math.min(pdL, b.l); any = true; }
    if (b.t >= day && b.t < day + 7 * 3600000 && b.closedAt <= t) { asH = Math.max(asH, b.h); asL = Math.min(asL, b.l); }
    if (b.t >= week - 7 * 86400000 && b.t < week) { pwH = Math.max(pwH, b.h); pwL = Math.min(pwL, b.l); }
  }
  if (t >= day + 7 * 3600000 && asH > -Infinity) asia = true;
  if (any) out.push({ price: pdH, side: "H", kind: "PDH" }, { price: pdL, side: "L", kind: "PDL" });
  if (pwH > -Infinity) out.push({ price: pwH, side: "H", kind: "PWH" }, { price: pwL, side: "L", kind: "PWL" });
  if (asia) out.push({ price: asH, side: "H", kind: "ASIA_H" }, { price: asL, side: "L", kind: "ASIA_L" });
  // External swings still unswept as of t (no H1 close beyond them yet), the most recent first.
  // Swings come from swingBars (their own timeframe); a swing is swept once any later bar of that timeframe trades beyond it.
  const known = h1Swings.filter((s) => s.knownAt <= t), si = lastClosed(swingBars, t);
  const unswept = (s) => { for (let k = s.i + 1; k <= si; k++) if (s.type === "H" ? swingBars[k].h > s.price : swingBars[k].l < s.price) return false; return true; };
  const highs = [], lows = [];
  for (let k = known.length - 1; k >= 0 && (highs.length < maxSwings || lows.length < maxSwings); k--) {
    const s = known[k]; if (!unswept(s)) continue;
    if (s.type === "H" && highs.length < maxSwings) highs.push(s); if (s.type === "L" && lows.length < maxSwings) lows.push(s);
  }
  for (const s of highs) out.push({ price: s.price, side: "H", kind: "SWING_H" });
  for (const s of lows) out.push({ price: s.price, side: "L", kind: "SWING_L" });
  for (const [arr, side] of [[highs, "H"], [lows, "L"]])
    for (let a = 0; a < arr.length; a++) for (let b = a + 1; b < arr.length; b++)
      if (Math.abs(arr[a].price - arr[b].price) <= tol) out.push({ price: side === "H" ? Math.max(arr[a].price, arr[b].price) : Math.min(arr[a].price, arr[b].price), side, kind: side === "H" ? "EQUAL_HIGHS" : "EQUAL_LOWS" });
  return out;
}
