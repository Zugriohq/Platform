import { describe, expect, it } from "vitest";
import {
  recheckCurrentEntry,
  type CurrentEntryRecheckInput,
  type HistoricalEntryEventRef,
  type RecheckPredicateEvidence,
} from "../src/index.js";

const event: HistoricalEntryEventRef = {
  eventId: "entry-event-1",
  confirmedAt: "2026-09-24T08:17:00Z",
  sourceBarClosedAt: "2026-09-24T08:17:00Z",
};

function predicate(name: string, ok = true): RecheckPredicateEvidence {
  return {
    ok,
    evidenceId: `evidence:${name}`,
    knownAt: "2026-09-24T08:20:00Z",
    provenanceId: `policy:${name}:v1`,
  };
}

function input(patch: Partial<CurrentEntryRecheckInput> = {}): CurrentEntryRecheckInput {
  return {
    evaluatedAt: "2026-09-24T08:20:00Z",
    quote: {
      status: "FRESH",
      quoteAt: "2026-09-24T08:19:59Z",
      evidenceId: "quote-1",
      knownAt: "2026-09-24T08:20:00Z",
    },
    entryFreshness: predicate("entry-freshness"),
    geometryCurrent: predicate("geometry"),
    costsWithinBudget: predicate("costs"),
    targetRunwayAvailable: predicate("runway"),
    continuityOk: predicate("continuity"),
    ...patch,
  };
}

describe("research current-entry recheck", () => {
  it("returns NOT_AVAILABLE when no historical entry event exists", () => {
    const result = recheckCurrentEntry(null, input());
    expect(result.status).toBe("NOT_AVAILABLE");
    expect(result.reasons).toEqual(["NO_ENTRY_EVENT"]);
  });

  it("returns CURRENT only when every independent current-condition check still passes", () => {
    const result = recheckCurrentEntry(event, input());
    expect(result.status).toBe("CURRENT");
    expect(result.reasons).toEqual(["CURRENT"]);
    expect(result.originalConfirmedAt).toBe(event.confirmedAt);
    expect(result.authority).toBe("RESEARCH_ONLY");
  });

  it.each([
    ["entryFreshness", "ENTRY_EVENT_STALE"],
    ["geometryCurrent", "GEOMETRY_NO_LONGER_CURRENT"],
    ["costsWithinBudget", "COST_BUDGET_FAILED"],
    ["targetRunwayAvailable", "TARGET_RUNWAY_FAILED"],
    ["continuityOk", "CONTINUITY_FAILED"],
  ] as const)("marks the entry stale when %s fails", (field, reason) => {
    const result = recheckCurrentEntry(event, input({
      [field]: predicate(field, false),
    }));
    expect(result.status).toBe("STALE");
    expect(result.reasons).toContain(reason);
  });

  it("marks stale/unavailable quotes explicitly", () => {
    const stale = recheckCurrentEntry(event, input({
      quote: {
        status: "STALE",
        quoteAt: "2026-09-24T08:10:00Z",
        evidenceId: "quote-stale",
        knownAt: "2026-09-24T08:20:00Z",
      },
    }));
    expect(stale.status).toBe("STALE");
    expect(stale.reasons).toContain("QUOTE_STALE");

    const unavailable = recheckCurrentEntry(event, input({
      quote: {
        status: "UNAVAILABLE",
        quoteAt: null,
        evidenceId: "quote-none",
        knownAt: "2026-09-24T08:20:00Z",
      },
    }));
    expect(unavailable.status).toBe("STALE");
    expect(unavailable.reasons).toContain("QUOTE_UNAVAILABLE");
  });

  it("a later request time cannot renew an entry whose original freshness predicate failed", () => {
    const staleFreshness = predicate("entry-freshness", false);

    const first = recheckCurrentEntry(event, input({
      entryFreshness: staleFreshness,
    }));

    const later = recheckCurrentEntry(event, input({
      evaluatedAt: "2026-09-24T09:20:00Z",
      quote: {
        status: "FRESH",
        quoteAt: "2026-09-24T09:19:59Z",
        evidenceId: "quote-later",
        knownAt: "2026-09-24T09:20:00Z",
      },
      entryFreshness: staleFreshness,
      geometryCurrent: { ...predicate("geometry"), knownAt: "2026-09-24T09:20:00Z" },
      costsWithinBudget: { ...predicate("costs"), knownAt: "2026-09-24T09:20:00Z" },
      targetRunwayAvailable: { ...predicate("runway"), knownAt: "2026-09-24T09:20:00Z" },
      continuityOk: { ...predicate("continuity"), knownAt: "2026-09-24T09:20:00Z" },
    }));

    expect(first.status).toBe("STALE");
    expect(later.status).toBe("STALE");
    expect(later.originalConfirmedAt).toBe(event.confirmedAt);
    expect(later.reasons).toContain("ENTRY_EVENT_STALE");
  });

  it("rejects future evidence rather than leaking it backward", () => {
    expect(() => recheckCurrentEntry(event, input({
      geometryCurrent: {
        ...predicate("geometry"),
        knownAt: "2026-09-24T08:21:00Z",
      },
    }))).toThrow(/future evidence/);
  });
  it("rejects future or impossible historical entry chronology", () => {
    expect(() => recheckCurrentEntry({
      eventId: "future-entry",
      confirmedAt: "2026-09-24T08:21:00Z",
      sourceBarClosedAt: "2026-09-24T08:20:00Z",
    }, input())).toThrow(/confirmedAt cannot be in the future/);

    expect(() => recheckCurrentEntry({
      eventId: "impossible-entry",
      confirmedAt: "2026-09-24T08:19:00Z",
      sourceBarClosedAt: "2026-09-24T08:20:00Z",
    }, input())).toThrow(/sourceBarClosedAt cannot follow confirmedAt/);
  });
});
