import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  observeCandidateSet,
  observeStructuralLifecycle,
  type ResearchBreakSeed,
  type ResearchLifecycleObservation,
} from "../src/index.js";

const seed: ResearchBreakSeed = {
  candidateId: "candidate:eurusd:m5:buy:bos-1",
  setupIdentity: "EURUSD:M5:BOS_RETEST:2026-09-24T08:00:00Z",
  setupType: "BOS_RETEST",
  side: "BUY",
  breakEvidenceId: "break-1",
  breakSourceBarId: "m5:0800",
  breakSourceClosedAt: "2026-09-24T08:05:00Z",
  breakKnownAt: "2026-09-24T08:05:01Z",
  continuationReferenceEnabled: false,
};

function observation(
  evidenceId: string,
  sourceBarId: string,
  sourceClosedAt: string,
  knownAt: string,
  patch: Partial<ResearchLifecycleObservation> = {},
): ResearchLifecycleObservation {
  return {
    evidenceId,
    sourceBarId,
    sourceClosedAt,
    knownAt,
    dataStatus: "FRESH_COMPLETE",
    ...patch,
  };
}

describe("research structural lifecycle observer", () => {
  it("never lets the break bar double as its own retest/confirmation", () => {
    const result = observeStructuralLifecycle(seed, [
      observation("same-bar", "m5:0800", "2026-09-24T08:05:00Z", "2026-09-24T08:05:10Z", {
        retestTouched: true,
        retestHeld: true,
        confirmRoute: "RETEST",
      }),
    ]);

    expect(result.lifecycle).toBe("BREAK_CONFIRMED");
    expect(result.confirmedRoute).toBeNull();
    expect(result.trace.some(event => event.reasonCode === "BREAK_BAR_CANNOT_CONFIRM")).toBe(true);
  });

  it("captures a later retest causally and can confirm the retest route", () => {
    const result = observeStructuralLifecycle(seed, [
      observation("touch", "m5:0805", "2026-09-24T08:10:00Z", "2026-09-24T08:10:01Z", {
        retestTouched: true,
      }),
      observation("hold", "m5:0810", "2026-09-24T08:15:00Z", "2026-09-24T08:15:01Z", {
        retestHeld: true,
      }),
      observation("confirm", "m5:0815", "2026-09-24T08:20:00Z", "2026-09-24T08:20:01Z", {
        confirmRoute: "RETEST",
      }),
    ]);

    expect(result.lifecycle).toBe("LIFECYCLE_CONFIRMED");
    expect(result.confirmedRoute).toBe("RETEST");
    expect(result.routeState.retest).toBe("RETEST_HELD");
    expect(result.authority).toBe("RESEARCH_ONLY");
    expect(result.liveCapitalAuthority).toBe(false);
  });

  it("does not make retest mandatory: continuation is observable only when explicitly enabled for research", () => {
    const disabled = observeStructuralLifecycle(seed, [
      observation("cont", "m5:0805", "2026-09-24T08:10:00Z", "2026-09-24T08:10:01Z", {
        continuationHeld: true,
        confirmRoute: "CONTINUATION",
      }),
    ]);

    expect(disabled.lifecycle).toBe("BREAK_CONFIRMED");
    expect(disabled.trace.some(event => event.reasonCode === "CONTINUATION_ROUTE_DISABLED")).toBe(true);

    const researchSeed = { ...seed, candidateId: "candidate:continuation", continuationReferenceEnabled: true };
    const enabled = observeStructuralLifecycle(researchSeed, [
      observation("cont-held", "m5:0805", "2026-09-24T08:10:00Z", "2026-09-24T08:10:01Z", {
        continuationHeld: true,
      }),
      observation("cont-confirm", "m5:0810", "2026-09-24T08:15:00Z", "2026-09-24T08:15:01Z", {
        confirmRoute: "CONTINUATION",
      }),
    ]);

    expect(enabled.lifecycle).toBe("LIFECYCLE_CONFIRMED");
    expect(enabled.confirmedRoute).toBe("CONTINUATION");
    expect(enabled.routeState.continuation).toBe("CONTINUATION_HELD");
  });

  it("has no hidden eight-bar or candle-count expiry", () => {
    const observations = Array.from({ length: 40 }, (_, index) =>
      observation(
        `quiet-${index}`,
        `m5:${index + 1}`,
        new Date(Date.parse("2026-09-24T08:10:00Z") + index * 300_000).toISOString(),
        new Date(Date.parse("2026-09-24T08:10:01Z") + index * 300_000).toISOString(),
      ),
    );

    const result = observeStructuralLifecycle(seed, observations);
    expect(result.lifecycle).toBe("BREAK_CONFIRMED");
    expect(result.terminal).toBeNull();
    expect(result.trace.some(event => event.reasonCode === "EXPIRED")).toBe(false);
  });

  it("expires only from explicit policy evidence and never resurrects afterward", () => {
    const result = observeStructuralLifecycle(seed, [
      observation("expiry", "clock:1", "2026-09-24T08:10:00Z", "2026-09-24T08:10:01Z", { expired: true }),
      observation("late-touch", "m5:0810", "2026-09-24T08:15:00Z", "2026-09-24T08:15:01Z", {
        retestTouched: true,
        retestHeld: true,
        confirmRoute: "RETEST",
      }),
    ]);

    expect(result.lifecycle).toBe("EXPIRED");
    expect(result.terminal).toBe("EXPIRED");
    expect(result.trace.at(-1)?.reasonCode).toBe("TERMINAL_PRESERVED");
  });

  it("does not renew stale or incomplete evidence merely because the request arrived later", () => {
    const result = observeStructuralLifecycle(seed, [
      observation("stale-retest", "m5:0805", "2026-09-24T08:10:00Z", "2026-09-24T09:00:00Z", {
        dataStatus: "STALE",
        retestTouched: true,
        retestHeld: true,
        confirmRoute: "RETEST",
      }),
      observation("forming-bar", "m5:0810", "2026-09-24T08:15:00Z", "2026-09-24T08:14:30Z", {
        dataStatus: "INCOMPLETE",
        retestTouched: true,
      }),
    ]);

    expect(result.lifecycle).toBe("BREAK_CONFIRMED");
    expect(result.trace.some(event => event.reasonCode === "DATA_STALE")).toBe(true);
    expect(result.trace.some(event => event.reasonCode === "BAR_NOT_CLOSED")).toBe(true);
  });

  it("preserves every distinct candidate so a failed first candidate cannot hide a valid second one", () => {
    const invalidSeed = { ...seed, candidateId: "a-invalid" };
    const validSeed = { ...seed, candidateId: "b-valid" };

    const results = observeCandidateSet([
      {
        seed: invalidSeed,
        observations: [
          observation("invalidate-a", "m5:0805", "2026-09-24T08:10:00Z", "2026-09-24T08:10:01Z", {
            invalidated: true,
          }),
        ],
      },
      {
        seed: validSeed,
        observations: [
          observation("touch-b", "m5:0805", "2026-09-24T08:10:00Z", "2026-09-24T08:10:01Z", {
            retestTouched: true,
            retestHeld: true,
          }),
          observation("confirm-b", "m5:0810", "2026-09-24T08:15:00Z", "2026-09-24T08:15:01Z", {
            confirmRoute: "RETEST",
          }),
        ],
      },
    ]);

    expect(results).toHaveLength(2);
    expect(results.find(item => item.candidateId === "a-invalid")?.lifecycle).toBe("INVALIDATED");
    expect(results.find(item => item.candidateId === "b-valid")?.lifecycle).toBe("LIFECYCLE_CONFIRMED");
  });

  it("keeps BUY and SELL intelligence candidates independent", () => {
    const results = observeCandidateSet([
      { seed: { ...seed, candidateId: "buy", side: "BUY" }, observations: [] },
      { seed: { ...seed, candidateId: "sell", side: "SELL" }, observations: [] },
    ]);

    expect(results.map(item => item.side)).toEqual(["BUY", "SELL"]);
  });

  it("refuses duplicate candidate identities instead of overwriting one", () => {
    expect(() => observeCandidateSet([
      { seed, observations: [] },
      { seed: { ...seed }, observations: [] },
    ])).toThrow(/duplicate candidateId/);
  });

  it("is deterministic regardless of observation input ordering", () => {
    const observations = [
      observation("touch", "m5:0805", "2026-09-24T08:10:00Z", "2026-09-24T08:10:01Z", { retestTouched: true }),
      observation("hold", "m5:0810", "2026-09-24T08:15:00Z", "2026-09-24T08:15:01Z", { retestHeld: true }),
      observation("confirm", "m5:0815", "2026-09-24T08:20:00Z", "2026-09-24T08:20:01Z", { confirmRoute: "RETEST" }),
    ] as const;

    fc.assert(fc.property(
      fc.shuffledSubarray([...observations], { minLength: observations.length, maxLength: observations.length }),
      (shuffled) => {
        expect(observeStructuralLifecycle(seed, shuffled)).toEqual(
          observeStructuralLifecycle(seed, observations),
        );
      },
    ));
  });
});
