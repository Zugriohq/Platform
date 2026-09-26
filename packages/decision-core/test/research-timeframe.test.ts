import { describe, expect, it } from "vitest";
import {
  assessRequiredTimeframes,
  type TimeframeEvidencePoint,
} from "../src/index.js";

function point(
  timeframe: string,
  status: TimeframeEvidencePoint["status"],
  knownAt = "2026-09-24T08:20:00Z",
  id = `${timeframe}:${status}`,
): TimeframeEvidencePoint {
  return {
    timeframe,
    status,
    evidenceId: id,
    sourceClosedAt: "2026-09-24T08:20:00Z",
    knownAt,
  };
}

describe("research timeframe evidence gate", () => {
  it("checks only profile-declared timeframes, so missing monthly evidence cannot universally suppress an intraday scope", () => {
    const result = assessRequiredTimeframes(
      "2026-09-24T08:20:00Z",
      ["M5", "M15"],
      [
        point("M5", "FRESH_COMPLETE"),
        point("M15", "FRESH_COMPLETE"),
      ],
    );

    expect(result.status).toBe("AVAILABLE");
    expect(result.reasons).toEqual([]);
    expect(result.requiredTimeframes).toEqual(["M5", "M15"]);
  });

  it.each([
    ["INCOMPLETE", "REQUIRED_TIMEFRAME_INCOMPLETE"],
    ["STALE", "REQUIRED_TIMEFRAME_STALE"],
    ["GAP", "REQUIRED_TIMEFRAME_GAP"],
  ] as const)("fails closed when a required timeframe is %s", (status, code) => {
    const result = assessRequiredTimeframes(
      "2026-09-24T08:20:00Z",
      ["M5", "M15"],
      [point("M5", "FRESH_COMPLETE"), point("M15", status)],
    );

    expect(result.status).toBe("UNAVAILABLE");
    expect(result.reasons).toContainEqual({ timeframe: "M15", code });
  });

  it("fails closed when a required timeframe is missing", () => {
    const result = assessRequiredTimeframes(
      "2026-09-24T08:20:00Z",
      ["M5", "M15"],
      [point("M5", "FRESH_COMPLETE")],
    );

    expect(result.status).toBe("UNAVAILABLE");
    expect(result.reasons).toContainEqual({
      timeframe: "M15",
      code: "REQUIRED_TIMEFRAME_MISSING",
    });
  });

  it("does not leak a future refresh backward", () => {
    const result = assessRequiredTimeframes(
      "2026-09-24T08:20:00Z",
      ["M15"],
      [
        point("M15", "STALE", "2026-09-24T08:19:00Z", "m15-old"),
        point("M15", "FRESH_COMPLETE", "2026-09-24T08:21:00Z", "m15-future"),
      ],
    );

    expect(result.status).toBe("UNAVAILABLE");
    expect(result.usedEvidenceIds).toEqual(["m15-old"]);
    expect(result.reasons).toContainEqual({
      timeframe: "M15",
      code: "REQUIRED_TIMEFRAME_STALE",
    });
  });

  it("deduplicates repeated declared timeframes instead of double-gating them", () => {
    const result = assessRequiredTimeframes(
      "2026-09-24T08:20:00Z",
      ["M5", "M5", "M15"],
      [point("M5", "FRESH_COMPLETE"), point("M15", "FRESH_COMPLETE")],
    );

    expect(result.status).toBe("AVAILABLE");
    expect(result.requiredTimeframes).toEqual(["M5", "M15"]);
  });
});
