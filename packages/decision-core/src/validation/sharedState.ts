import { detectConfirmedPivots, validateResearchStructureBar, type PivotDefinition, type ResearchStructureBar, type ResearchMarketStructureFact } from '../research/marketMap.js';
import { canonical, causal, exact, immutable, instant, nonempty, type VersionRef, version } from './invariants.js';

declare const marketKeyBrand: unique symbol;
declare const strategyKeyBrand: unique symbol;
export type MarketStateKey = string & { readonly [marketKeyBrand]: true };
export type StrategyStateKey = string & { readonly [strategyKeyBrand]: true };
export interface MarketStateInput {
  readonly instrument: string;
  readonly source: string;
  readonly timeframe: string;
  readonly evaluatedAt: string;
  readonly dataVersion: string;
  readonly featureDefinition: VersionRef;
  readonly pivots: readonly PivotDefinition[];
  readonly bars: readonly ResearchStructureBar[];
}
export interface SharedMarketState extends MarketStateInput {
  readonly key: MarketStateKey;
  readonly knownAt: string;
  readonly facts: readonly ResearchMarketStructureFact[];
}

/** In-process research materialisation. Capacity failure is explicit; never silently rewrites history. */
export class SharedMarketStore {
  private readonly states = new Map<MarketStateKey, SharedMarketState>();
  private readonly versions = new Map<string, string>();
  private readonly definitions = new Map<string, string>();
  private readonly derived = new Map<string, readonly ResearchMarketStructureFact[]>();
  private computations = 0;
  constructor(private readonly capacity = 4096) {
    if (!Number.isSafeInteger(capacity) || capacity < 1) throw new Error('Invalid capacity');
  }
  get computationCount(): number { return this.computations; }
  materialize(input: MarketStateInput): SharedMarketState {
    exact(input, ['instrument', 'source', 'timeframe', 'evaluatedAt', 'dataVersion', 'featureDefinition', 'pivots', 'bars']);
    [input.instrument, input.source, input.timeframe, input.dataVersion].forEach(nonempty);
    version(input.featureDefinition);
    exact(input.featureDefinition, ['id', 'version']);
    instant(input.evaluatedAt);
    if (!input.bars.length || !input.pivots.length) throw new Error('Empty market evidence/definitions');
    const ids = new Set<string>(); const times = new Set<number>(); const evidenceIds = new Set<string>();
    for (const p of input.pivots) {
      exact(p, ['definitionId', 'scale', 'leftBars', 'rightBars']);
      if (!['INTERNAL', 'INTERMEDIATE', 'EXTERNAL'].includes(p.scale)) throw new Error('Unknown pivot scale');
    }
    if (new Set(input.pivots.map(p => p.definitionId)).size !== input.pivots.length) throw new Error('Duplicate definition');
    for (const b of input.bars) {
      exact(b, ['evidenceId', 'sourceBarId', 'open', 'high', 'low', 'close', 'sourceClosedAt', 'knownAt', 'dataStatus']);
      nonempty(b.evidenceId); nonempty(b.sourceBarId);
      validateResearchStructureBar(b); causal(b.sourceClosedAt, b.knownAt, input.evaluatedAt);
      if (!['FRESH_COMPLETE', 'INCOMPLETE', 'STALE', 'GAP'].includes(b.dataStatus)) throw new Error('Unknown data status');
      if (ids.has(b.sourceBarId) || evidenceIds.has(b.evidenceId) || times.has(instant(b.sourceClosedAt))) throw new Error('Duplicate market evidence');
      ids.add(b.sourceBarId); evidenceIds.add(b.evidenceId); times.add(instant(b.sourceClosedAt));
    }
    const bars = [...input.bars].sort((a,b) => instant(a.sourceClosedAt)-instant(b.sourceClosedAt));
    // Arrival order is irrelevant; knowledge-time reversal in a source series is not.
    if (bars.some((b,i) => i > 0 && instant(b.knownAt) < instant(bars[i-1]!.knownAt))) throw new Error('Reordered source knowledge');
    const pivots = [...input.pivots].sort((a,b) => a.definitionId.localeCompare(b.definitionId));
    const versionKey = canonical([input.instrument, input.source, input.timeframe, input.dataVersion]);
    const content = canonical(bars);
    const definitionKey = canonical(input.featureDefinition);
    const definition = canonical(pivots);
    if (this.versions.has(versionKey) && this.versions.get(versionKey) !== content) throw new Error('Data version mutation');
    if (this.definitions.has(definitionKey) && this.definitions.get(definitionKey) !== definition) throw new Error('Definition version mutation');
    const key = canonical([versionKey, input.evaluatedAt, definitionKey]) as MarketStateKey;
    const existing = this.states.get(key);
    if (existing) return existing;
    if (this.states.size >= this.capacity) throw new Error('Research shared-state capacity exceeded');
    const derivedKey = canonical([versionKey, definitionKey]);
    let facts = this.derived.get(derivedKey);
    if (!facts) {
      facts = immutable(detectConfirmedPivots(input.timeframe, bars, pivots));
      this.derived.set(derivedKey, facts); this.computations++;
    }
    const result = immutable({ ...input, bars, pivots, key, knownAt: bars.at(-1)!.knownAt, facts });
    this.states.set(key, result); this.versions.set(versionKey, content); this.definitions.set(definitionKey, definition);
    return result;
  }
}
