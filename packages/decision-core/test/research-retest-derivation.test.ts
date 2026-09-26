import { describe, expect, it } from "vitest";
import {
  buildResearchMarketMap,
  derivePostBreakRetest,
  observeStructuralLifecycle,
  projectMarketMapToChartScene,
  retestAssessmentToLifecycleObservation,
  type ResearchRetestDefinition,
  type ResearchStructuralBreakEvent,
  type ResearchStructureBar,
  type ResearchStrategyLens,
} from "../src/index.js";

const sameBarAllowed: ResearchRetestDefinition = {
  definitionId:"retest:close-valid:v1",
  eligibleBreakModes:["CLOSE_BEYOND"],
  touchTolerance:0.0002,
  holdTolerance:0.0001,
  maximumPenetration:0.0005,
  holdRule:"CLOSE_VALID_SIDE",
  holdTiming:"TOUCH_BAR_CLOSE_ALLOWED",
};

const laterBarRequired: ResearchRetestDefinition = {
  ...sameBarAllowed,
  definitionId:"retest:later-close:v1",
  holdTiming:"LATER_BAR_REQUIRED",
};

const lens: ResearchStrategyLens = {
  strategyId:"zugrio-core-research",
  version:"0.1.0",
  compatibleRegimes:["TRENDING","BREAKOUT","EXPANSION"],
  requiredConcepts:["BOS"],
  optionalConcepts:["RETEST"],
  entryRouteFamilies:["BOS_RETEST"],
  objectiveFamilies:["NEAREST_CREDIBLE_STRUCTURE"],
  invalidationPolicyRef:"research:structure:v1",
  authority:"RESEARCH_ONLY",
};

function breakEvent(
  direction: "UP" | "DOWN" = "UP",
): ResearchStructuralBreakEvent {
  const sourceBarEvidenceId = "evidence:break-bar";
  const levelStateEvidenceId = "evidence:level-state";
  return {
    breakId:`break:EURUSD:M5:${direction}`,
    direction,
    mode:"CLOSE_BEYOND",
    levelFactId:direction === "UP" ? "swing-high-1" : "swing-low-1",
    levelConcept:direction === "UP" ? "SWING_HIGH" : "SWING_LOW",
    scale:"EXTERNAL",
    timeframe:"M5",
    levelPrice:1.1000,
    observedPrice:direction === "UP" ? 1.1010 : 1.0990,
    sourceBarId:"m5:0800",
    sourceBarEvidenceId,
    levelStateEvidenceId,
    sourceClosedAt:"2026-09-24T08:05:00Z",
    knownAt:"2026-09-24T08:05:01Z",
    definitionId:"break:close:v1",
    sourceEvidenceIds:["evidence:pivot",levelStateEvidenceId,sourceBarEvidenceId],
    authority:"RESEARCH_ONLY",
    authorityEffect:"NONE",
  };
}

function bar(
  id: string,
  open: number,
  high: number,
  low: number,
  close: number,
  minute: number,
  status: ResearchStructureBar["dataStatus"] = "FRESH_COMPLETE",
  evidenceId = `evidence:${id}`,
): ResearchStructureBar {
  const mm=String(minute).padStart(2,"0");
  return {
    evidenceId,
    sourceBarId:id,
    open,high,low,close,
    sourceClosedAt:`2026-09-24T08:${mm}:00Z`,
    knownAt:`2026-09-24T08:${mm}:01Z`,
    dataStatus:status,
  };
}

