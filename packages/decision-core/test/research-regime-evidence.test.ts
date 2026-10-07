import { describe, expect, it } from "vitest";
import {
  classifyCanonicalRegime,
  computeRegimeMeasurements,
  type ResearchRegimeClassificationDefinition,
  type ResearchRegimeMeasurementDefinition,
  type ResearchStructureBar,
} from "../src/index.js";

function bar(
  id: string,
  index: number,
  open: number,
  high: number,
  low: number,
  close: number,
  status: ResearchStructureBar["dataStatus"] = "FRESH_COMPLETE",
): ResearchStructureBar {
  const sourceClosedAt = new Date(
    Date.parse("2026-09-24T08:00:00Z") + index * 300_000,
  ).toISOString();
  return {
    evidenceId: `regime-evidence:${id}`,
    sourceBarId: `M5:${id}`,
    open,
    high,
    low,
    close,
    sourceClosedAt,
    knownAt: new Date(Date.parse(sourceClosedAt) + 1_000).toISOString(),
    dataStatus: status,
  };
}

const measurementDefinition: ResearchRegimeMeasurementDefinition = {
  definitionId: "regime-measurements:fixture:v1",
  lookbackBars: 3,
  baselineBars: 2,
  maxLatestBarAgeMs: 60_000,
};

const classificationDefinition: ResearchRegimeClassificationDefinition = {
  definitionId: "regime-classifier:fixture:v1",
  profileId: "zugrio-core:fixture",
  profileVersion: "0.1.0",
  rules: [
    {
      ruleId: "expansion-trending",
      regime: "EXPANSION",
      predicates: [
        {
          measurement: "RANGE_EXPANSION_RATIO",
          operator: "GTE",
          threshold: 1.5,
          thresholdProvenanceId: "fixture-threshold:range-expansion:v1",
        },
        {
          measurement: "CLOSE_EFFICIENCY",
          operator: "GTE",
          threshold: 0.7,
          thresholdProvenanceId: "fixture-threshold:close-efficiency:v1",
        },
      ],
    },
    {
      ruleId: "compression-overlap",
      regime: "COMPRESSION",
      predicates: [
        {
          measurement: "RANGE_EXPANSION_RATIO",
          operator: "LTE",
          threshold: 0.75,
          thresholdProvenanceId: "fixture-threshold:range-compression:v1",
        },
        {
          measurement: "ADJACENT_OVERLAP_RATIO",
          operator: "GTE",
          threshold: 0.6,
          thresholdProvenanceId: "fixture-threshold:overlap:v1",
        },
      ],
    },
  ],
};

const expansionBars = [
  bar("0",0,1.1000,1.1005,1.0995,1.1001),
  bar("1",1,1.1001,1.1006,1.0997,1.1002),
  bar("2",2,1.1002,1.1014,1.1000,1.1012),
  bar("3",3,1.1012,1.1030,1.1010,1.1028),
  bar("4",4,1.1028,1.1050,1.1025,1.1048),
] as const;

