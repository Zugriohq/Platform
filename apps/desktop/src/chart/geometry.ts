import type { EngineChartPrimitive } from "@zugrio/decision-core";

/**
 * Screen mapping only. Every price/time here is engine-supplied (primitive
 * geometry) or a replay frame's own evaluatedAt/price. Nothing is extrapolated,
 * snapped, refitted or padded in price terms beyond display margins.
 */

export interface TracePoint {
  readonly time: string;
  readonly price: number;
}

export interface PlotBox {
  readonly width: number;
  readonly height: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

export const PLOT: PlotBox = { width: 960, height: 360, left: 18, right: 92, top: 20, bottom: 28 };

export interface ChartScale {
  readonly t0: number;
  readonly t1: number;
  readonly p0: number;
  readonly p1: number;
  readonly x: (time: string | number) => number;
  readonly y: (price: number) => number;
  readonly plot: PlotBox;
}

function epoch(value: string | number): number {
  return typeof value === "number" ? value : Date.parse(value);
}

/** Prices and times that define the visible market domain. REGIME is context, never a price. */
export function geometryExtent(primitive: EngineChartPrimitive): { prices: number[]; times: number[] } {
  if (primitive.layer === "REGIME") return { prices: [], times: [] };
  const geometry = primitive.geometry;
  switch (geometry.type) {
    case "POINT":
      return { prices: [geometry.price], times: [epoch(geometry.time)] };
    case "LEVEL":
      return { prices: [geometry.price], times: [geometry.startAt, geometry.endAt].filter((v): v is string => v !== undefined).map(epoch) };
    case "ZONE":
      return { prices: [geometry.low, geometry.high], times: [geometry.startAt, geometry.endAt].filter((v): v is string => v !== undefined).map(epoch) };
    case "PATH":
      return { prices: geometry.points.map(point => point.price), times: geometry.points.map(point => epoch(point.time)) };
  }
}

export function buildScale(
  trace: readonly TracePoint[],
  primitives: readonly EngineChartPrimitive[],
  evaluatedAt: string,
  plot: PlotBox = PLOT,
): ChartScale | null {
  const prices: number[] = [];
  const times: number[] = [epoch(evaluatedAt)];
  for (const point of trace) {
    prices.push(point.price);
    times.push(epoch(point.time));
  }
  for (const primitive of primitives) {
    const extent = geometryExtent(primitive);
    prices.push(...extent.prices);
    times.push(...extent.times);
  }
  if (prices.length === 0 || [...prices, ...times].some(value => !Number.isFinite(value))) return null;

  let p0 = Math.min(...prices);
  let p1 = Math.max(...prices);
  // Display margin only: a flat or tiny range still gets a visible band.
  const minimumSpan = Math.max(Math.abs((p0 + p1) / 2) * 1e-5, 1e-9);
  if (p1 - p0 < minimumSpan) {
    const mid = (p0 + p1) / 2;
    p0 = mid - minimumSpan / 2;
    p1 = mid + minimumSpan / 2;
  }
  const pad = (p1 - p0) * 0.08;
  p0 -= pad;
  p1 += pad;

  let t0 = Math.min(...times);
  let t1 = Math.max(...times);
  if (t1 - t0 < 60_000) {
    t0 -= 30_000;
    t1 += 30_000;
  }
  const innerWidth = plot.width - plot.left - plot.right;
  const innerHeight = plot.height - plot.top - plot.bottom;
  return {
    t0, t1, p0, p1, plot,
    x: time => plot.left + ((epoch(time) - t0) / (t1 - t0)) * innerWidth,
    y: price => plot.top + (1 - (price - p0) / (p1 - p0)) * innerHeight,
  };
}

/** Horizontal extent of a LEVEL/ZONE: supplied bounds, open ends run to the plot edge. */
export function horizontalSpan(
  geometry: { readonly startAt?: string; readonly endAt?: string },
  scale: ChartScale,
): { x1: number; x2: number } {
  return {
    x1: geometry.startAt !== undefined ? scale.x(geometry.startAt) : scale.plot.left,
    x2: geometry.endAt !== undefined ? scale.x(geometry.endAt) : scale.plot.width - scale.plot.right,
  };
}

/** Where a callout or label attaches to a primitive's own geometry. */
export function anchorFor(primitive: EngineChartPrimitive, scale: ChartScale): { x: number; y: number } {
  const geometry = primitive.geometry;
  switch (geometry.type) {
    case "POINT":
      return { x: scale.x(geometry.time), y: scale.y(geometry.price) };
    case "LEVEL":
      return { x: horizontalSpan(geometry, scale).x2, y: scale.y(geometry.price) };
    case "ZONE": {
      const span = horizontalSpan(geometry, scale);
      return { x: span.x2, y: scale.y(geometry.high) };
    }
    case "PATH": {
      const last = geometry.points[geometry.points.length - 1]!;
      return { x: scale.x(last.time), y: scale.y(last.price) };
    }
  }
}

export function priceTicks(scale: ChartScale, count = 4): number[] {
  const step = (scale.p1 - scale.p0) / (count + 1);
  return Array.from({ length: count }, (_, index) => scale.p0 + step * (index + 1));
}

export function formatPrice(price: number, scale: ChartScale): string {
  const span = scale.p1 - scale.p0;
  const decimals = span >= 100 ? 2 : span >= 1 ? 3 : Math.min(8, Math.max(2, Math.ceil(-Math.log10(span)) + 2));
  return price.toFixed(decimals);
}
