/**
 * Zugrio EA scan bridge (ADR-0009). Runs inside the cTrader EA under Jint.
 *
 * It contains no trading logic of its own. It converts closed cTrader bars into
 * decision-core inputs, enumerates candidate bindings from the facts decision-core
 * derives, and asks decision-core's SharedEntryEngine to judge every one. Ranking
 * of READY candidates follows the frozen spec's unadmitted structural ranking
 * (SEL-4: lifecycle state → setup priority → causal age).
 *
 * Every parameter arrives in the request from the EA's versioned research config
 * (UNVALIDATED_RESEARCH). Nothing here is a validated threshold.
 */
import {
  SharedEntryEngine,
  SharedMarketStore,
  createEntryValidationInput,
  type EntryCandidate,
  type EntryEvaluationInput,
  type MarketStateInput,
} from "@zugrio/decision-core";

type Side = "BUY" | "SELL";
type Route = "CONTINUATION_RETEST" | "REVERSAL_RECLAIM";
type Role = "context" | "location" | "entry" | "management";

export interface ScanRequest {
  readonly schema: "zugrio.ea-scan-request/v1";
  readonly configVersion: string;
  readonly evaluatedAt: string;
  readonly instrument: { readonly symbol: string; readonly source: string; readonly tickSize: number };
  readonly family: { readonly family: string; readonly priceOrigin: "EXTERNAL_MARKET" | "SYNTHETIC_GENERATOR" };
  readonly horizon: { readonly horizon: string; readonly setupExpiryMs: number; readonly entryExpiryMs: number };
  readonly timeframes: { readonly context: string; readonly location: string; readonly entry: string; readonly management: string; readonly maxAgeMs: Readonly<Record<Role, number>> };
  readonly model: { readonly route: Route; readonly breakTicks: number; readonly touchTicks: number; readonly stopTicks: number; readonly maxChaseTicks: number; readonly minimumRunwayTicks: number };
  readonly pivots: readonly { readonly definitionId: string; readonly scale: "INTERNAL" | "INTERMEDIATE" | "EXTERNAL"; readonly leftBars: number; readonly rightBars: number }[];
  /**
   * readyOnly: skip bindings that cannot be STRUCTURAL_READY at the latest entry close,
   * using decision-core's own READY predicates (geometryCurrent and targetRunwayAvailable
   * in interpret()) with identical arithmetic. READY results are unchanged; only
   * CANDIDATE/WATCH bindings far from price are not judged. The EA sets it for speed.
   */
  readonly enumeration: { readonly recentFactsPerRole: number; readonly readyOnly?: boolean };
  readonly markets: readonly { readonly timeframe: string; readonly bars: readonly { readonly closedAt: string; readonly o: number; readonly h: number; readonly l: number; readonly c: number }[] }[];
}

export interface ScanCandidate {
  readonly opportunityId: string;
  readonly side: Side;
  readonly state: EntryCandidate["state"];
  readonly reasons: readonly string[];
  readonly geometry: EntryCandidate["geometry"];
  readonly currentEntryStatus: string | null;
  readonly binding: { readonly contextFactId: string; readonly locationFactId: string; readonly objectiveFactId: string };
  readonly knownAt: string;
}

export interface ScanResult {
  readonly schema: "zugrio.ea-scan-result/v1";
  readonly configVersion: string;
  readonly evaluatedAt: string;
  readonly ranking: string;
  readonly candidates: readonly ScanCandidate[];
  readonly route: Route;
  readonly best: ScanCandidate | null;
  /** The binding level closest to the latest close: how near the market is to a possible setup. */
  readonly nearestLevel: { readonly distance: number; readonly level: number; readonly side: Side } | null;
  readonly lastClose: number;
  /** Context-timeframe structure (higher highs/lows etc.), for the EA's trend filter. */
  readonly trend: Trend;
  /**
   * True when some location level is within the chase distance of the latest close but has no
   * context swing beyond it to target ("open sky"). The EA then rescans with a higher context
   * timeframe, whose older swings can supply a target.
   */
  readonly openSky: boolean;
  /** Bindings not judged because they cannot be READY at the latest close (readyOnly). */
  readonly skippedNotReadyable: number;
  readonly errors: readonly string[];
}