describe("research post-break retest derivation", () => {
  it("derives a bullish post-break retest held from a later completed bar", () => {
    const result = derivePostBreakRetest({
      breakEvent:breakEvent("UP"),
      bar:bar("m5:0810",1.1010,1.1012,1.0999,1.1004,10),
      definition:sameBarAllowed,
    });

    expect(result.status).toBe("RETEST_HELD");
    expect(result.retest?.held).toBe(true);
    expect(result.retest?.direction).toBe("UP");
    expect(result.retest?.penetration).toBeCloseTo(0.0001);
    expect(result.fact?.concept).toBe("RETEST");
  });

  it("mirrors the held-retest geometry for a bearish break", () => {
    const result = derivePostBreakRetest({
      breakEvent:breakEvent("DOWN"),
      bar:bar("m5:0810",1.0990,1.1001,1.0988,1.0996,10),
      definition:sameBarAllowed,
    });

    expect(result.status).toBe("RETEST_HELD");
    expect(result.retest?.direction).toBe("DOWN");
    expect(result.fact?.side).toBe("SELL");
  });

  it("blocks the original break bar from becoming its own retest", () => {
    const source = breakEvent("UP");
    const result = derivePostBreakRetest({
      breakEvent:source,
      bar:{
        evidenceId:"evidence:later-request",
        sourceBarId:source.sourceBarId,
        open:1.099,high:1.101,low:1.099,close:1.1002,
        sourceClosedAt:source.sourceClosedAt,
        knownAt:"2026-09-24T08:20:00Z",
        dataStatus:"FRESH_COMPLETE",
      },
      definition:sameBarAllowed,
    });

    expect(result.status).toBe("NO_RETEST");
    expect(result.reasons).toContain("BAR_NOT_AFTER_BREAK");
  });

  it("supports touch now, hold on a strictly later bar when the profile requires it", () => {
    const source = breakEvent("UP");
    const touch = derivePostBreakRetest({
      breakEvent:source,
      bar:bar("m5:0810",1.1010,1.1011,1.0999,1.1004,10),
      definition:laterBarRequired,
    });
    expect(touch.status).toBe("RETEST_TOUCHED");

    const hold = derivePostBreakRetest({
      breakEvent:source,
      bar:bar("m5:0815",1.1005,1.1012,1.1003,1.1008,15),
      definition:laterBarRequired,
      priorTouch:touch.retest,
    });
    expect(hold.status).toBe("RETEST_HELD");
    expect(hold.retest?.touchedOnThisBar).toBe(false);
    expect(hold.retest?.priorTouchId).toBe(touch.retest?.retestId);
  });

  it("records a physical touch without claiming a held retest when the close fails", () => {
    const result = derivePostBreakRetest({
      breakEvent:breakEvent("UP"),
      bar:bar("m5:0810",1.1010,1.1011,1.0996,1.0997,10),
      definition:sameBarAllowed,
    });

    expect(result.status).toBe("RETEST_TOUCH_FAILED_HOLD");
    expect(result.retest?.held).toBe(false);
    expect(result.reasons).toContain("HOLD_CLOSE_FAILED");
  });

  it("does not count excessive penetration as held even when price recovers by close", () => {
    const result = derivePostBreakRetest({
      breakEvent:breakEvent("UP"),
      bar:bar("m5:0810",1.1010,1.1012,1.0990,1.1004,10),
      definition:sameBarAllowed,
    });

    expect(result.status).toBe("RETEST_TOUCH_FAILED_HOLD");
    expect(result.retest?.penetrationWithinLimit).toBe(false);
    expect(result.reasons).toContain("MAX_PENETRATION_EXCEEDED");
  });

  it.each([
    ["INCOMPLETE","BAR_NOT_CLOSED"],
    ["STALE","DATA_STALE"],
    ["GAP","DATA_GAP"],
  ] as const)("does not confirm a retest from %s evidence", (status, reason) => {
    const result = derivePostBreakRetest({
      breakEvent:breakEvent("UP"),
      bar:bar("m5:0810",1.1010,1.1012,1.0999,1.1004,10,status),
      definition:sameBarAllowed,
    });
    expect(result.status).toBe("NO_RETEST");
    expect(result.reasons).toContain(reason);
  });

  it("cannot renew stale evidence by changing only when the caller looks at it", () => {
    const stale = bar("m5:0810",1.1010,1.1012,1.0999,1.1004,10,"STALE","immutable:stale-bar");
    const first = derivePostBreakRetest({
      breakEvent:breakEvent("UP"),
      bar:stale,
      definition:sameBarAllowed,
    });
    const laterRequestView = derivePostBreakRetest({
      breakEvent:breakEvent("UP"),
      bar:{...stale, knownAt:"2026-09-24T09:00:00Z"},
      definition:sameBarAllowed,
    });
    expect(first.status).toBe("NO_RETEST");
    expect(laterRequestView.status).toBe("NO_RETEST");
    expect(laterRequestView.reasons).toContain("DATA_STALE");
  });

  it("binds retest identity to immutable evidence rather than only the candle slot", () => {
    const source = breakEvent("UP");
    const firstBar = bar("m5:0810",1.1010,1.1012,1.0999,1.1004,10,"FRESH_COMPLETE","snapshot:1");
    const correctedBar = {...firstBar,evidenceId:"snapshot:2",low:1.0998};

    const first = derivePostBreakRetest({breakEvent:source,bar:firstBar,definition:sameBarAllowed});
    const second = derivePostBreakRetest({breakEvent:source,bar:correctedBar,definition:sameBarAllowed});

    expect(first.retest?.sourceBarId).toBe(second.retest?.sourceBarId);
    expect(first.retest?.retestId).not.toBe(second.retest?.retestId);
  });

  it("keeps later retest IDs bounded by a fixed touch anchor instead of recursively embedding prior IDs", () => {
    const source = breakEvent("UP");
    const touch = derivePostBreakRetest({
      breakEvent:source,
      bar:bar("m5:0810",1.1010,1.1011,1.0999,1.1004,10),
      definition:laterBarRequired,
    });
    const failedHold = derivePostBreakRetest({
      breakEvent:source,
      bar:bar("m5:0815",1.1005,1.1010,1.0997,1.0998,15),
      definition:laterBarRequired,
      priorTouch:touch.retest,
    });
    const held = derivePostBreakRetest({
      breakEvent:source,
      bar:bar("m5:0820",1.1006,1.1012,1.1003,1.1009,20),
      definition:laterBarRequired,
      priorTouch:failedHold.retest,
    });

    expect(touch.retest?.touchAnchorEvidenceId).toBe("evidence:m5:0810");
    expect(failedHold.retest?.touchAnchorEvidenceId).toBe(touch.retest?.touchAnchorEvidenceId);
    expect(held.retest?.touchAnchorEvidenceId).toBe(touch.retest?.touchAnchorEvidenceId);
    expect(held.retest?.retestId).not.toContain(failedHold.retest?.retestId ?? "impossible");
  });

  it("rejects forged or cross-break prior-touch provenance", () => {
    const source = breakEvent("UP");
    const touch = derivePostBreakRetest({
      breakEvent:source,
      bar:bar("m5:0810",1.1010,1.1011,1.0999,1.1004,10),
      definition:laterBarRequired,
    });
    const next = bar("m5:0815",1.1005,1.1012,1.1003,1.1008,15);

    expect(() => derivePostBreakRetest({
      breakEvent:source,
      bar:next,
      definition:laterBarRequired,
      priorTouch:{
        ...touch.retest!,
        direction:"DOWN",
      },
    })).toThrow(/different break\/definition/);

    expect(() => derivePostBreakRetest({
      breakEvent:source,
      bar:next,
      definition:laterBarRequired,
      priorTouch:{
        ...touch.retest!,
        sourceEvidenceIds:touch.retest!.sourceEvidenceIds.filter(
          id => id !== touch.retest!.touchAnchorEvidenceId,
        ),
      },
    })).toThrow(/provenance roles must be present/);
  });

  it("rejects malformed bar identities and malformed runtime profile enums", () => {
    expect(() => derivePostBreakRetest({
      breakEvent:breakEvent("UP"),
      bar:{...bar("m5:0810",1.1010,1.1012,1.0999,1.1004,10),evidenceId:""},
      definition:sameBarAllowed,
    })).toThrow(/immutable evidenceId/);

    expect(() => derivePostBreakRetest({
      breakEvent:breakEvent("UP"),
      bar:bar("m5:0810",1.1010,1.1012,1.0999,1.1004,10),
      definition:{...sameBarAllowed,holdTiming:"UNKNOWN" as never},
    })).toThrow(/unsupported retest hold timing/);
  });

  it("is deterministic for the same break, evidence and definition", () => {
    const input = {
      breakEvent:breakEvent("UP"),
      bar:bar("m5:0810",1.1010,1.1012,1.0999,1.1004,10),
      definition:sameBarAllowed,
    } as const;
    expect(derivePostBreakRetest(input)).toEqual(derivePostBreakRetest(input));
  });

  it("bridges derived touch/hold evidence into the lifecycle observer without hand-fed booleans", () => {
    const source = breakEvent("UP");
    const touch = derivePostBreakRetest({
      breakEvent:source,
      bar:bar("m5:0810",1.1010,1.1011,1.0999,1.1004,10),
      definition:laterBarRequired,
    });
    const hold = derivePostBreakRetest({
      breakEvent:source,
      bar:bar("m5:0815",1.1005,1.1012,1.1002,1.1008,15),
      definition:laterBarRequired,
      priorTouch:touch.retest,
    });

    const touchObservation = retestAssessmentToLifecycleObservation(touch);
    const holdObservation = retestAssessmentToLifecycleObservation(hold);
    expect(touchObservation).not.toBeNull();
    expect(holdObservation).not.toBeNull();

    const lifecycle = observeStructuralLifecycle({
      candidateId:"candidate:bos-retest-1",
      setupIdentity:"EURUSD:M5:BOS_RETEST:0805",
      setupType:"BOS_RETEST",
      side:"BUY",
      breakEvidenceId:source.sourceBarEvidenceId,
      breakSourceBarId:source.sourceBarId,
      breakSourceClosedAt:source.sourceClosedAt,
      breakKnownAt:source.knownAt,
      continuationReferenceEnabled:false,
    }, [touchObservation!,holdObservation!]);

    expect(lifecycle.routeState.retest).toBe("RETEST_HELD");
    expect(lifecycle.lifecycle).toBe("RETEST_HELD");
    expect(lifecycle.trace.some(event => event.reasonCode === "RETEST_TOUCHED")).toBe(true);
    expect(lifecycle.trace.some(event => event.reasonCode === "RETEST_HELD")).toBe(true);
  });

  it("projects the engine-derived retest fact through the market map into the chart scene", () => {
    const result = derivePostBreakRetest({
      breakEvent:breakEvent("UP"),
      bar:bar("m5:0810",1.1010,1.1012,1.0999,1.1004,10),
      definition:sameBarAllowed,
    });

    const map=buildResearchMarketMap({
      mapId:"map-retest",
      instrument:"EURUSD",
      timeframe:"M5",
      evaluatedAt:"2026-09-24T08:11:00Z",
      regime:null,
      facts:[result.fact!],
      strategyLens:lens,
    });
    const scene=projectMarketMapToChartScene(map);
    const primitive=scene.primitives.find(item=>item.concept==="RETEST");

    expect(primitive?.layer).toBe("SETUP");
    expect(primitive?.sourceFactIds).toEqual([result.fact?.factId]);
    expect(primitive?.authorityEffect).toBe("NONE");
  });
});
