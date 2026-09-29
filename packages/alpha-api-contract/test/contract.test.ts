import { describe, expect, it } from "vitest";
import { ALPHA_API_PATHS, ALPHA_RESPONSE_META, isAlphaResponseMeta } from "../src/index.js";

describe("alpha response meta", () => {
  it("declares validation-only, no-live-capital authority", () => {
    expect(ALPHA_RESPONSE_META).toEqual({
      releaseChannel: "private-validation-alpha",
      liveData: false,
      liveCapitalAuthority: false,
      evidenceStatus: "VALIDATION_ONLY",
      authority: "NO_LIVE_CAPITAL",
    });
    expect(Object.isFrozen(ALPHA_RESPONSE_META)).toBe(true);
  });

  it("rejects any meta that claims live data or capital authority", () => {
    expect(isAlphaResponseMeta({ ...ALPHA_RESPONSE_META })).toBe(true);
    expect(isAlphaResponseMeta({ ...ALPHA_RESPONSE_META, liveCapitalAuthority: true })).toBe(false);
    expect(isAlphaResponseMeta({ ...ALPHA_RESPONSE_META, liveData: true })).toBe(false);
    expect(isAlphaResponseMeta({ ...ALPHA_RESPONSE_META, authority: "LIVE" })).toBe(false);
    expect(isAlphaResponseMeta({ ...ALPHA_RESPONSE_META, liveData: undefined })).toBe(false);
    expect(isAlphaResponseMeta({ ...ALPHA_RESPONSE_META, executionAuthority: "LIVE" })).toBe(false);
    expect(isAlphaResponseMeta(null)).toBe(false);
  });

  it("encodes path parameters", () => {
    expect(ALPHA_API_PATHS.frameDecisionCase("a/b", 2)).toBe("/v1/alpha/scenarios/a%2Fb/frames/2");
  });
});