const RANKING = "SEL-4: lifecycle state (READY > WATCH > CANDIDATE) → setup priority (single route) → causal age (most recent confirmation first) → opportunityId";
const STATE_RANK: Record<string, number> = { STRUCTURAL_READY: 3, STRUCTURAL_WATCH: 2, STRUCTURAL_CANDIDATE: 1 };

function ref(id: string, version: string) { return { id, version }; }
function point(f: { geometry: { type: string; price?: number } }): number | null { return f.geometry.type === "POINT" && typeof f.geometry.price === "number" ? f.geometry.price : null; }

type Trend = "UP" | "DOWN" | "MIXED" | "UNKNOWN";
/**
 * Structure of the context timeframe from decision-core's own confirmed pivots: UP when the
 * last two swing highs and the last two swing lows both rise (higher highs, higher lows),
 * DOWN when both fall, MIXED otherwise, UNKNOWN with fewer than two of either. Descriptive
 * only: the EA uses it as an abort-only filter, never as an entry signal.
 */
export function trendOf(facts: readonly { concept: string; geometry: { type: string; price?: number; time?: string } }[]): Trend {
  const lastTwo = (concept: string) => facts.filter((f) => f.concept === concept && point(f) !== null && typeof f.geometry.time === "string")
    .sort((a, b) => Date.parse(a.geometry.time!) - Date.parse(b.geometry.time!)).slice(-2).map((f) => point(f)!);
  const highs = lastTwo("SWING_HIGH"), lows = lastTwo("SWING_LOW");
  if (highs.length < 2 || lows.length < 2) return "UNKNOWN";
  if (highs[1]! > highs[0]! && lows[1]! > lows[0]!) return "UP";
  if (highs[1]! < highs[0]! && lows[1]! < lows[0]!) return "DOWN";
  return "MIXED";
}

function profiles(r: ScanRequest) {
  const v = r.configVersion;
  const family = { ...ref(`family:${r.family.family}`, v), family: r.family.family, priceOrigin: r.family.priceOrigin };
  const instrument = { ...ref(`instrument:${r.instrument.symbol}`, v), instrument: r.instrument.symbol, source: r.instrument.source, familyProfile: ref(family.id, v), tickSize: r.instrument.tickSize };
  const timeframes = { ...ref(`map:${r.horizon.horizon}`, v), context: r.timeframes.context, location: r.timeframes.location, entry: r.timeframes.entry, management: r.timeframes.management, maxAgeMs: { ...r.timeframes.maxAgeMs } };
  const horizon = { ...ref(`horizon:${r.horizon.horizon}`, v), horizon: r.horizon.horizon, timeframeMap: ref(timeframes.id, v), setupExpiryMs: r.horizon.setupExpiryMs, entryExpiryMs: r.horizon.entryExpiryMs };
  const model = {
    ...ref(`model:${r.model.route}:${r.family.family}:${r.horizon.horizon}`, v), route: r.model.route,
    familyProfile: ref(family.id, v), instrumentProfile: ref(instrument.id, v), horizonProfile: ref(horizon.id, v),
    strategy: ref("zugrio-core-research", v), tradeBundle: ref(`bundle:${r.model.route}:${r.instrument.symbol}:${r.horizon.horizon}`, v),
    regimeModel: ref("context-pivot-hold", v), calibration: ref(`calibration:${r.instrument.symbol}:${r.horizon.horizon}`, v),
    calibrationStatus: "UNVALIDATED_RESEARCH" as const,
    breakTicks: r.model.breakTicks, touchTicks: r.model.touchTicks, stopTicks: r.model.stopTicks, maxChaseTicks: r.model.maxChaseTicks, minimumRunwayTicks: r.model.minimumRunwayTicks,
  };
  return { family, instrument, timeframes, horizon, model };
}

