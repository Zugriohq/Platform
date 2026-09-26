import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { buildDecisionCase, bundleIdentityKey, type DecisionCase } from "@zugrio/decision-core";
import type {
  MaterializeDecisionCaseRequest,
  MaterializeDecisionCaseResult,
  PersistedDecisionCase,
} from "@zugrio/alpha-api-contract";
import type { DecisionCaseStore, NewDecisionCase, StoredDecisionCase } from "../persistence/decision-case-store.js";
import { DECISION_CASE_STORE } from "../tokens.js";
import { ScenarioCatalog } from "./scenario-catalog.js";

/**
 * Persists and reconstructs validation Decision Cases. The state, reason and history
 * always come from `@zugrio/decision-core`; this service only records them.
 */
@Injectable()
export class DecisionCaseService {
  constructor(
    @Inject(ScenarioCatalog) private readonly catalog: ScenarioCatalog,
    @Inject(DECISION_CASE_STORE) private readonly store: DecisionCaseStore,
  ) {}

  async materialize(request: MaterializeDecisionCaseRequest): Promise<MaterializeDecisionCaseResult> {
    const scenario = this.catalog.find(request.scenarioId);
    if (!scenario) throw new BadRequestException(`Unknown scenarioId "${request.scenarioId}"`);
    if (request.frameIndex >= scenario.frames.length) {
      throw new BadRequestException(
        `frameIndex ${request.frameIndex} is outside scenario "${scenario.id}" (${scenario.frames.length} frames)`,
      );
    }

    const decision = buildDecisionCase(scenario, request.frameIndex);
    const { created, record } = await this.store.create(toNewRecord(scenario.id, request.frameIndex, decision));
    return { created, decisionCase: this.verify(record) };
  }

  async reconstruct(caseId: string): Promise<PersistedDecisionCase> {
    const record = await this.store.findById(caseId);
    if (!record) throw new NotFoundException(`Decision case "${caseId}" not found`);
    return this.verify(record);
  }

  /** Re-run decision-core and compare with what was stored. Never rewrites the record. */
  private verify(record: StoredDecisionCase): PersistedDecisionCase {
    const scenario = this.catalog.find(record.scenarioId);
    let consistent = false;
    if (
      scenario &&
      scenario.version === record.scenarioVersion &&
      bundleIdentityKey(scenario.bundle.identity) === record.bundleKey &&
      record.frameIndex < scenario.frames.length
    ) {
      const expected = toNewRecord(scenario.id, record.frameIndex, buildDecisionCase(scenario, record.frameIndex));
      consistent = sameRecord(expected, record);
    }
    return { ...record, consistentWithDecisionCore: consistent };
  }
}

function toNewRecord(scenarioId: string, frameIndex: number, decision: DecisionCase): NewDecisionCase {
  const { history, ...projection } = decision;
  return {
    evaluationId: decision.evaluationId,
    decisionCoreCaseId: decision.caseId,
    scenarioId,
    scenarioVersion: decision.scenarioVersion,
    frameIndex,
    evaluatedAt: new Date(decision.current.evaluatedAt).toISOString(),
    bundle: decision.bundle,
    bundleKey: bundleIdentityKey(decision.bundle.identity),
    projection,
    events: history.map((event, sequence) => ({
      sequence,
      occurredAt: new Date(event.evaluatedAt).toISOString(),
      event,
    })),
  };
}

function sameRecord(expected: NewDecisionCase, stored: StoredDecisionCase): boolean {
  return (
    expected.evaluationId === stored.evaluationId &&
    expected.decisionCoreCaseId === stored.decisionCoreCaseId &&
    expected.scenarioVersion === stored.scenarioVersion &&
    expected.bundleKey === stored.bundleKey &&
    Date.parse(expected.evaluatedAt) === Date.parse(stored.evaluatedAt) &&
    stored.authority === "NO_LIVE_CAPITAL" &&
    stored.authorityClass === "STRUCTURAL_ONLY" &&
    stored.modelScored === false &&
    canonical(expected.bundle) === canonical(stored.bundle) &&
    canonical(expected.projection) === canonical(stored.projection) &&
    expected.events.length === stored.events.length &&
    expected.events.every((event, index) => {
      const actual = stored.events[index];
      return (
        actual !== undefined &&
        actual.sequence === event.sequence &&
        Date.parse(actual.occurredAt) === Date.parse(event.occurredAt) &&
        canonical(actual.event) === canonical(event.event)
      );
    })
  );
}

/** Key-order-independent JSON, since PostgreSQL JSONB does not preserve key order. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, inner: unknown) =>
    inner && typeof inner === "object" && !Array.isArray(inner)
      ? Object.fromEntries(Object.entries(inner).sort(([a], [b]) => a.localeCompare(b)))
      : inner,
  );
}
