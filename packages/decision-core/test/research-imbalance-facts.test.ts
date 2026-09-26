import { describe, expect, it } from "vitest";
import {
  assessFvgRevisit,
  detectThreeBarFvg,
  type ResearchStructureBar,
} from "../src/index.js";

function bar(
  id: string,
  index: number,
  open: number,
  high: number,
  low: number,
  close: number,
  dataStatus: ResearchStructureBar["dataStatus"] = "FRESH_COMPLETE",
): ResearchStructureBar {
  const sourceClosedAt = new Date(Date.parse("2026-09-24T08:00:00Z") + index * 300_000).toISOString();
  return {
    evidenceId:`evidence:${id}`,
    sourceBarId:`M5:${id}`,
    open,high,low,close,
    sourceClosedAt,
    knownAt:new Date(Date.parse(sourceClosedAt)+1_000).toISOString(),
    dataStatus,
  };
}

const fvgDefinition = {
  definitionId:"fvg:wick-gap:v1",
  minimumGap:0.0001,
} as const;

const revisitDefinition = {
  definitionId:"fvg-revisit:v1",
  partialFillRule:"CLOSE_INSIDE_ZONE",
  fullFillRule:"WICK_REACH_FAR_BOUNDARY",
} as const;

describe("research FVG geometry and revisit state", () => {
  it("derives bullish FVG only after the third completed bar is known", () => {
    const first=bar("a",0,1.1000,1.1004,1.0996,1.1002);
    const middle=bar("b",1,1.1002,1.1016,1.1001,1.1014);
    const third=bar("c",2,1.1014,1.1020,1.1008,1.1018);

    const fact=detectThreeBarFvg("M5",first,middle,third,fvgDefinition);
    expect(fact?.concept).toBe("FVG");
    expect(fact?.side).toBe("BUY");
    expect(fact?.knownAt).toBe(third.knownAt);
    expect(fact?.geometry).toEqual({
      type:"ZONE",
      low:1.1004,
      high:1.1008,
      startAt:third.sourceClosedAt,
    });
    expect(fact?.authorityEffect).toBe("NONE");
  });

  it("mirrors bearish FVG geometry symmetrically", () => {
    const first=bar("a",0,1.1020,1.1024,1.1016,1.1018);
    const middle=bar("b",1,1.1018,1.1019,1.1002,1.1004);
    const third=bar("c",2,1.1004,1.1010,1.0998,1.1000);

    const fact=detectThreeBarFvg("M5",first,middle,third,fvgDefinition);
    expect(fact?.side).toBe("SELL");
    expect(fact?.geometry).toEqual({
      type:"ZONE",
      low:1.1010,
      high:1.1016,
      startAt:third.sourceClosedAt,
    });
  });

  it("fails closed on incomplete/stale/gap source bars", () => {
    for(const status of ["INCOMPLETE","STALE","GAP"] as const){
      expect(detectThreeBarFvg(
        "M5",
        bar("a",0,1.1000,1.1004,1.0996,1.1002),
        bar("b",1,1.1002,1.1016,1.1001,1.1014,status),
        bar("c",2,1.1014,1.1020,1.1008,1.1018),
        fvgDefinition,
      )).toBeNull();
    }
  });

  it("does not call a sub-threshold wick gap an FVG", () => {
    const fact=detectThreeBarFvg(
      "M5",
      bar("a",0,1.1000,1.1004,1.0996,1.1002),
      bar("b",1,1.1002,1.1009,1.1001,1.1008),
      bar("c",2,1.1008,1.1010,1.10045,1.1009),
      fvgDefinition,
    );
    expect(fact).toBeNull();
  });

  it("classifies wick-only touch, close-inside partial fill and far-boundary full fill", () => {
    const fvg=detectThreeBarFvg(
      "M5",
      bar("a",0,1.1000,1.1004,1.0996,1.1002),
      bar("b",1,1.1002,1.1016,1.1001,1.1014),
      bar("c",2,1.1014,1.1020,1.1008,1.1018),
      fvgDefinition,
    )!;

    const touch=assessFvgRevisit(fvg,bar("touch",3,1.1010,1.1012,1.1007,1.1009),revisitDefinition);
    expect(touch.status).toBe("TOUCHED");
    expect(touch.fact?.concept).toBe("FVG_TOUCH");

    const partial=assessFvgRevisit(fvg,bar("partial",4,1.1010,1.1011,1.10055,1.10065),revisitDefinition);
    expect(partial.status).toBe("PARTIAL_FILL");
    expect(partial.fact?.concept).toBe("FVG_PARTIAL_FILL");
    expect(partial.fillFraction).toBeGreaterThan(0);
    expect(partial.fillFraction).toBeLessThan(1);

    const full=assessFvgRevisit(fvg,bar("full",5,1.1008,1.1009,1.1003,1.1005),revisitDefinition);
    expect(full.status).toBe("FULL_FILL");
    expect(full.fact?.concept).toBe("FVG_FULL_FILL");
    expect(full.fillFraction).toBe(1);
  });

  it("does not let the source third bar revisit its own newly-known FVG", () => {
    const first=bar("a",0,1.1000,1.1004,1.0996,1.1002);
    const middle=bar("b",1,1.1002,1.1016,1.1001,1.1014);
    const third=bar("c",2,1.1014,1.1020,1.1008,1.1018);
    const fvg=detectThreeBarFvg("M5",first,middle,third,fvgDefinition)!;
    expect(assessFvgRevisit(fvg,third,revisitDefinition).status).toBe("UNTOUCHED");
  });
});