function marketInputs(r: ScanRequest): MarketStateInput[] {
  const needed = [...new Set([r.timeframes.context, r.timeframes.location, r.timeframes.entry, r.timeframes.management])].sort();
  return needed.map((tf) => {
    const m = r.markets.find((x) => x.timeframe === tf);
    if (!m || !m.bars.length) throw new Error(`missing bars for ${tf}`);
    const bars = m.bars.map((b) => ({
      evidenceId: `${r.instrument.symbol}:${tf}:${b.closedAt}`, sourceBarId: `${tf}:${b.closedAt}`,
      open: b.o, high: b.h, low: b.l, close: b.c, sourceClosedAt: b.closedAt, knownAt: b.closedAt, dataStatus: "FRESH_COMPLETE" as const,
    }));
    return {
      instrument: r.instrument.symbol, source: r.instrument.source, timeframe: tf, evaluatedAt: r.evaluatedAt,
      dataVersion: `${tf}:${bars[0]!.sourceClosedAt}..${bars.at(-1)!.sourceClosedAt}:${bars.length}`,
      featureDefinition: ref("confirmed-pivot", r.configVersion), pivots: r.pivots.map((p) => ({ ...p })), bars,
    };
  });
}

/** Enumerates bindings from decision-core's own facts and lets decision-core judge each. */
export function scan(r: ScanRequest): ScanResult {
  if (r.schema !== "zugrio.ea-scan-request/v1") throw new Error("unknown request schema");
  return scanWith(prepare(r), r, r.model.route);
}

/**
 * Several routes over the same bars in one call (zugrio.ea-multi-scan/v1). The bars are
 * validated and their pivots computed once, and one engine judges every route, so this is
 * much cheaper than one scan() per route. Each route's result equals scan() for that route.
 */
export interface MultiScanResult {
  readonly schema: "zugrio.ea-multi-scan-result/v1";
  readonly configVersion: string;
  readonly evaluatedAt: string;
  readonly results: readonly ScanResult[];
}
export function scanRoutes(r: ScanRequest & { readonly routes: readonly Route[] }): MultiScanResult {
  if (r.schema !== "zugrio.ea-scan-request/v1") throw new Error("unknown request schema");
  if (!Array.isArray(r.routes) || r.routes.length === 0) throw new Error("routes required");
  const shared = prepare(r);
  const results = [...new Set(r.routes)].map((route) => {
    if (route !== "CONTINUATION_RETEST" && route !== "REVERSAL_RECLAIM") throw new Error(`unknown route ${route}`);
    return scanWith(shared, { ...r, model: { ...r.model, route } }, route);
  });
  return { schema: "zugrio.ea-multi-scan-result/v1", configVersion: r.configVersion, evaluatedAt: r.evaluatedAt, results };
}

interface Prepared {
  readonly markets: MarketStateInput[];
  readonly engine: SharedEntryEngine;
  readonly facts: Map<string, readonly { factId: string; concept: string; knownAt: string; geometry: { type: string; price?: number } }[]>;
  readonly lastClose: number;
}

function prepare(r: ScanRequest): Prepared {
  const markets = marketInputs(r);
  const engine = new SharedEntryEngine();
  // The engine's own store, so its later materialisations share the pivot computation.
  const store: SharedMarketStore = engine.markets;
  const facts = new Map(markets.map((m) => [m.timeframe, store.materialize(m).facts]));
  const entryBars = [...markets.find((m) => m.timeframe === r.timeframes.entry)!.bars].sort((a, b) => Date.parse(a.sourceClosedAt) - Date.parse(b.sourceClosedAt));
  return { markets, engine, facts: facts as Prepared["facts"], lastClose: entryBars.at(-1)!.close };
}

