/* TTI exit study (measurement only). It never changes a signal, a level or the app's own outcome.
   For every signal TTI fires it fetches Deriv's ticks for the two hours after the signal and replays several
   exit plans on the same entry, stop and target, tick by tick:
   - R is measured from the price at the signal (what a trader following it gets);
   - a stop fills at the first tick at or beyond it (gaps make it worse than -1R);
   - a target fills at the target.
   Results stay in this browser (localStorage "tti_exit_study_v1"). */
(function (root) {
  "use strict";
  var HORIZON_S = 7200; // the app's own TIMEOUT: 2 hours

  // Each plan: tp(tA) = target in R given the app's target tA (in R); optional break-even, half exit, trail.
  var PLANS = [
    { id: "A", name: "As now: app target", tp: function (tA) { return tA; } },
    { id: "B", name: "Fixed target 0.8R", tp: function () { return 0.8; } },
    { id: "C", name: "Target 15% in front of the level", tp: function (tA) { return 0.85 * tA; } },
    { id: "D", name: "Break-even at 0.7R, app target", tp: function (tA) { return tA; }, beR: 0.7, beLock: 0.05 },
    { id: "E", name: "Half off at 0.8R, rest break-even, app target", tp: function (tA) { return tA; }, halfR: 0.8, beLock: 0.05 },
    { id: "F", name: "From 0.8R trail 0.5R behind best, app target", tp: function (tA) { return tA; }, trailStart: 0.8, trailR: 0.5 }
  ];

  // xs: progress of each tick after the signal, in R (+ toward the target). Returns the plan's R.
  function runPlan(xs, tA, plan) {
    var tp = plan.tp(tA), stop = -1, w = 1, got = 0, best = -Infinity, half = false;
    for (var i = 0; i < xs.length; i++) {
      var x = xs[i];
      if (x <= stop) return { r: got + w * x, exit: stop > -1 ? "PROTECTED" : "STOP", i: i };
      if (x > best) best = x;
      if (plan.halfR && !half && x >= plan.halfR) { got += 0.5 * plan.halfR; w = 0.5; half = true; stop = Math.max(stop, plan.beLock); }
      if (plan.beR && x >= plan.beR) stop = Math.max(stop, plan.beLock);
      if (plan.trailStart && best >= plan.trailStart) stop = Math.max(stop, best - plan.trailR);
      if (x >= tp) return { r: got + w * tp, exit: "TARGET", i: i };
    }
    return { r: got + w * (xs.length ? xs[xs.length - 1] : 0), exit: "TIMEOUT", i: xs.length - 1 };
  }

  // sig: {dir:"BUY"|"SELL", price, stop, target, firedAt(ms)}; ticks: [{t(sec), p}] in time order.
  function evaluate(sig, ticks) {
    var d = sig.dir === "BUY" ? 1 : sig.dir === "SELL" ? -1 : 0, E = +sig.price, risk = d * (E - +sig.stop);
    if (!d || !(risk > 0)) return { skip: "stop not on the losing side of the signal price" };
    var tA = d * (+sig.target - E) / risk;
    if (!(tA > 0.05)) return { skip: "price already at or past the target when the signal fired" };
    var t0 = sig.firedAt / 1000, xs = [], ts = [];
    for (var i = 0; i < ticks.length; i++) {
      if (ticks[i].t <= t0 || ticks[i].t > t0 + HORIZON_S) continue;
      xs.push(d * (ticks[i].p - E) / risk); ts.push(ticks[i].t);
    }
    if (xs.length < 2) return { skip: "no ticks after the signal" };
    // Excursions while the plan-A trade is alive (before its stop or the horizon; MFE counts past the target too).
    var mfe = -Infinity, tMfe = 0, mae = 0, stopAt = xs.length;
    for (var j = 0; j < xs.length; j++) {
      if (xs[j] <= -1) { stopAt = j; break; }
      if (xs[j] > mfe) { mfe = xs[j]; tMfe = ts[j] - t0; }
      if (xs[j] < mae) mae = xs[j];
    }
    var out = { tA: tA, riskPx: risk, mfe: mfe === -Infinity ? 0 : mfe, minsToMfe: tMfe / 60, mae: mae, stopped: stopAt < xs.length, ticks: xs.length, plans: {} };
    for (var k = 0; k < PLANS.length; k++) { var p = runPlan(xs, tA, PLANS[k]); out.plans[PLANS[k].id] = { r: p.r, exit: p.exit, mins: (ts[p.i] - t0) / 60 }; }
    out.touchedTargetBeforeStop = out.plans.A.exit === "TARGET";
    return out;
  }

  function stats(v) {
    var n = v.length; if (!n) return { n: 0, avg: 0, se: 0, t: 0, sum: 0 };
    var s = 0; for (var i = 0; i < n; i++) s += v[i];
    var m = s / n, q = 0; for (var j = 0; j < n; j++) q += (v[j] - m) * (v[j] - m);
    var se = n > 1 ? Math.sqrt(q / (n - 1) / n) : 0;
    return { n: n, avg: m, se: se, t: se > 0 ? m / se : 0, sum: s };
  }

  function summarise(rows, splitMs) {
    var done = rows.filter(function (r) { return r.res && !r.res.skip; });
    function block(list) {
      var o = { n: list.length, plans: {}, reach: {} };
      [0.5, 0.8, 1.0].forEach(function (lv) { o.reach[lv] = list.filter(function (r) { return r.res.mfe >= lv; }).length; });
      o.reach.target = list.filter(function (r) { return r.res.touchedTargetBeforeStop; }).length;
      var losersA = list.filter(function (r) { return r.res.plans.A.r < 0; });
      o.losersA = losersA.length;
      o.losersAfter08 = losersA.filter(function (r) { return r.res.mfe >= 0.8; }).length;
      o.losersAfter05 = losersA.filter(function (r) { return r.res.mfe >= 0.5; }).length;
      var mf = list.map(function (r) { return r.res.mfe; }).sort(function (a, b) { return a - b; });
      o.medianMfe = mf.length ? mf[Math.floor(mf.length / 2)] : 0;
      var ta = list.map(function (r) { return r.res.tA; }).sort(function (a, b) { return a - b; });
      o.medianTargetR = ta.length ? ta[Math.floor(ta.length / 2)] : 0;
      PLANS.forEach(function (p) {
        var v = list.map(function (r) { return r.res.plans[p.id].r; });
        var diff = list.map(function (r) { return r.res.plans[p.id].r - r.res.plans.A.r; });
        var s = stats(v);
        s.wins = v.filter(function (x) { return x > 0; }).length;
        s.vsA = stats(diff);
        o.plans[p.id] = s;
      });
      // The app's own record (30-second price checks) against the tick replay of the same levels.
      o.appLossTickWin = list.filter(function (r) { return r.appOutcome && r.appOutcome !== "WIN" && r.res.touchedTargetBeforeStop; }).length;
      o.appWinTickLoss = list.filter(function (r) { return r.appOutcome === "WIN" && !r.res.touchedTargetBeforeStop; }).length;
      return o;
    }
    return {
      all: block(done),
      design: block(done.filter(function (r) { return r.firedAt < splitMs; })),
      test: block(done.filter(function (r) { return r.firedAt >= splitMs; })),
      pending: rows.filter(function (r) { return !r.res; }).length,
      skipped: rows.filter(function (r) { return r.res && r.res.skip; }).length
    };
  }

  var core = { PLANS: PLANS, HORIZON_S: HORIZON_S, runPlan: runPlan, evaluate: evaluate, stats: stats, summarise: summarise };
  if (typeof module !== "undefined" && module.exports) module.exports = core;
  root.TTIStudyCore = core;
})(typeof window !== "undefined" ? window : globalThis);

