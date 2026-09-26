export type OpportunityState = "FORMING" | "READY" | "TRIGGERED" | "PASS";

export interface EvidenceSnapshot {
  readonly timestamp: string;
  readonly price: number;
  readonly setupQualified: boolean;
  readonly locationQualified: boolean;
  readonly retestObserved: boolean;
  readonly triggerQualified: boolean;
  readonly currentConditionsValid: boolean;
  readonly invalidated: boolean;
  readonly note: string;
}

export interface AlphaTradeBundle {
  readonly id: string;
  readonly version: string;
  readonly strategy: "Zugrio Core";
  readonly instrument: string;
  readonly market: "FX";
  readonly horizon: "Intraday";
  readonly evidenceStatus: "VALIDATION_ONLY";
}

export interface DecisionEvent {
  readonly timestamp: string;
  readonly state: OpportunityState;
  readonly reason: string;
  readonly price: number;
}

export interface DecisionCase {
  readonly caseId: string;
  readonly bundle: AlphaTradeBundle;
  readonly current: EvidenceSnapshot;
  readonly state: OpportunityState;
  readonly reason: string;
  readonly history: readonly DecisionEvent[];
  readonly authority: "NO_LIVE_CAPITAL";
}

export interface ReplayScenario {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly bundle: AlphaTradeBundle;
  readonly frames: readonly EvidenceSnapshot[];
}