function scanWith(shared: Prepared, r: ScanRequest, route: Route): ScanResult {
  const errors: string[] = [];
  const p = profiles(r);
  const { markets, engine, facts, lastClose } = shared;
  const tickSize = r.instrument.tickSize;
  let skipped = 0;
  let nearest: { distance: number; level: number; side: Side } | null = null;
  let openSky = false;
  const k = Math.max(1, Math.floor(r.enumeration.recentFactsPerRole));
  const out: ScanCandidate[] = [];

  for (const side of ["BUY", "SELL"] as const) {
    const sign = side === "BUY" ? 1 : -1;
    const support = side === "BUY" ? "SWING_LOW" : "SWING_HIGH";
    const resistance = side === "BUY" ? "SWING_HIGH" : "SWING_LOW";
    const locationConcept = route === "CONTINUATION_RETEST" ? resistance : support;
    const ctxFacts = facts.get(r.timeframes.context) ?? [];
    const locFacts = facts.get(r.timeframes.location) ?? [];
    const recent = <T extends { knownAt: string }>(xs: readonly T[]) => [...xs].sort((a, b) => Date.parse(b.knownAt) - Date.parse(a.knownAt)).slice(0, k);
    for (const c of recent(ctxFacts.filter((f) => f.concept === support && point(f) !== null))) {
      for (const l of recent(locFacts.filter((f) => f.concept === locationConcept && point(f) !== null))) {
        const level = point(l)!;
        // decision-core itself rejects any objective other than the nearest one (NEARER_OBJECTIVE_EXISTS).
        const objective = ctxFacts.filter((f) => f.concept === resistance && point(f) !== null && sign * (point(f)! - level) > 0)
          .sort((a, b) => sign * (point(a)! - point(b)!))[0];
        if (!objective) {
          if (Math.abs(lastClose - level) <= r.model.maxChaseTicks * tickSize) openSky = true;
          continue;
        }
        const distance = Math.abs(lastClose - level);
        if (!nearest || distance < nearest.distance) nearest = { distance, level, side };
        if (r.enumeration.readyOnly) {
          // Same expressions as decision-core's interpret(): stop, geometryCurrent, targetRunwayAvailable.
          const stop = level - sign * r.model.stopTicks * tickSize;
          const objectivePrice = point(objective)!;
          const readyable = sign * (lastClose - stop) > 0 && Math.abs(lastClose - level) <= r.model.maxChaseTicks * tickSize
            && sign * (objectivePrice - lastClose) >= r.model.minimumRunwayTicks * tickSize;
          if (!readyable) { skipped++; continue; }
        }
        const input: EntryEvaluationInput = { markets, ...p, binding: { side, contextFactId: c.factId, locationFactId: l.factId, objectiveFactId: objective.factId } } as unknown as EntryEvaluationInput;
        try {
          const e = engine.evaluate(input);
          out.push({ opportunityId: e.opportunityId, side, state: e.state, reasons: e.reasons, geometry: e.geometry, currentEntryStatus: e.currentEntry ? e.currentEntry.status : null,
            binding: { contextFactId: c.factId, locationFactId: l.factId, objectiveFactId: objective.factId }, knownAt: e.knownAt });
        } catch (err) {
          errors.push(`${side} ${c.factId} ${l.factId}: ${(err as Error).message}`);
        }
      }
    }
  }
  const ranked = [...out].sort((a, b) =>
    (STATE_RANK[b.state] ?? 0) - (STATE_RANK[a.state] ?? 0)
    || Date.parse(b.geometry?.frozenAt ?? b.knownAt) - Date.parse(a.geometry?.frozenAt ?? a.knownAt)
    || (a.opportunityId < b.opportunityId ? -1 : a.opportunityId > b.opportunityId ? 1 : 0));
  const best = ranked.find((x) => x.state === "STRUCTURAL_READY") ?? null;
  return { schema: "zugrio.ea-scan-result/v1", configVersion: r.configVersion, evaluatedAt: r.evaluatedAt, route, ranking: RANKING, candidates: ranked, best,
    skippedNotReadyable: skipped, nearestLevel: nearest, lastClose, trend: trendOf(facts.get(r.timeframes.context) ?? []), openSky, errors };
}

/** Engine integrity check the EA runs before trading: decision-core's own fixture must give its known answer. */
export function selfTest(): { ok: boolean; detail: string } {
  const e = new SharedEntryEngine().evaluate(createEntryValidationInput("CONTINUATION_RETEST", "GOLD", "INTRADAY", 7));
  const g = e.geometry;
  const ok = e.state === "STRUCTURAL_READY" && !!g && g.entryReference === 111 && g.childInvalidation === 105 && g.objective === 130;
  return { ok, detail: `${e.state} ${g ? `${g.entryReference}/${g.childInvalidation}/${g.objective}` : "no-geometry"}` };
}

(globalThis as unknown as { ZugrioEngineBridge: unknown }).ZugrioEngineBridge = {
  scan: (json: string) => JSON.stringify(scan(JSON.parse(json) as ScanRequest)),
  scanRoutes: (json: string) => JSON.stringify(scanRoutes(JSON.parse(json))),
  selfTest: () => JSON.stringify(selfTest()),
};