/* Browser part: collect signals from TTI's log, fetch ticks, show and export the results. */
(function () {
  "use strict";
  if (typeof window === "undefined" || typeof document === "undefined") return;
  var C = window.TTIStudyCore, KEY = "tti_exit_study_v1", EP = "wss://ws.derivws.com/websockets/v3?app_id=1089";
  var st = load();
  function load() {
    try { var s = JSON.parse(localStorage.getItem(KEY) || "null"); if (s && s.rows) return s; } catch (e) {}
    return { installedAt: Date.now(), rows: {} };
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }

  // Copy each fired signal's levels the first time it is seen (the app keeps only its last 100).
  function collect() {
    var log; try { log = histLog; } catch (e) { return; }
    for (var i = 0; i < log.length; i++) {
      var s = log[i], lv = s && s.lvls;
      if (!s || !s.id || !lv || !lv.stop || !lv.target || !s.firedAt) continue;
      var inst = typeof gI === "function" ? gI(s.k) : null;
      var row = st.rows[s.id];
      if (!row) {
        row = st.rows[s.id] = { id: s.id, k: s.k, sym: inst ? inst.s : s.k, name: inst ? inst.sh : s.k, dir: s.sig, firedAt: s.firedAt,
          price: +s.price, stop: +lv.stop, target: +lv.target, setup: lv.setupType || "", regime: s.regime || "", pWin: s.pWin, res: null,
          // Seen long after it fired: the app may since have refreshed its price and levels from a repeat signal.
          backfill: Date.now() - s.firedAt > 3 * 60 * 1000 };
      }
      row.appOutcome = s.outcome;
    }
    save();
  }

  var sock = null, busy = false, waiting = {}, nextId = 1;
  function ask(req) {
    return new Promise(function (resolve, reject) {
      function send() { var id = nextId++; req.req_id = id; waiting[id] = { resolve: resolve, reject: reject }; sock.send(JSON.stringify(req)); setTimeout(function () { if (waiting[id]) { delete waiting[id]; reject(new Error("timeout")); } }, 20000); }
      if (sock && sock.readyState === 1) return send();
      sock = new WebSocket(EP);
      sock.onopen = send;
      sock.onmessage = function (m) { var d; try { d = JSON.parse(m.data); } catch (e) { return; } var w = waiting[d.req_id]; if (!w) return; delete waiting[d.req_id]; d.error ? w.reject(new Error(d.error.message || d.error.code)) : w.resolve(d); };
      sock.onerror = function () { reject(new Error("connection failed")); };
      sock.onclose = function () { sock = null; };
    });
  }
  // All ticks between two times; a window that hits the 5,000-tick cap is split in two.
  function ticks(sym, s, e) {
    return ask({ ticks_history: sym, start: s, end: e, style: "ticks", count: 5000 }).then(function (d) {
      var h = d.history || {}, ps = h.prices || [], ts = h.times || [];
      if (ps.length >= 5000 && e - s > 60) { var mid = Math.floor((s + e) / 2); return ticks(sym, s, mid).then(function (a) { return ticks(sym, mid + 1, e).then(function (b) { return a.concat(b); }); }); }
      var out = []; for (var i = 0; i < ps.length; i++) out.push({ t: +ts[i], p: +ps[i] }); return out;
    });
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  async function work() {
    if (busy) return; busy = true;
    try {
      collect();
      var now = Date.now() / 1000, todo = Object.keys(st.rows).map(function (k) { return st.rows[k]; })
        .filter(function (r) { return !r.res && r.firedAt / 1000 + C.HORIZON_S < now - 30; });
      for (var i = 0; i < todo.length; i++) {
        var r = todo[i], t0 = Math.floor(r.firedAt / 1000), all = [];
        try {
          for (var s = t0; s < t0 + C.HORIZON_S; s += 1800) { all = all.concat(await ticks(r.sym, s, Math.min(s + 1799, t0 + C.HORIZON_S))); await sleep(350); }
          // Entry = the market at the signal time. A backfilled row whose stored price is far from it carries
          // levels from a later repeat signal, so it is left out rather than measured against the wrong levels.
          var first = all.find(function (x) { return x.t >= t0; });
          if (!first) { r.res = { skip: "no ticks after the signal" }; }
          else {
            var d = r.dir === "BUY" ? 1 : -1, risk = Math.abs(r.price - r.stop), drift = risk > 0 ? d * (first.p - r.price) / risk : 0;
            r.entryTick = first.p; r.drift = drift;
            r.res = r.backfill && Math.abs(drift) > 0.3 ? { skip: "stored levels look refreshed by a later repeat signal (" + drift.toFixed(2) + "R from the signal-time price)" }
              : C.evaluate({ dir: r.dir, price: first.p, stop: r.stop, target: r.target, firedAt: first.t * 1000 - 1 }, all);
          }
        } catch (e) { r.err = String(e.message || e); if (/market|symbol|invalid/i.test(r.err)) r.res = { skip: r.err }; }
        save(); setStatus("Measured " + (i + 1) + " of " + todo.length);
      }
    } finally { busy = false; render(); }
  }

  function f(x, n) { return (x >= 0 ? "+" : "") + x.toFixed(n == null ? 2 : n); }
  function pct(a, b) { return b ? Math.round(100 * a / b) + "%" : "-"; }
  function summaryText() {
    var rows = Object.keys(st.rows).map(function (k) { return st.rows[k]; });
    var S = C.summarise(rows, st.installedAt), L = [];
    L.push("TTI exit study (TTI " + (typeof TTI_VERSION !== "undefined" ? TTI_VERSION : "?") + ", study 1) " + new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC");
    L.push("Signals measured " + S.all.n + " | waiting for 2h " + S.pending + " | skipped " + S.skipped + " | design = before " + new Date(st.installedAt).toISOString().slice(0, 10) + ", test = after");
    [["ALL", S.all], ["DESIGN", S.design], ["TEST", S.test]].forEach(function (b) {
      var o = b[1]; if (!o.n) { L.push(b[0] + ": none yet"); return; }
      L.push(""); L.push(b[0] + " n=" + o.n + " | median target " + o.medianTargetR.toFixed(2) + "R | median best excursion " + o.medianMfe.toFixed(2) + "R");
      L.push("Reached before the stop: 0.5R " + pct(o.reach[0.5], o.n) + ", 0.8R " + pct(o.reach[0.8], o.n) + ", 1.0R " + pct(o.reach[1.0], o.n) + ", app target " + pct(o.reach.target, o.n));
      L.push("Plan-A losers " + o.losersA + ": had been +0.5R first " + o.losersAfter05 + ", +0.8R first " + o.losersAfter08);
      L.push("App record vs tick replay: app non-win but target touched " + o.appLossTickWin + "; app win but not touched " + o.appWinTickLoss);
      C.PLANS.forEach(function (p) {
        var s = o.plans[p.id];
        L.push(p.id + " " + p.name + ": win " + pct(s.wins, s.n) + " avg " + f(s.avg) + "R (t " + s.t.toFixed(1) + ") total " + f(s.sum, 1) + "R" + (p.id === "A" ? "" : " | vs A " + f(s.vsA.avg) + "R/trade (t " + s.vsA.t.toFixed(1) + ")"));
      });
    });
    return L.join("\n");
  }
  function csv() {
    var h = ["fired_at", "market", "direction", "setup", "regime", "p_win", "price", "stop", "target", "app_outcome", "target_R", "best_R", "worst_R", "mins_to_best"].concat(C.PLANS.map(function (p) { return "plan_" + p.id + "_R"; })).concat(["skip"]);
    var lines = [h.join(",")];
    Object.keys(st.rows).forEach(function (k) {
      var r = st.rows[k], s = r.res || {}, ok = s && !s.skip && s.plans;
      lines.push([new Date(r.firedAt).toISOString(), r.name, r.dir, r.setup, r.regime, r.pWin != null ? (100 * r.pWin).toFixed(1) : "", r.price, r.stop, r.target, r.appOutcome || "",
        ok ? s.tA.toFixed(3) : "", ok ? s.mfe.toFixed(3) : "", ok ? s.mae.toFixed(3) : "", ok ? s.minsToMfe.toFixed(1) : ""]
        .concat(C.PLANS.map(function (p) { return ok ? s.plans[p.id].r.toFixed(3) : ""; })).concat([s.skip ? '"' + String(s.skip).replace(/"/g, "'") + '"' : (r.res ? "" : "pending")]).join(","));
    });
    return lines.join("\n");
  }

  var panel, statusEl, pre;
  function setStatus(t) { if (statusEl) statusEl.textContent = t; }
  function render() { if (pre && panel && panel.style.display !== "none") pre.textContent = summaryText(); setStatus(busy ? "Measuring…" : "Up to date"); }
  function btn(label, fn) { var b = document.createElement("button"); b.textContent = label; b.onclick = fn; b.style.cssText = "font:600 13px var(--sans);padding:8px 12px;border-radius:8px;border:1px solid var(--border2);background:var(--bg2);color:var(--t1);"; return b; }
  function ui() {
    var open = document.createElement("button");
    open.textContent = "Exit study";
    open.style.cssText = "position:fixed;right:12px;bottom:84px;z-index:9998;font:600 12px var(--sans);padding:7px 12px;border-radius:999px;border:1px solid var(--border2);background:var(--bg1);color:var(--t1);box-shadow:var(--shadow-md);";
    panel = document.createElement("div");
    panel.style.cssText = "display:none;position:fixed;inset:0;z-index:9999;background:var(--bg);color:var(--t1);padding:16px;overflow:auto;";
    var bar = document.createElement("div"); bar.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px;";
    var title = document.createElement("b"); title.textContent = "Exit study"; title.style.cssText = "font:700 16px var(--sans);margin-right:auto;";
    statusEl = document.createElement("span"); statusEl.style.cssText = "font:12px var(--mono);color:var(--t3);width:100%;";
    bar.append(title,
      btn("Copy summary", function () { var t = summaryText(); navigator.clipboard ? navigator.clipboard.writeText(t).then(function () { setStatus("Summary copied"); }) : setStatus("Copy not available"); }),
      btn("Export CSV", function () { var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv()], { type: "text/csv" })); a.download = "tti_exit_study.csv"; document.body.appendChild(a); a.click(); a.remove(); }),
      btn("Measure now", function () { work(); render(); }),
      btn("Close", function () { panel.style.display = "none"; }), statusEl);
    var note = document.createElement("p");
    note.style.cssText = "font:13px/1.5 var(--sans);color:var(--t2);margin:0 0 12px;";
    note.textContent = "Measurement only: signals and levels are unchanged. Each signal is replayed on Deriv's ticks for 2 hours from the signal price. R = distance from the signal price to the app's stop. Plans A–F run on the same signals, so 'vs A' is a like-for-like comparison.";
    pre = document.createElement("pre"); pre.style.cssText = "font:12px/1.55 var(--mono);white-space:pre-wrap;margin:0;";
    panel.append(bar, note, pre);
    open.onclick = function () { panel.style.display = "block"; render(); work(); };
    document.body.append(open, panel);
  }
  function start() { ui(); setTimeout(work, 15000); setInterval(work, 5 * 60 * 1000); setInterval(collect, 60 * 1000); }
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", start) : start();
})();
