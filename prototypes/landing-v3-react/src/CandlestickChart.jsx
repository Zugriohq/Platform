import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";

const BASE_CLOSES = [
  22,24,23,27,30,28,31,35,33,37,40,38,42,45,43,47,51,49,
  53,56,54,58,61,59,63,66,64,68,71,69,73,76,74,79,82,80
];

function buildBars(marketKey, caseKey) {
  const marketShift = marketKey === "GOLD" ? 2 : marketKey === "SYNTH" ? -2 : 0;
  const closes = BASE_CLOSES.map((v, i) => {
    const wave = marketKey === "SYNTH" ? ((i % 5) - 2) * 1.35 : marketKey === "GOLD" ? Math.sin(i * .7) * 1.6 : Math.sin(i * .45) * .9;
    return v + marketShift + wave;
  });

  if (caseKey === "valid") {
    closes[closes.length - 2] = 58 + marketShift;
    closes[closes.length - 1] = 61 + marketShift;
  } else {
    closes[closes.length - 3] = 69 + marketShift;
    closes[closes.length - 2] = 77 + marketShift;
    closes[closes.length - 1] = 84 + marketShift;
  }

  return closes.map((close, i) => {
    const open = i === 0 ? close - 1.8 : closes[i - 1];
    const wickUp = 1.2 + ((i * 7) % 5) * .55;
    const wickDown = 1 + ((i * 11) % 4) * .6;
    return {
      open,
      close,
      high: Math.max(open, close) + wickUp,
      low: Math.min(open, close) - wickDown,
    };
  });
}

// The chart draws in real CSS pixels: the viewBox always equals the rendered box, so
// text keeps its true size on phones instead of being scaled down with an 820px canvas.
function useRenderedSize(ref, fallback) {
  const [size, setSize] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const read = () => {
      const rect = el.getBoundingClientRect();
      const next = { w: Math.round(rect.width), h: Math.round(rect.height) };
      if (!next.w || !next.h) return;
      setSize(prev => (prev.w === next.w && prev.h === next.h ? prev : next));
    };
    read();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", read);
      return () => window.removeEventListener("resize", read);
    }
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