describe("canonical regime research evidence", () => {
  it("computes neutral bounded-window measurements without interpreting regime", () => {
    const result = computeRegimeMeasurements({
      timeframe:"M5",
      evaluatedAt:expansionBars[4].knownAt,
      bars:expansionBars,
      definition:measurementDefinition,
    });

    expect(result.status).toBe("AVAILABLE");
    expect(result.measurements?.sourceEvidenceIds).toHaveLength(5);
    expect(result.measurements?.values.CLOSE_EFFICIENCY).toBeGreaterThan(0.9);
    expect(result.measurements?.values.RANGE_EXPANSION_RATIO).toBeGreaterThan(1.5);
    expect(result.liveCapitalAuthority).toBe(false);
  });

  it("does not use future bars to complete the bounded window", () => {
    const result = computeRegimeMeasurements({
      timeframe:"M5",
      evaluatedAt:expansionBars[3].knownAt,
      bars:expansionBars,
      definition:measurementDefinition,
    });
    expect(result.status).toBe("INSUFFICIENT_EVIDENCE");
    expect(result.measurements).toBeNull();
  });

  it("fails closed when the required bounded window contains stale/incomplete/gap evidence", () => {
    for (const status of ["STALE","INCOMPLETE","GAP"] as const) {
      const altered = expansionBars.map((item,index) =>
        index === 4 ? { ...item, dataStatus:status } : item,
      );
      const result = computeRegimeMeasurements({
        timeframe:"M5",
        evaluatedAt:altered[4]!.knownAt,
        bars:altered,
        definition:measurementDefinition,
      });
      expect(result.status).toBe("DATA_UNAVAILABLE");
      expect(result.measurements).toBeNull();
    }
  });

  it("does not let a later request time renew an old bounded window", () => {
    const result = computeRegimeMeasurements({
      timeframe:"M5",
      evaluatedAt:"2026-09-24T09:30:00Z",
      bars:expansionBars,
      definition:measurementDefinition,
    });
    expect(result.status).toBe("DATA_UNAVAILABLE");
    expect(result.reasons).toContain("LATEST_BAR_TOO_OLD");
  });

  it("classifies only through profile-owned threshold predicates", () => {
    const measurements = computeRegimeMeasurements({
      timeframe:"M5",
      evaluatedAt:expansionBars[4].knownAt,
      bars:expansionBars,
      definition:measurementDefinition,
    });
    const classification = classifyCanonicalRegime({
      assessment:measurements,
      definition:classificationDefinition,
    });

    expect(classification.status).toBe("CLASSIFIED");
    expect(classification.regime).toBe("EXPANSION");
    expect(classification.fact?.regime).toBe("EXPANSION");
    expect(classification.matchingRuleIds).toEqual(["expansion-trending"]);
    expect(classification.liveCapitalAuthority).toBe(false);
  });

  it("fails closed as UNCERTAIN when profile rules overlap", () => {
    const measurements = computeRegimeMeasurements({
      timeframe:"M5",
      evaluatedAt:expansionBars[4].knownAt,
      bars:expansionBars,
      definition:measurementDefinition,
    });
    const classification = classifyCanonicalRegime({
      assessment:measurements,
      definition:{
        ...classificationDefinition,
        definitionId:"overlap:v1",
        rules:[
          classificationDefinition.rules[0]!,
          {
            ruleId:"also-expansion",
            regime:"BREAKOUT",
            predicates:[{
              measurement:"CLOSE_EFFICIENCY",
              operator:"GTE",
              threshold:0.5,
              thresholdProvenanceId:"fixture:overlap:v1",
            }],
          },
        ],
      },
    });

    expect(classification.status).toBe("UNCERTAIN");
    expect(classification.regime).toBeNull();
    expect(classification.reasons).toContain("AMBIGUOUS_REGIME_RULE_MATCH");
  });

  it("changes classification identity when threshold contents change even if a caller forgets to bump the profile version", () => {
    const measurements = computeRegimeMeasurements({
      timeframe:"M5",
      evaluatedAt:expansionBars[4].knownAt,
      bars:expansionBars,
      definition:measurementDefinition,
    });
    const first = classifyCanonicalRegime({
      assessment:measurements,
      definition:classificationDefinition,
    });
    const changedThreshold = classifyCanonicalRegime({
      assessment:measurements,
      definition:{
        ...classificationDefinition,
        rules:[{
          ...classificationDefinition.rules[0]!,
          predicates:[
            {
              ...classificationDefinition.rules[0]!.predicates[0]!,
              threshold:0.81,
            },
            classificationDefinition.rules[0]!.predicates[1]!,
          ],
        }, classificationDefinition.rules[1]!],
      },
    });
    expect(first.classificationId).not.toBe(changedThreshold.classificationId);
  });

  it("changes classification identity when the versioned profile changes", () => {
    const measurements = computeRegimeMeasurements({
      timeframe:"M5",
      evaluatedAt:expansionBars[4].knownAt,
      bars:expansionBars,
      definition:measurementDefinition,
    });
    const first = classifyCanonicalRegime({
      assessment:measurements,
      definition:classificationDefinition,
    });
    const second = classifyCanonicalRegime({
      assessment:measurements,
      definition:{
        ...classificationDefinition,
        profileVersion:"0.2.0",
      },
    });
    expect(first.classificationId).not.toBe(second.classificationId);
  });

  it("requires threshold provenance for every profile predicate", () => {
    const measurements = computeRegimeMeasurements({
      timeframe:"M5",
      evaluatedAt:expansionBars[4].knownAt,
      bars:expansionBars,
      definition:measurementDefinition,
    });
    expect(() => classifyCanonicalRegime({
      assessment:measurements,
      definition:{
        ...classificationDefinition,
        rules:[{
          ruleId:"bad",
          regime:"TRENDING",
          predicates:[{
            measurement:"CLOSE_EFFICIENCY",
            operator:"GTE",
            threshold:0.5,
            thresholdProvenanceId:"",
          }],
        }],
      },
    })).toThrow(/threshold provenance/);
  });
});
