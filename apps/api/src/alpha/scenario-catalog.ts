import { Injectable } from "@nestjs/common";
import { alphaScenarios, buildDecisionCase, type DecisionCase, type ReplayScenario } from "@zugrio/decision-core";
import type { ScenarioDetail, ScenarioSummary } from "@zugrio/alpha-api-contract";

/**
 * Read-only view over the decision-core validation fixtures. Classification is always
 * delegated to `buildDecisionCase`; nothing here interprets evidence.
 */
@Injectable()
export class ScenarioCatalog {
  private readonly scenarios: ReadonlyMap<string, ReplayScenario> = new Map(
    alphaScenarios.map((scenario) => [scenario.id, scenario]),
  );

  list(): ScenarioSummary[] {
    return [...this.scenarios.values()].map(toSummary);
  }

  find(scenarioId: string): ReplayScenario | undefined {
    return this.scenarios.get(scenarioId);
  }

  detail(scenarioId: string): ScenarioDetail | undefined {
    const scenario = this.find(scenarioId);
    return scenario ? { ...toSummary(scenario), frames: scenario.frames } : undefined;
  }

  /** `undefined` when the scenario or frame does not exist. */
  frameDecisionCase(scenarioId: string, frameIndex: number): DecisionCase | undefined {
    const scenario = this.find(scenarioId);
    if (!scenario || frameIndex >= scenario.frames.length) return undefined;
    return buildDecisionCase(scenario, frameIndex);
  }
}

function toSummary(scenario: ReplayScenario): ScenarioSummary {
  return {
    id: scenario.id,
    title: scenario.title,
    description: scenario.description,
    bundle: scenario.bundle,
    frameCount: scenario.frames.length,
  };
}