export default function CandlestickChart({ marketKey, caseKey, priceSpec }) {
  const [hovered, setHovered] = useState(null);
  const svgRef = useRef(null);
  const { w: W, h: H } = useRenderedSize(svgRef, { w: 820, h: 340 });
  const compact = W < 520;
  const allBars = useMemo(() => buildBars(marketKey, caseKey), [marketKey, caseKey]);
  // Narrow screens show the most recent candles only, so each candle stays legible.
  const bars = compact ? allBars.slice(-(W < 380 ? 22 : 26)) : allBars;

  const left = compact ? 10 : 16;
  const right = compact ? 48 : 70;
  const top = 18;
  const bottom = 28;
  const plotW = W - left - right;
  const plotH = H - top - bottom;

  const all = bars.flatMap(b => [b.high, b.low]);
  const min = Math.min(...all) - 3;
  const max = Math.max(...all) + 3;
  const y = v => top + (max - v) / (max - min) * plotH;
  const x = i => left + (i + .5) * plotW / bars.length;
  const candleStep = plotW / bars.length;
  const bodyW = Math.max(5, Math.min(12, candleStep * .58));

  const entry = 60;
  const stop = 48;
  const target = 82;
  const current = caseKey === "valid" ? 61 : 84;
  const bos = 68;

  const fmt = v => {
    const raw = priceSpec.base + v * priceSpec.unit;
    return raw.toFixed(priceSpec.digits);
  };

  return (
    <div className="candlestick-wrap">
      <svg ref={svgRef} className="chart" viewBox={"0 0 " + W + " " + H} role="img" aria-label="Illustrative candlestick chart with decision geometry">
        <defs>
          <linearGradient id={"zone-" + marketKey} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity=".025"/>
            <stop offset="55%" stopColor="var(--accent)" stopOpacity=".09"/>
            <stop offset="100%" stopColor="var(--accent)" stopOpacity=".02"/>
          </linearGradient>
        </defs>

        {[.2,.4,.6,.8].map((p, i) => (
          <line key={i} x1={left} x2={W-right} y1={top + plotH*p} y2={top + plotH*p} className="grid-line" />
        ))}

        <rect x={left} y={y(64)} width={plotW} height={Math.max(4, y(57)-y(64))} fill={"url(#zone-" + marketKey + ")"} />
        <text x={left + 8} y={y(64) - 6} className="chart-tag">entry zone</text>

        <line x1={left} x2={W-right} y1={y(bos)} y2={y(bos)} className="structure-line" />
        <text x={W-right-42} y={y(bos)-6} className="chart-tag">BOS</text>

        <line x1={left} x2={W-right} y1={y(entry)} y2={y(entry)} className="frozen-line" />
        <text x={left+8} y={y(entry)-6} className="svg-label">signal entry · {fmt(entry)}</text>

        <line x1={left} x2={W-right} y1={y(stop)} y2={y(stop)} className="stop-line" />
        <text x={W-right+7} y={y(stop)+4} className="axis-label stop-label">SL</text>

        <line x1={left} x2={W-right} y1={y(target)} y2={y(target)} className="target-line" />
        <text x={W-right+7} y={y(target)+4} className="axis-label target-label">TP</text>

        {bars.map((bar, i) => {
          const up = bar.close >= bar.open;
          const topBody = y(Math.max(bar.open, bar.close));
          const bottomBody = y(Math.min(bar.open, bar.close));
          const h = Math.max(2.2, bottomBody - topBody);
          const cx = x(i);
          return (
            <g key={marketKey + "-" + caseKey + "-" + i}
               onMouseEnter={() => setHovered({ ...bar, i, x: cx })}
               onMouseLeave={() => setHovered(null)}>
              <motion.line
                x1={cx} x2={cx}
                initial={{ opacity: 0 }}
                animate={{ opacity: .82 }}
                transition={{ delay: Math.min(.32, i*.009), duration: .28 }}
                y1={y(bar.high)} y2={y(bar.low)}
                className={up ? "candle-wick up" : "candle-wick down"}
              />
              <motion.rect
                x={cx-bodyW/2}
                width={bodyW}
                rx="1.5"
                initial={{ y: topBody + h/2, height: 1, opacity: 0 }}
                animate={{ y: topBody, height: h, opacity: 1 }}
                transition={{ delay: Math.min(.34, i*.009), duration: .3, ease: [0.16,1,0.3,1] }}
                className={up ? "candle-body up" : "candle-body down"}
              />
              <rect x={cx-candleStep/2} y={top} width={candleStep} height={plotH} fill="transparent" />
            </g>
          );
        })}

        <motion.line
          key={"current-" + caseKey}
          x1={left} x2={W-right}
          initial={{ opacity: 0, x1: W-right-80 }}
          animate={{ opacity: 1, x1: left }}
          transition={{ duration: .55, ease: [0.16,1,0.3,1] }}
          y1={y(current)} y2={y(current)}
          className="current-line"
        />
        <text x={W-right+7} y={y(current)+4} className="axis-label current-label">NOW</text>

        {hovered && (
          <g className="crosshair">
            <line x1={hovered.x} x2={hovered.x} y1={top} y2={H-bottom} />
            <circle cx={hovered.x} cy={y(hovered.close)} r="3.5" />
          </g>
        )}
      </svg>

      <div className="ohlc-tooltip" aria-live="polite">
        {hovered ? (
          <>
            <span>O <b>{fmt(hovered.open)}</b></span>
            <span>H <b>{fmt(hovered.high)}</b></span>
            <span>L <b>{fmt(hovered.low)}</b></span>
            <span>C <b>{fmt(hovered.close)}</b></span>
          </>
        ) : (
          <span>Hover candles to inspect OHLC</span>
        )}
      </div>
    </div>
  );
}
