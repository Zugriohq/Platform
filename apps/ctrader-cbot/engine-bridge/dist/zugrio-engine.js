"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // src/structured-clone-polyfill.js
  if (typeof globalThis.structuredClone !== "function") {
    globalThis.structuredClone = function zugrioPlainClone(v) {
      if (v === null || typeof v !== "object") {
        if (typeof v === "function" || typeof v === "symbol") throw new TypeError("structuredClone: unsupported " + typeof v);
        return v;
      }
      if (Array.isArray(v)) return v.map(zugrioPlainClone);
      const proto = Object.getPrototypeOf(v);
      if (proto !== Object.prototype && proto !== null) throw new TypeError("structuredClone: only plain objects and arrays are supported");
      const out = {};
      for (const k of Object.keys(v)) out[k] = zugrioPlainClone(v[k]);
      return out;
    };
  }

  // ../../../packages/decision-core/dist/research/canonicalJson.js
  function canonicalJson(value) {
    if (Array.isArray(value))
      return `[${value.map(canonicalJson).join(",")}]`;
    if (value !== null && typeof value === "object") {
      const record = value;
      return `{${Object.keys(record).filter((key) => record[key] !== void 0).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
    }
    return JSON.stringify(value);
  }
  function sameJson(a, b) {
    return canonicalJson(a) === canonicalJson(b);
  }
  function dedupeById(items, idOf, label) {
    const byId = /* @__PURE__ */ new Map();
    for (const item of items) {
      const id = idOf(item);
      const existing = byId.get(id);
      if (existing === void 0) {
        byId.set(id, item);
        continue;
      }
      if (!sameJson(existing, item))
        throw new Error(`conflicting ${label} payloads share id: ${id}`);
    }
    return [...byId.values()];
  }

  // ../../../packages/decision-core/dist/research/marketMap.js
  var MARKET_STRUCTURE_CONCEPTS = [
    "SWING_HIGH",
    "SWING_LOW",
    "EQUAL_HIGHS",
    "EQUAL_LOWS",
    "BOS",
    "CHOCH",
    "MSS",
    "TRENDLINE_SUPPORT",
    "TRENDLINE_RESISTANCE",
    "TRENDLINE_TOUCH",
    "TRENDLINE_PENETRATION",
    "TRENDLINE_BREAK",
    "CHANNEL_SUPPORT",
    "CHANNEL_RESISTANCE",
    "LIQUIDITY_SWEEP",
    "FAKEOUT",
    "INDUCEMENT",
    "DISPLACEMENT",
    "FVG",
    "FVG_TOUCH",
    "FVG_PARTIAL_FILL",
    "FVG_FULL_FILL",
    "ORDER_BLOCK",
    "BREAKER_BLOCK",
    "MITIGATION_BLOCK",
    "MITIGATION",
    "RANGE_HIGH",
    "RANGE_LOW",
    "BREAKOUT",
    "RETEST",
    "CONTINUATION",
    "DOUBLE_TOP",
    "DOUBLE_BOTTOM",
    "HEAD_AND_SHOULDERS",
    "INVERSE_HEAD_AND_SHOULDERS",
    "RISING_WEDGE",
    "FALLING_WEDGE",
    "ASCENDING_TRIANGLE",
    "DESCENDING_TRIANGLE",
    "SYMMETRICAL_TRIANGLE",
    "FLAG",
    "PENNANT",
    "DOJI",
    "HAMMER",
    "SHOOTING_STAR",
    "BULLISH_ENGULFING",
    "BEARISH_ENGULFING",
    "INSIDE_BAR",
    "OUTSIDE_BAR",
    "MORNING_STAR",
    "EVENING_STAR",
    "THREE_WHITE_SOLDIERS",
    "THREE_BLACK_CROWS",
    "ELLIOTT_WAVE"
  ];
  var RESEARCH_DERIVED_CEILING_CONCEPTS = [
    "TRENDLINE_SUPPORT",
    "TRENDLINE_RESISTANCE",
    "TRENDLINE_TOUCH",
    "TRENDLINE_PENETRATION",
    "TRENDLINE_BREAK"
  ];
  function exceedsConceptMaturityCeiling(concept, maturity) {
    return RESEARCH_DERIVED_CEILING_CONCEPTS.includes(concept) && maturity === "DETERMINISTIC_FACT";
  }
  function priceComparisonSlack(...values) {
    return 1e-12 * Math.max(1, ...values.map((value) => Math.abs(value)));
  }
  function epoch(value, label) {
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed))
      throw new Error(`${label} is not a valid ISO timestamp: ${value}`);
    return parsed;
  }
  function validateResearchStructureBar(bar) {
    for (const [label, value] of Object.entries({
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close
    })) {
      if (!Number.isFinite(value))
        throw new Error(`${label} must be finite`);
    }
    if (bar.low > bar.high)
      throw new Error("bar.low cannot exceed bar.high");
    if (bar.high < Math.max(bar.open, bar.close) || bar.low > Math.min(bar.open, bar.close)) {
      throw new Error("OHLC bar is internally inconsistent");
    }
    const sourceClosedAt = epoch(bar.sourceClosedAt, "sourceClosedAt");
    const knownAt = epoch(bar.knownAt, "knownAt");
    if (bar.dataStatus !== "INCOMPLETE" && knownAt < sourceClosedAt) {
      throw new Error(`closed bar evidence cannot be known before source close: ${bar.sourceBarId}`);
    }
  }
  function validateDefinition(definition) {
    if (!definition.definitionId)
      throw new Error("pivot definitionId must be non-empty");
    if (!Number.isInteger(definition.leftBars) || definition.leftBars < 1) {
      throw new Error("leftBars must be an integer >= 1");
    }
    if (!Number.isInteger(definition.rightBars) || definition.rightBars < 1) {
      throw new Error("rightBars must be an integer >= 1");
    }
  }
  function oneSlotPerSourceBar(bars3) {
    const versionsById = /* @__PURE__ */ new Map();
    for (const bar of bars3) {
      const versions = versionsById.get(bar.sourceBarId) ?? [];
      versions.push(bar);
      versionsById.set(bar.sourceBarId, versions);
    }
    const slots = [];
    for (const [sourceBarId, versions] of versionsById) {
      const [first] = versions;
      if (!first)
        continue;
      if (versions.length === 1) {
        slots.push(first);
        continue;
      }
      if (versions.some((bar) => bar.dataStatus !== "FRESH_COMPLETE" && bar.dataStatus !== "INCOMPLETE")) {
        throw new Error(`duplicate sourceBarId: ${sourceBarId}`);
      }
      const closedAt = epoch(first.sourceClosedAt, "sourceClosedAt");
      if (versions.some((bar) => epoch(bar.sourceClosedAt, "sourceClosedAt") !== closedAt)) {
        throw new Error(`conflicting sourceClosedAt for sourceBarId: ${sourceBarId}`);
      }
      const [completed] = dedupeById(versions.filter((bar) => bar.dataStatus === "FRESH_COMPLETE"), (bar) => bar.sourceBarId, "completed source bar");
      slots.push(completed ?? first);
    }
    return slots;
  }
  function detectConfirmedPivots(timeframe, bars3, definitions) {
    if (!timeframe.trim())
      throw new Error("timeframe must be non-empty");
    for (const bar of bars3)
      validateResearchStructureBar(bar);
    for (const definition of definitions)
      validateDefinition(definition);
    const ordered = oneSlotPerSourceBar(bars3).sort((a, b) => {
      const byClose = epoch(a.sourceClosedAt, "sourceClosedAt") - epoch(b.sourceClosedAt, "sourceClosedAt");
      if (byClose !== 0)
        return byClose;
      return a.sourceBarId.localeCompare(b.sourceBarId);
    });
    const facts = [];
    for (const definition of definitions) {
      const { leftBars, rightBars } = definition;
      for (let index = leftBars; index < ordered.length - rightBars; index += 1) {
        const source = ordered[index];
        if (!source)
          continue;
        const window = ordered.slice(index - leftBars, index + rightBars + 1);
        if (window.length !== leftBars + rightBars + 1)
          continue;
        if (window.some((bar) => bar.dataStatus !== "FRESH_COMPLETE"))
          continue;
        const left = ordered.slice(index - leftBars, index);
        const right = ordered.slice(index + 1, index + rightBars + 1);
        const confirmingBar = ordered[index + rightBars];
        if (!confirmingBar)
          continue;
        const highConfirmed = left.every((bar) => source.high >= bar.high) && right.every((bar) => source.high > bar.high);
        const lowConfirmed = left.every((bar) => source.low <= bar.low) && right.every((bar) => source.low < bar.low);
        const sourceEvidenceIds = window.map((bar) => bar.evidenceId);
        const knownAt = window.reduce((latest, bar) => epoch(bar.knownAt, "knownAt") > epoch(latest, "knownAt") ? bar.knownAt : latest, confirmingBar.knownAt);
        if (highConfirmed) {
          facts.push({
            factId: `pivot:${definition.definitionId}:${source.sourceBarId}:high`,
            concept: "SWING_HIGH",
            maturity: "DETERMINISTIC_FACT",
            scale: definition.scale,
            timeframe,
            side: "SELL",
            knownAt,
            definitionId: definition.definitionId,
            sourceEvidenceIds,
            geometry: {
              type: "POINT",
              time: source.sourceClosedAt,
              price: source.high
            },
            label: `${definition.scale} SWING HIGH`,
            authority: "RESEARCH_ONLY",
            authorityEffect: "NONE"
          });
        }
        if (lowConfirmed) {
          facts.push({
            factId: `pivot:${definition.definitionId}:${source.sourceBarId}:low`,
            concept: "SWING_LOW",
            maturity: "DETERMINISTIC_FACT",
            scale: definition.scale,
            timeframe,
            side: "BUY",
            knownAt,
            definitionId: definition.definitionId,
            sourceEvidenceIds,
            geometry: {
              type: "POINT",
              time: source.sourceClosedAt,
              price: source.low
            },
            label: `${definition.scale} SWING LOW`,
            authority: "RESEARCH_ONLY",
            authorityEffect: "NONE"
          });
        }
      }
    }
    return facts.sort((a, b) => {
      const byKnownAt = epoch(a.knownAt, "knownAt") - epoch(b.knownAt, "knownAt");
      if (byKnownAt !== 0)
        return byKnownAt;
      return a.factId.localeCompare(b.factId);
    });
  }
  function buildTrendlineCandidateFromPivots(first, second, definition) {
    if (!definition.definitionId)
      throw new Error("trendline definitionId must be non-empty");
    if (!Number.isFinite(definition.minimumAnchorSeparationMs) || definition.minimumAnchorSeparationMs < 0) {
      throw new Error("minimumAnchorSeparationMs must be finite and >= 0");
    }
    if (first.concept !== second.concept)
      return null;
    if (first.concept !== "SWING_HIGH" && first.concept !== "SWING_LOW")
      return null;
    if (first.maturity !== "DETERMINISTIC_FACT" || second.maturity !== "DETERMINISTIC_FACT")
      return null;
    if (first.scale !== second.scale || first.timeframe !== second.timeframe)
      return null;
    if (first.geometry.type !== "POINT" || second.geometry.type !== "POINT")
      return null;
    const firstTime = epoch(first.geometry.time, "first.geometry.time");
    const secondTime = epoch(second.geometry.time, "second.geometry.time");
    if (secondTime <= firstTime)
      return null;
    if (secondTime - firstTime < definition.minimumAnchorSeparationMs)
      return null;
    if (firstTime > epoch(first.knownAt, "first.knownAt") || secondTime > epoch(second.knownAt, "second.knownAt")) {
      return null;
    }
    const side = first.concept === "SWING_LOW" ? "SUPPORT" : "RESISTANCE";
    return {
      candidateId: `trendline-candidate:${definition.definitionId}:${first.factId}:${second.factId}`,
      side,
      scale: first.scale,
      timeframe: first.timeframe,
      definitionId: definition.definitionId,
      anchorFactIds: [first.factId, second.factId],
      anchorEvidenceIds: [.../* @__PURE__ */ new Set([...first.sourceEvidenceIds, ...second.sourceEvidenceIds])],
      knownAt: epoch(first.knownAt, "first.knownAt") >= epoch(second.knownAt, "second.knownAt") ? first.knownAt : second.knownAt,
      geometry: {
        type: "PATH",
        points: [
          { time: first.geometry.time, price: first.geometry.price },
          { time: second.geometry.time, price: second.geometry.price }
        ]
      },
      authority: "RESEARCH_ONLY"
    };
  }
  function confirmTrendlineWithPivot(candidate, confirmingPivot, definition) {
    if (!definition.definitionId)
      throw new Error("trendline confirmation definitionId must be non-empty");
    if (!Number.isFinite(definition.anchorTolerance) || definition.anchorTolerance < 0) {
      throw new Error("anchorTolerance must be finite and >= 0");
    }
    if (confirmingPivot.geometry.type !== "POINT")
      return null;
    if (confirmingPivot.maturity !== "DETERMINISTIC_FACT")
      return null;
    if (confirmingPivot.scale !== candidate.scale || confirmingPivot.timeframe !== candidate.timeframe)
      return null;
    const requiredConcept = candidate.side === "SUPPORT" ? "SWING_LOW" : "SWING_HIGH";
    if (confirmingPivot.concept !== requiredConcept)
      return null;
    const first = candidate.geometry.points[0];
    const second = candidate.geometry.points[1];
    if (!first || !second)
      return null;
    const firstTime = epoch(first.time, "trendline first anchor time");
    const secondTime = epoch(second.time, "trendline second anchor time");
    const thirdTime = epoch(confirmingPivot.geometry.time, "confirming pivot time");
    if (thirdTime <= secondTime)
      return null;
    if (thirdTime > epoch(confirmingPivot.knownAt, "confirmingPivot.knownAt"))
      return null;
    const slope = (second.price - first.price) / (secondTime - firstTime);
    const expected = first.price + slope * (thirdTime - firstTime);
    const slack = priceComparisonSlack(confirmingPivot.geometry.price, expected, first.price, second.price);
    if (Math.abs(confirmingPivot.geometry.price - expected) > definition.anchorTolerance + slack)
      return null;
    const concept = candidate.side === "SUPPORT" ? "TRENDLINE_SUPPORT" : "TRENDLINE_RESISTANCE";
    return {
      factId: `trendline:${definition.definitionId}:${candidate.candidateId}:${confirmingPivot.factId}`,
      concept,
      maturity: "RESEARCH_DERIVED",
      scale: candidate.scale,
      timeframe: candidate.timeframe,
      side: candidate.side === "SUPPORT" ? "BUY" : "SELL",
      knownAt: epoch(candidate.knownAt, "candidate.knownAt") >= epoch(confirmingPivot.knownAt, "confirmingPivot.knownAt") ? candidate.knownAt : confirmingPivot.knownAt,
      definitionId: definition.definitionId,
      sourceFactIds: [...candidate.anchorFactIds, confirmingPivot.factId],
      sourceEvidenceIds: [.../* @__PURE__ */ new Set([...candidate.anchorEvidenceIds, ...confirmingPivot.sourceEvidenceIds])],
      geometry: {
        type: "PATH",
        points: [
          ...candidate.geometry.points,
          {
            time: confirmingPivot.geometry.time,
            price: expected
          }
        ]
      },
      label: concept.replaceAll("_", " "),
      authority: "RESEARCH_ONLY",
      authorityEffect: "NONE"
    };
  }
  function identifyEqualLevelPair(first, second, definition) {
    if (!definition.definitionId)
      throw new Error("equal-level definitionId must be non-empty");
    if (!Number.isFinite(definition.tolerance) || definition.tolerance < 0) {
      throw new Error("equal-level tolerance must be finite and >= 0");
    }
    if (first.concept !== second.concept)
      return null;
    if (first.scale !== second.scale || first.timeframe !== second.timeframe)
      return null;
    if (first.concept !== "SWING_HIGH" && first.concept !== "SWING_LOW")
      return null;
    if (first.geometry.type !== "POINT" || second.geometry.type !== "POINT")
      return null;
    if (first.factId === second.factId)
      return null;
    const firstTime = epoch(first.geometry.time, "first.geometry.time");
    const secondTime = epoch(second.geometry.time, "second.geometry.time");
    if (firstTime === secondTime)
      return null;
    const distance = Math.abs(first.geometry.price - second.geometry.price);
    if (distance > definition.tolerance)
      return null;
    const low = Math.min(first.geometry.price, second.geometry.price);
    const high = Math.max(first.geometry.price, second.geometry.price);
    const concept = first.concept === "SWING_HIGH" ? "EQUAL_HIGHS" : "EQUAL_LOWS";
    const side = first.concept === "SWING_HIGH" ? "SELL" : "BUY";
    return {
      factId: `equal-level:${definition.definitionId}:${first.factId}:${second.factId}`,
      concept,
      maturity: "DETERMINISTIC_FACT",
      scale: first.scale,
      timeframe: first.timeframe,
      side,
      knownAt: epoch(first.knownAt, "knownAt") >= epoch(second.knownAt, "knownAt") ? first.knownAt : second.knownAt,
      definitionId: definition.definitionId,
      sourceEvidenceIds: [.../* @__PURE__ */ new Set([...first.sourceEvidenceIds, ...second.sourceEvidenceIds])],
      geometry: {
        type: "ZONE",
        low,
        high
      },
      label: concept.replaceAll("_", " "),
      authority: "RESEARCH_ONLY",
      authorityEffect: "NONE"
    };
  }
  function detectLiquiditySweep(level, bar, definition) {
    if (!definition.definitionId)
      throw new Error("sweep definitionId must be non-empty");
    if (!Number.isFinite(definition.penetrationTolerance) || definition.penetrationTolerance < 0) {
      throw new Error("penetrationTolerance must be finite and >= 0");
    }
    validateResearchStructureBar(bar);
    if (bar.dataStatus !== "FRESH_COMPLETE")
      return null;
    if (level.geometry.type !== "POINT" && level.geometry.type !== "ZONE")
      return null;
    const levelKnownAt = epoch(level.knownAt, "level.knownAt");
    const barClosedAt = epoch(bar.sourceClosedAt, "bar.sourceClosedAt");
    if (barClosedAt <= levelKnownAt)
      return null;
    if (level.sourceEvidenceIds.includes(bar.evidenceId))
      return null;
    const levelHigh = level.geometry.type === "POINT" ? level.geometry.price : level.geometry.high;
    const levelLow = level.geometry.type === "POINT" ? level.geometry.price : level.geometry.low;
    const sweepsHigh = (level.concept === "SWING_HIGH" || level.concept === "EQUAL_HIGHS") && bar.high > levelHigh + definition.penetrationTolerance && bar.close <= levelHigh;
    const sweepsLow = (level.concept === "SWING_LOW" || level.concept === "EQUAL_LOWS") && bar.low < levelLow - definition.penetrationTolerance && bar.close >= levelLow;
    if (!sweepsHigh && !sweepsLow)
      return null;
    return {
      factId: `sweep:${definition.definitionId}:${level.factId}:${bar.sourceBarId}`,
      concept: "LIQUIDITY_SWEEP",
      maturity: "DETERMINISTIC_FACT",
      scale: level.scale,
      timeframe: level.timeframe,
      side: sweepsHigh ? "SELL" : "BUY",
      knownAt: bar.knownAt,
      definitionId: definition.definitionId,
      sourceEvidenceIds: [.../* @__PURE__ */ new Set([...level.sourceEvidenceIds, bar.evidenceId])],
      geometry: {
        type: "POINT",
        time: bar.sourceClosedAt,
        price: sweepsHigh ? bar.high : bar.low
      },
      label: sweepsHigh ? "HIGH SWEEP / RECLAIM" : "LOW SWEEP / RECLAIM",
      authority: "RESEARCH_ONLY",
      authorityEffect: "NONE"
    };
  }
  function buildResearchMarketMap(input) {
    epoch(input.evaluatedAt, "evaluatedAt");
    for (const fact of input.facts) {
      const factKnownAt = epoch(fact.knownAt, "fact.knownAt");
      if (factKnownAt > epoch(input.evaluatedAt, "evaluatedAt")) {
        throw new Error(`future market-map fact is not knowable yet: ${fact.factId}`);
      }
      if (fact.geometry.type === "POINT" && epoch(fact.geometry.time, "fact.geometry.time") > factKnownAt) {
        throw new Error(`market-map point geometry cannot occur after fact knownAt: ${fact.factId}`);
      }
      if (fact.geometry.type === "PATH" && fact.geometry.points.some((point3) => epoch(point3.time, "fact.geometry.points.time") > factKnownAt)) {
        throw new Error(`market-map path geometry cannot occur after fact knownAt: ${fact.factId}`);
      }
    }
    if (input.regime && epoch(input.regime.knownAt, "regime.knownAt") > epoch(input.evaluatedAt, "evaluatedAt")) {
      throw new Error("future regime fact is not knowable yet");
    }
    return {
      ...input,
      facts: [...input.facts].sort((a, b) => {
        const byKnownAt = epoch(a.knownAt, "knownAt") - epoch(b.knownAt, "knownAt");
        if (byKnownAt !== 0)
          return byKnownAt;
        return a.factId.localeCompare(b.factId);
      }),
      authority: "RESEARCH_ONLY",
      liveCapitalAuthority: false
    };
  }

  // ../../../packages/decision-core/dist/research/liquidityFacts.js
  function epoch2(value, label) {
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed))
      throw new Error(`${label} is not a valid ISO timestamp: ${value}`);
    return parsed;
  }
  function pointTime(fact) {
    if (fact.geometry.type !== "POINT") {
      throw new Error(`liquidity pivot must use POINT geometry: ${fact.factId}`);
    }
    return epoch2(fact.geometry.time, "pivot.geometry.time");
  }
  function deriveEqualLiquidityLevels(input) {
    if (input.definition.pairing !== "ADJACENT_CONFIRMED_PIVOTS") {
      throw new Error("unsupported equal-liquidity pairing policy");
    }
    const evaluatedAt = epoch2(input.evaluatedAt, "evaluatedAt");
    const usable = input.pivots.filter((fact) => (fact.concept === "SWING_HIGH" || fact.concept === "SWING_LOW") && fact.maturity === "DETERMINISTIC_FACT" && fact.geometry.type === "POINT" && epoch2(fact.knownAt, "fact.knownAt") <= evaluatedAt).sort((a, b) => {
      const keyA = [a.timeframe, a.scale ?? "NONE", a.concept].join("|");
      const keyB = [b.timeframe, b.scale ?? "NONE", b.concept].join("|");
      if (keyA !== keyB)
        return keyA.localeCompare(keyB);
      const byTime = pointTime(a) - pointTime(b);
      if (byTime !== 0)
        return byTime;
      return a.factId.localeCompare(b.factId);
    });
    const groups = /* @__PURE__ */ new Map();
    for (const fact of usable) {
      const key = [fact.timeframe, fact.scale ?? "NONE", fact.concept].join("|");
      const group = groups.get(key) ?? [];
      group.push(fact);
      groups.set(key, group);
    }
    const result = [];
    for (const group of groups.values()) {
      for (let index = 1; index < group.length; index += 1) {
        const first = group[index - 1];
        const second = group[index];
        if (!first || !second)
          continue;
        const equal = identifyEqualLevelPair(first, second, input.definition);
        if (equal)
          result.push(equal);
      }
    }
    return result.sort((a, b) => {
      const byKnownAt = epoch2(a.knownAt, "knownAt") - epoch2(b.knownAt, "knownAt");
      if (byKnownAt !== 0)
        return byKnownAt;
      return a.factId.localeCompare(b.factId);
    });
  }
  function deriveLiquiditySweeps(input) {
    const evaluatedAt = epoch2(input.evaluatedAt, "evaluatedAt");
    const levels = input.levels.filter((level) => epoch2(level.knownAt, "level.knownAt") <= evaluatedAt);
    const bars3 = input.bars.filter((bar) => epoch2(bar.knownAt, "bar.knownAt") <= evaluatedAt);
    const result = [];
    const ids = /* @__PURE__ */ new Set();
    for (const level of levels) {
      for (const bar of bars3) {
        const sweep = detectLiquiditySweep(level, bar, input.definition);
        if (!sweep || ids.has(sweep.factId))
          continue;
        ids.add(sweep.factId);
        result.push(sweep);
      }
    }
    return result.sort((a, b) => {
      const byKnownAt = epoch2(a.knownAt, "knownAt") - epoch2(b.knownAt, "knownAt");
      if (byKnownAt !== 0)
        return byKnownAt;
      return a.factId.localeCompare(b.factId);
    });
  }

  // ../../../packages/decision-core/dist/research/imbalanceFacts.js
  function epoch3(value, label) {
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed))
      throw new Error(`${label} is not a valid ISO timestamp: ${value}`);
    return parsed;
  }
  function validateFvgDefinition(definition) {
    if (!definition.definitionId)
      throw new Error("FVG definitionId must be non-empty");
    if (!Number.isFinite(definition.minimumGap) || definition.minimumGap < 0) {
      throw new Error("FVG minimumGap must be finite and >= 0");
    }
  }
  function detectThreeBarFvg(timeframe, first, middle, third, definition) {
    validateFvgDefinition(definition);
    if (!timeframe.trim())
      throw new Error("FVG timeframe must be non-empty");
    for (const bar of [first, middle, third])
      validateResearchStructureBar(bar);
    if ([first, middle, third].some((bar) => bar.dataStatus !== "FRESH_COMPLETE"))
      return null;
    const firstClose = epoch3(first.sourceClosedAt, "first.sourceClosedAt");
    const middleClose = epoch3(middle.sourceClosedAt, "middle.sourceClosedAt");
    const thirdClose = epoch3(third.sourceClosedAt, "third.sourceClosedAt");
    if (!(firstClose < middleClose && middleClose < thirdClose)) {
      throw new Error("FVG bars must be strictly chronological");
    }
    const knownAt = [first.knownAt, middle.knownAt, third.knownAt].reduce((latest, candidate) => epoch3(candidate, "bar.knownAt") > epoch3(latest, "bar.knownAt") ? candidate : latest);
    const bullishGap = third.low - first.high;
    const bearishGap = first.low - third.high;
    const bullish = bullishGap > 0 && bullishGap >= definition.minimumGap;
    const bearish = bearishGap > 0 && bearishGap >= definition.minimumGap;
    if (bullish === bearish)
      return null;
    const low = bullish ? first.high : third.high;
    const high = bullish ? third.low : first.low;
    return {
      factId: `fvg:${definition.definitionId}:${first.sourceBarId}:${middle.sourceBarId}:${third.sourceBarId}`,
      concept: "FVG",
      maturity: "DETERMINISTIC_FACT",
      scale: null,
      timeframe,
      side: bullish ? "BUY" : "SELL",
      knownAt,
      definitionId: definition.definitionId,
      sourceEvidenceIds: [first.evidenceId, middle.evidenceId, third.evidenceId],
      geometry: {
        type: "ZONE",
        low,
        high,
        startAt: third.sourceClosedAt
      },
      label: bullish ? "BULLISH FVG" : "BEARISH FVG",
      authority: "RESEARCH_ONLY",
      authorityEffect: "NONE"
    };
  }
  function clamp01(value) {
    return Math.min(1, Math.max(0, value));
  }
  function assessFvgRevisit(fvg, bar, definition) {
    if (!definition.definitionId)
      throw new Error("FVG revisit definitionId must be non-empty");
    if (definition.partialFillRule !== "CLOSE_INSIDE_ZONE") {
      throw new Error("unsupported FVG partialFillRule");
    }
    if (definition.fullFillRule !== "WICK_REACH_FAR_BOUNDARY") {
      throw new Error("unsupported FVG fullFillRule");
    }
    validateResearchStructureBar(bar);
    if (fvg.concept !== "FVG" || fvg.geometry.type !== "ZONE") {
      throw new Error("FVG revisit requires a FVG zone fact");
    }
    if (bar.dataStatus !== "FRESH_COMPLETE") {
      return {
        status: "UNTOUCHED",
        fillFraction: 0,
        fact: null,
        authority: "RESEARCH_ONLY",
        liveCapitalAuthority: false
      };
    }
    const barClosedAt = epoch3(bar.sourceClosedAt, "bar.sourceClosedAt");
    const fvgKnownAt = epoch3(fvg.knownAt, "fvg.knownAt");
    if (barClosedAt <= fvgKnownAt || fvg.sourceEvidenceIds.includes(bar.evidenceId)) {
      return {
        status: "UNTOUCHED",
        fillFraction: 0,
        fact: null,
        authority: "RESEARCH_ONLY",
        liveCapitalAuthority: false
      };
    }
    const { low, high } = fvg.geometry;
    const height = high - low;
    if (!(height > 0))
      throw new Error("FVG zone must have positive height");
    const bullish = fvg.side === "BUY";
    const touched = bullish ? bar.low <= high : bar.high >= low;
    if (!touched) {
      return {
        status: "UNTOUCHED",
        fillFraction: 0,
        fact: null,
        authority: "RESEARCH_ONLY",
        liveCapitalAuthority: false
      };
    }
    const fullFill = bullish ? bar.low <= low : bar.high >= high;
    const closeInside = bar.close > low && bar.close < high;
    const rawFraction = bullish ? (high - Math.min(high, bar.low)) / height : (Math.max(low, bar.high) - low) / height;
    const fillFraction = clamp01(rawFraction);
    const status = fullFill ? "FULL_FILL" : closeInside ? "PARTIAL_FILL" : "TOUCHED";
    const concept = status === "FULL_FILL" ? "FVG_FULL_FILL" : status === "PARTIAL_FILL" ? "FVG_PARTIAL_FILL" : "FVG_TOUCH";
    const label = status === "FULL_FILL" ? "FVG FULL FILL" : status === "PARTIAL_FILL" ? "FVG PARTIAL FILL" : "FVG TOUCH";
    return {
      status,
      fillFraction,
      fact: {
        factId: `fvg-revisit:${definition.definitionId}:${fvg.factId}:${bar.sourceBarId}`,
        concept,
        maturity: "DETERMINISTIC_FACT",
        scale: fvg.scale,
        timeframe: fvg.timeframe,
        side: fvg.side,
        knownAt: bar.knownAt,
        definitionId: definition.definitionId,
        sourceEvidenceIds: [.../* @__PURE__ */ new Set([...fvg.sourceEvidenceIds, bar.evidenceId])],
        geometry: {
          type: "POINT",
          time: bar.sourceClosedAt,
          price: bullish ? bar.low : bar.high
        },
        label,
        authority: "RESEARCH_ONLY",
        authorityEffect: "NONE"
      },
      authority: "RESEARCH_ONLY",
      liveCapitalAuthority: false
    };
  }

  // ../../../packages/decision-core/dist/research/trendlineFacts.js
  function epoch4(value, label) {
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed))
      throw new Error(`${label} is not a valid ISO timestamp: ${value}`);
    return parsed;
  }
  function validateNonNegative(value, label) {
    if (!Number.isFinite(value) || value < 0)
      throw new Error(`${label} must be finite and >= 0`);
  }
  function pointTime2(fact) {
    if (fact.geometry.type !== "POINT")
      throw new Error(`trendline anchor must use POINT geometry: ${fact.factId}`);
    return epoch4(fact.geometry.time, "pivot.geometry.time");
  }
  function validateDerivationDefinition(definition) {
    if (!definition.definitionId)
      throw new Error("trendline derivation definitionId must be non-empty");
    if (definition.pairing !== "ADJACENT_SAME_SIDE_CONFIRMED_PIVOTS") {
      throw new Error("unsupported trendline pairing policy");
    }
    validateNonNegative(definition.minimumAnchorSeparationMs, "minimumAnchorSeparationMs");
    validateNonNegative(definition.anchorTolerance, "anchorTolerance");
    if (definition.allowedScales.length === 0)
      throw new Error("trendline allowedScales must not be empty");
  }
  function validateInteractionDefinition(definition) {
    if (!definition.definitionId)
      throw new Error("trendline interaction definitionId must be non-empty");
    validateNonNegative(definition.touchTolerance, "touchTolerance");
    validateNonNegative(definition.penetrationBuffer, "penetrationBuffer");
    validateNonNegative(definition.closeBreakBuffer, "closeBreakBuffer");
    if (definition.breakRule !== "CLOSE_BEYOND")
      throw new Error("unsupported trendline breakRule");
  }
  function groupKey(fact) {
    return [fact.timeframe, fact.scale ?? "NONE", fact.concept, fact.definitionId].join("|");
  }
  function deriveConfirmedTrendlines(input) {
    validateDerivationDefinition(input.definition);
    const evaluatedAt = epoch4(input.evaluatedAt, "evaluatedAt");
    const usable = dedupeById(input.pivots.filter((fact) => (fact.concept === "SWING_LOW" || fact.concept === "SWING_HIGH") && fact.maturity === "DETERMINISTIC_FACT" && fact.geometry.type === "POINT" && fact.scale !== null && input.definition.allowedScales.includes(fact.scale) && epoch4(fact.knownAt, "fact.knownAt") <= evaluatedAt && // geometry later than knowledge is non-causal and never an anchor
    pointTime2(fact) <= epoch4(fact.knownAt, "fact.knownAt")), (fact) => fact.factId, "pivot fact");
    const groups = /* @__PURE__ */ new Map();
    for (const fact of usable) {
      const key = groupKey(fact);
      const group = groups.get(key) ?? [];
      group.push(fact);
      groups.set(key, group);
    }
    const facts = [];
    const ids = /* @__PURE__ */ new Set();
    for (const group of groups.values()) {
      const seenTimes = /* @__PURE__ */ new Map();
      for (const fact of group) {
        const time = pointTime2(fact);
        const other = seenTimes.get(time);
        if (other !== void 0) {
          throw new Error(`ambiguous same-side pivots at one time in one group: ${other}, ${fact.factId}`);
        }
        seenTimes.set(time, fact.factId);
      }
      for (const third of group) {
        const thirdTime = pointTime2(third);
        const thirdKnownAt = epoch4(third.knownAt, "third.knownAt");
        const predecessors = group.filter((fact) => fact.factId !== third.factId && pointTime2(fact) < thirdTime && epoch4(fact.knownAt, "fact.knownAt") <= thirdKnownAt).sort((a, b) => pointTime2(a) - pointTime2(b));
        if (predecessors.length < 2)
          continue;
        const first = predecessors[predecessors.length - 2];
        const second = predecessors[predecessors.length - 1];
        const candidate = buildTrendlineCandidateFromPivots(first, second, {
          definitionId: input.definition.definitionId,
          minimumAnchorSeparationMs: input.definition.minimumAnchorSeparationMs
        });
        if (!candidate)
          continue;
        if (thirdTime - pointTime2(second) < input.definition.minimumAnchorSeparationMs)
          continue;
        const confirmed = confirmTrendlineWithPivot(candidate, third, {
          definitionId: input.definition.definitionId,
          anchorTolerance: input.definition.anchorTolerance
        });
        if (!confirmed || ids.has(confirmed.factId))
          continue;
        ids.add(confirmed.factId);
        facts.push(confirmed);
      }
    }
    return facts.sort((a, b) => {
      const byKnown = epoch4(a.knownAt, "knownAt") - epoch4(b.knownAt, "knownAt");
      return byKnown !== 0 ? byKnown : a.factId.localeCompare(b.factId);
    });
  }
  function trendlinePriceAt(trendline, time) {
    if (trendline.concept !== "TRENDLINE_SUPPORT" && trendline.concept !== "TRENDLINE_RESISTANCE" || trendline.geometry.type !== "PATH" || trendline.geometry.points.length < 2) {
      throw new Error("trendlinePriceAt requires a trendline PATH fact with at least two points");
    }
    const first = trendline.geometry.points[0];
    const second = trendline.geometry.points[1];
    const firstTime = epoch4(first.time, "trendline first point");
    const secondTime = epoch4(second.time, "trendline second point");
    const target = epoch4(time, "trendline target time");
    if (secondTime <= firstTime)
      throw new Error("trendline points must be strictly chronological");
    const slope = (second.price - first.price) / (secondTime - firstTime);
    return first.price + slope * (target - firstTime);
  }
  function validateInteractableTrendline(trendline) {
    if (trendline.concept !== "TRENDLINE_SUPPORT" && trendline.concept !== "TRENDLINE_RESISTANCE")
      throw new Error("trendline interaction requires support/resistance trendline fact");
    if (trendline.geometry.type !== "PATH")
      throw new Error("trendline interaction requires PATH geometry");
    if (trendline.maturity !== "RESEARCH_DERIVED") {
      throw new Error(`trendline interaction requires a RESEARCH_DERIVED line, got ${trendline.maturity}`);
    }
    const lineKnownAt = epoch4(trendline.knownAt, "trendline.knownAt");
    if (trendline.geometry.points.some((point3) => epoch4(point3.time, "trendline point") > lineKnownAt)) {
      throw new Error(`trendline geometry is later than its knownAt: ${trendline.factId}`);
    }
    return lineKnownAt;
  }
  function assessTrendlineInteraction(trendline, bar, definition) {
    validateInteractionDefinition(definition);
    validateResearchStructureBar(bar);
    const lineKnownAt = validateInteractableTrendline(trendline);
    const linePrice = trendlinePriceAt(trendline, bar.sourceClosedAt);
    const none = () => ({
      status: "NO_INTERACTION",
      linePrice,
      fact: null,
      authority: "RESEARCH_ONLY",
      liveCapitalAuthority: false
    });
    if (bar.dataStatus !== "FRESH_COMPLETE")
      return none();
    const barClosedAt = epoch4(bar.sourceClosedAt, "bar.sourceClosedAt");
    if (barClosedAt <= lineKnownAt || trendline.sourceEvidenceIds.includes(bar.evidenceId))
      return none();
    const slack = priceComparisonSlack(linePrice, bar.high, bar.low, bar.close);
    const support = trendline.concept === "TRENDLINE_SUPPORT";
    const closeBreak = support ? bar.close < linePrice - definition.closeBreakBuffer - slack : bar.close > linePrice + definition.closeBreakBuffer + slack;
    const penetration = support ? bar.low < linePrice - definition.penetrationBuffer - slack : bar.high > linePrice + definition.penetrationBuffer + slack;
    const touch = bar.low <= linePrice + definition.touchTolerance + slack && bar.high >= linePrice - definition.touchTolerance - slack;
    const status = closeBreak ? "CLOSE_BREAK" : penetration ? "PENETRATION" : touch ? "TOUCH" : "NO_INTERACTION";
    if (status === "NO_INTERACTION")
      return none();
    const concept = status === "CLOSE_BREAK" ? "TRENDLINE_BREAK" : status === "PENETRATION" ? "TRENDLINE_PENETRATION" : "TRENDLINE_TOUCH";
    const side = support ? "BUY" : "SELL";
    const label = `${support ? "SUPPORT" : "RESISTANCE"} ${status.replaceAll("_", " ")}`;
    return {
      status,
      linePrice,
      fact: {
        factId: `trendline-interaction:${definition.definitionId}:${trendline.factId}:${bar.sourceBarId}:${status}`,
        concept,
        maturity: "RESEARCH_DERIVED",
        scale: trendline.scale,
        timeframe: trendline.timeframe,
        side,
        knownAt: bar.knownAt,
        definitionId: definition.definitionId,
        sourceFactIds: [trendline.factId],
        sourceEvidenceIds: [.../* @__PURE__ */ new Set([...trendline.sourceEvidenceIds, bar.evidenceId])],
        geometry: { type: "POINT", time: bar.sourceClosedAt, price: linePrice },
        label,
        authority: "RESEARCH_ONLY",
        authorityEffect: "NONE"
      },
      authority: "RESEARCH_ONLY",
      liveCapitalAuthority: false
    };
  }
  function deriveTrendlineInteractions(input) {
    const evaluatedAt = epoch4(input.evaluatedAt, "evaluatedAt");
    validateInteractionDefinition(input.definition);
    validateInteractableTrendline(input.trendline);
    if (epoch4(input.trendline.knownAt, "trendline.knownAt") > evaluatedAt)
      return [];
    const knownAny = input.bars.filter((bar) => epoch4(bar.knownAt, "bar.knownAt") <= evaluatedAt);
    for (const bar of knownAny)
      validateResearchStructureBar(bar);
    const known = knownAny.filter((bar) => bar.dataStatus === "FRESH_COMPLETE");
    const bars3 = [...dedupeById(known, (bar) => bar.sourceBarId, "source bar")].sort((a, b) => {
      const byKnown = epoch4(a.knownAt, "bar.knownAt") - epoch4(b.knownAt, "bar.knownAt");
      if (byKnown !== 0)
        return byKnown;
      const byClose = epoch4(a.sourceClosedAt, "sourceClosedAt") - epoch4(b.sourceClosedAt, "sourceClosedAt");
      return byClose !== 0 ? byClose : a.sourceBarId.localeCompare(b.sourceBarId);
    });
    const facts = [];
    for (const bar of bars3) {
      const assessment = assessTrendlineInteraction(input.trendline, bar, input.definition);
      if (assessment.fact)
        facts.push(assessment.fact);
      if (assessment.status === "CLOSE_BREAK")
        break;
    }
    return facts;
  }

  // ../../../packages/decision-core/dist/research/chartScene.js
  var ENGINE_CHART_PRIMITIVE_CONCEPTS = [
    ...MARKET_STRUCTURE_CONCEPTS,
    "REGIME",
    "STRUCTURAL_LIFECYCLE",
    "ENTRY_STATUS"
  ];
  function layerForFact(fact) {
    switch (fact.concept) {
      case "SWING_HIGH":
      case "SWING_LOW":
      case "BOS":
      case "CHOCH":
      case "MSS":
      case "TRENDLINE_SUPPORT":
      case "TRENDLINE_RESISTANCE":
      case "TRENDLINE_TOUCH":
      case "TRENDLINE_PENETRATION":
      case "TRENDLINE_BREAK":
      case "CHANNEL_SUPPORT":
      case "CHANNEL_RESISTANCE":
      case "RANGE_HIGH":
      case "RANGE_LOW":
      case "BREAKOUT":
        return "STRUCTURE";
      case "EQUAL_HIGHS":
      case "EQUAL_LOWS":
      case "LIQUIDITY_SWEEP":
      case "FAKEOUT":
      case "INDUCEMENT":
        return "LIQUIDITY";
      case "FVG":
      case "FVG_TOUCH":
      case "FVG_PARTIAL_FILL":
      case "FVG_FULL_FILL":
      case "ORDER_BLOCK":
      case "BREAKER_BLOCK":
      case "MITIGATION_BLOCK":
      case "MITIGATION":
        return "IMBALANCE";
      case "DISPLACEMENT":
      case "RETEST":
      case "CONTINUATION":
        return "SETUP";
      case "DOUBLE_TOP":
      case "DOUBLE_BOTTOM":
      case "HEAD_AND_SHOULDERS":
      case "INVERSE_HEAD_AND_SHOULDERS":
      case "RISING_WEDGE":
      case "FALLING_WEDGE":
      case "ASCENDING_TRIANGLE":
      case "DESCENDING_TRIANGLE":
      case "SYMMETRICAL_TRIANGLE":
      case "FLAG":
      case "PENNANT":
      case "DOJI":
      case "HAMMER":
      case "SHOOTING_STAR":
      case "BULLISH_ENGULFING":
      case "BEARISH_ENGULFING":
      case "INSIDE_BAR":
      case "OUTSIDE_BAR":
      case "MORNING_STAR":
      case "EVENING_STAR":
      case "THREE_WHITE_SOLDIERS":
      case "THREE_BLACK_CROWS":
        return "PATTERN";
      case "ELLIOTT_WAVE":
        return "ADVISORY";
    }
  }
  function styleForFact(fact) {
    const layer = layerForFact(fact);
    if (layer === "LIQUIDITY")
      return "LIQUIDITY";
    if (layer === "IMBALANCE")
      return "IMBALANCE";
    if (layer === "SETUP")
      return "SETUP";
    if (layer === "PATTERN")
      return "PATTERN";
    if (layer === "ADVISORY")
      return "ADVISORY";
    return fact.scale === "EXTERNAL" ? "STRUCTURE_PRIMARY" : "STRUCTURE_SECONDARY";
  }
  function visibilityForFact(fact) {
    if (fact.maturity === "ADVISORY_ONLY" || fact.maturity === "MORPHOLOGY_ONLY")
      return "DETAIL";
    if (fact.scale === "EXTERNAL" || fact.concept === "LIQUIDITY_SWEEP" || fact.concept === "BOS" || fact.concept === "CHOCH" || fact.concept === "MSS" || fact.concept === "BREAKOUT") {
      return "PRIMARY";
    }
    return "SECONDARY";
  }
  function projectMarketMapToChartScene(marketMap, routeContext = {
    status: "UNAVAILABLE",
    families: [],
    calibrationStatus: null
  }, regimeContext = {
    status: marketMap.regime ? "CLASSIFIED" : "UNAVAILABLE",
    measurementId: null,
    profileId: null,
    profileVersion: null,
    matchingRuleIds: [],
    reasons: marketMap.regime ? ["REGIME_FACT_PRESENT"] : ["REGIME_UNAVAILABLE"]
  }) {
    for (const fact of marketMap.facts) {
      if (exceedsConceptMaturityCeiling(fact.concept, fact.maturity)) {
        throw new Error(`maturity escalation refused: ${fact.concept} is capped at RESEARCH_DERIVED (${fact.factId})`);
      }
    }
    const primitives = marketMap.facts.map((fact) => ({
      primitiveId: `primitive:${fact.factId}`,
      layer: layerForFact(fact),
      concept: fact.concept,
      maturity: fact.maturity,
      scale: fact.scale,
      label: fact.label,
      knownAt: fact.knownAt,
      geometry: fact.geometry,
      sourceFactIds: [fact.factId, ...fact.sourceFactIds ?? []],
      sourceEvidenceIds: fact.sourceEvidenceIds,
      visibility: visibilityForFact(fact),
      styleToken: styleForFact(fact),
      authorityEffect: "NONE"
    }));
    if (marketMap.regime) {
      primitives.unshift({
        primitiveId: `primitive:regime:${marketMap.regime.evidenceId}`,
        layer: "REGIME",
        concept: "REGIME",
        maturity: "DETERMINISTIC_FACT",
        scale: null,
        label: marketMap.regime.regime,
        knownAt: marketMap.regime.knownAt,
        geometry: {
          type: "LEVEL",
          price: 0
        },
        sourceFactIds: [],
        sourceEvidenceIds: [marketMap.regime.evidenceId],
        visibility: "PRIMARY",
        styleToken: "STRUCTURE_PRIMARY",
        authorityEffect: "NONE"
      });
    }
    return {
      sceneId: `scene:${marketMap.mapId}`,
      instrument: marketMap.instrument,
      timeframe: marketMap.timeframe,
      evaluatedAt: marketMap.evaluatedAt,
      strategyId: marketMap.strategyLens.strategyId,
      strategyVersion: marketMap.strategyLens.version,
      regimeLabel: marketMap.regime?.regime ?? null,
      regimeEvidenceId: marketMap.regime?.evidenceId ?? null,
      regimeDefinitionId: marketMap.regime?.definitionId ?? null,
      regimeKnownAt: marketMap.regime?.knownAt ?? null,
      regimeContext,
      routeContext,
      primitives,
      authority: "RESEARCH_ONLY",
      liveCapitalAuthority: false
    };
  }

  // ../../../packages/decision-core/dist/research/regimeEvidence.js
  function epoch5(value, label) {
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) {
      throw new Error(`${label} is not a valid ISO timestamp: ${value}`);
    }
    return parsed;
  }
  function validateMeasurementDefinition(definition) {
    if (!definition.definitionId) {
      throw new Error("regime measurement definitionId must be non-empty");
    }
    if (!Number.isInteger(definition.lookbackBars) || definition.lookbackBars < 2) {
      throw new Error("regime lookbackBars must be an integer >= 2");
    }
    if (!Number.isInteger(definition.baselineBars) || definition.baselineBars < 1) {
      throw new Error("regime baselineBars must be an integer >= 1");
    }
    if (!Number.isFinite(definition.maxLatestBarAgeMs) || definition.maxLatestBarAgeMs < 0) {
      throw new Error("regime maxLatestBarAgeMs must be finite and >= 0");
    }
  }
  function mean(values) {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }
  function adjacentOverlapRatio(bars3) {
    const ratios = [];
    for (let index = 1; index < bars3.length; index += 1) {
      const previous = bars3[index - 1];
      const current = bars3[index];
      if (!previous || !current)
        continue;
      const overlap = Math.max(0, Math.min(previous.high, current.high) - Math.max(previous.low, current.low));
      const smallerRange = Math.min(previous.high - previous.low, current.high - current.low);
      ratios.push(smallerRange > 0 ? overlap / smallerRange : 0);
    }
    return ratios.length > 0 ? mean(ratios) : 0;
  }
  function computeRegimeMeasurements(input) {
    validateMeasurementDefinition(input.definition);
    if (!input.timeframe.trim())
      throw new Error("regime timeframe must be non-empty");
    const evaluatedAt = epoch5(input.evaluatedAt, "evaluatedAt");
    const seenEvidence = /* @__PURE__ */ new Set();
    const seenBars = /* @__PURE__ */ new Set();
    const seenCloseTimes = /* @__PURE__ */ new Set();
    for (const bar of input.bars) {
      validateResearchStructureBar(bar);
      if (!bar.evidenceId || !bar.sourceBarId) {
        throw new Error("regime bars require evidenceId and sourceBarId");
      }
      if (seenEvidence.has(bar.evidenceId)) {
        throw new Error(`duplicate regime evidenceId: ${bar.evidenceId}`);
      }
      if (seenBars.has(bar.sourceBarId)) {
        throw new Error(`duplicate regime sourceBarId: ${bar.sourceBarId}`);
      }
      if (seenCloseTimes.has(bar.sourceClosedAt)) {
        throw new Error(`duplicate regime sourceClosedAt: ${bar.sourceClosedAt}`);
      }
      seenEvidence.add(bar.evidenceId);
      seenBars.add(bar.sourceBarId);
      seenCloseTimes.add(bar.sourceClosedAt);
    }
    const knowable = input.bars.filter((bar) => epoch5(bar.knownAt, "bar.knownAt") <= evaluatedAt).sort((a, b) => {
      const byClose = epoch5(a.sourceClosedAt, "sourceClosedAt") - epoch5(b.sourceClosedAt, "sourceClosedAt");
      if (byClose !== 0)
        return byClose;
      return a.sourceBarId.localeCompare(b.sourceBarId);
    });
    const required = input.definition.lookbackBars + input.definition.baselineBars;
    if (knowable.length < required) {
      return {
        status: "INSUFFICIENT_EVIDENCE",
        measurements: null,
        reasons: ["INSUFFICIENT_BOUNDED_WINDOW"],
        authority: "RESEARCH_ONLY",
        liveCapitalAuthority: false
      };
    }
    const bounded = knowable.slice(-required);
    const latest = bounded.at(-1);
    if (!latest)
      throw new Error("regime bounded window unexpectedly empty");
    if (evaluatedAt - epoch5(latest.knownAt, "latest.knownAt") > input.definition.maxLatestBarAgeMs) {
      return {
        status: "DATA_UNAVAILABLE",
        measurements: null,
        reasons: ["LATEST_BAR_TOO_OLD"],
        authority: "RESEARCH_ONLY",
        liveCapitalAuthority: false
      };
    }
    const unavailable = bounded.filter((bar) => bar.dataStatus !== "FRESH_COMPLETE");
    if (unavailable.length > 0) {
      return {
        status: "DATA_UNAVAILABLE",
        measurements: null,
        reasons: unavailable.map((bar) => `${bar.sourceBarId}:${bar.dataStatus}`),
        authority: "RESEARCH_ONLY",
        liveCapitalAuthority: false
      };
    }
    const baseline = bounded.slice(0, input.definition.baselineBars);
    const current = bounded.slice(input.definition.baselineBars);
    const first = current[0];
    const last = current.at(-1);
    if (!first || !last)
      throw new Error("regime bounded window unexpectedly empty");
    const closePath = current.slice(1).reduce((sum, bar, index) => {
      const prior = current[index];
      if (!prior)
        return sum;
      return sum + Math.abs(bar.close - prior.close);
    }, 0);
    const signedCloseMove = last.close - first.close;
    const closeEfficiency = closePath > 0 ? Math.abs(signedCloseMove) / closePath : 0;
    const currentRanges = current.map((bar) => bar.high - bar.low);
    const baselineRanges = baseline.map((bar) => bar.high - bar.low);
    const meanBarRange = mean(currentRanges);
    const baselineMeanRange = mean(baselineRanges);
    const rangeExpansionRatio = baselineMeanRange > 0 ? meanBarRange / baselineMeanRange : 0;
    const values = {
      CLOSE_EFFICIENCY: closeEfficiency,
      SIGNED_CLOSE_MOVE: signedCloseMove,
      MEAN_BAR_RANGE: meanBarRange,
      RANGE_EXPANSION_RATIO: rangeExpansionRatio,
      ADJACENT_OVERLAP_RATIO: adjacentOverlapRatio(current)
    };
    const knownAt = bounded.reduce((latest2, bar) => epoch5(bar.knownAt, "bar.knownAt") > epoch5(latest2, "knownAt") ? bar.knownAt : latest2, bounded[0].knownAt);
    const sourceEvidenceIds = bounded.map((bar) => bar.evidenceId);
    const sourceBarIds = bounded.map((bar) => bar.sourceBarId);
    const measurementId = [
      "regime-measurement",
      input.definition.definitionId,
      input.timeframe,
      ...sourceEvidenceIds
    ].join(":");
    return {
      status: "AVAILABLE",
      measurements: {
        measurementId,
        definitionId: input.definition.definitionId,
        timeframe: input.timeframe,
        evaluatedAt: input.evaluatedAt,
        knownAt,
        sourceEvidenceIds,
        sourceBarIds,
        values,
        authority: "RESEARCH_ONLY"
      },
      reasons: [],
      authority: "RESEARCH_ONLY",
      liveCapitalAuthority: false
    };
  }
  function predicateMatches(value, predicate) {
    switch (predicate.operator) {
      case "GT":
        return value > predicate.threshold;
      case "GTE":
        return value >= predicate.threshold;
      case "LT":
        return value < predicate.threshold;
      case "LTE":
        return value <= predicate.threshold;
    }
  }
  function classificationDefinitionFingerprint(definition) {
    return definition.rules.map((rule) => {
      const predicates = rule.predicates.map((predicate) => [
        predicate.measurement,
        predicate.operator,
        String(predicate.threshold),
        predicate.thresholdProvenanceId
      ].join("~")).sort().join("&");
      return [rule.ruleId, rule.regime, predicates].join("=");
    }).sort().join("|");
  }
  function validateClassificationDefinition(definition) {
    if (!definition.definitionId || !definition.profileId || !definition.profileVersion) {
      throw new Error("regime classification identity fields must be non-empty");
    }
    const ruleIds = /* @__PURE__ */ new Set();
    for (const rule of definition.rules) {
      if (!rule.ruleId)
        throw new Error("regime ruleId must be non-empty");
      if (ruleIds.has(rule.ruleId))
        throw new Error(`duplicate regime ruleId: ${rule.ruleId}`);
      ruleIds.add(rule.ruleId);
      if (rule.predicates.length === 0) {
        throw new Error(`regime rule ${rule.ruleId} requires at least one predicate`);
      }
      for (const predicate of rule.predicates) {
        if (!Number.isFinite(predicate.threshold)) {
          throw new Error(`regime threshold must be finite: ${rule.ruleId}`);
        }
        if (!predicate.thresholdProvenanceId) {
          throw new Error(`regime predicate requires threshold provenance: ${rule.ruleId}`);
        }
      }
    }
  }
  function classifyCanonicalRegime(input) {
    validateClassificationDefinition(input.definition);
    const identityPrefix = [
      "canonical-regime",
      input.definition.definitionId,
      input.definition.profileId,
      input.definition.profileVersion,
      classificationDefinitionFingerprint(input.definition)
    ].join(":");
    if (input.assessment.status !== "AVAILABLE" || !input.assessment.measurements) {
      return {
        classificationId: `${identityPrefix}:unavailable`,
        status: "UNAVAILABLE",
        regime: null,
        fact: null,
        matchingRuleIds: [],
        reasons: [...input.assessment.reasons],
        measurementId: null,
        definitionId: input.definition.definitionId,
        profileId: input.definition.profileId,
        profileVersion: input.definition.profileVersion,
        authority: "RESEARCH_ONLY",
        liveCapitalAuthority: false
      };
    }
    const measurements = input.assessment.measurements;
    const matches = input.definition.rules.filter((rule) => rule.predicates.every((predicate) => predicateMatches(measurements.values[predicate.measurement], predicate)));
    const classificationId = [
      identityPrefix,
      measurements.measurementId,
      matches.map((rule) => rule.ruleId).sort().join("+") || "none"
    ].join(":");
    if (matches.length !== 1) {
      return {
        classificationId,
        status: "UNCERTAIN",
        regime: null,
        fact: null,
        matchingRuleIds: matches.map((rule) => rule.ruleId).sort(),
        reasons: [
          matches.length === 0 ? "NO_REGIME_RULE_MATCHED" : "AMBIGUOUS_REGIME_RULE_MATCH"
        ],
        measurementId: measurements.measurementId,
        definitionId: input.definition.definitionId,
        profileId: input.definition.profileId,
        profileVersion: input.definition.profileVersion,
        authority: "RESEARCH_ONLY",
        liveCapitalAuthority: false
      };
    }
    const match = matches[0];
    const fact = {
      regime: match.regime,
      knownAt: measurements.knownAt,
      evidenceId: classificationId,
      definitionId: input.definition.definitionId
    };
    return {
      classificationId,
      status: "CLASSIFIED",
      regime: match.regime,
      fact,
      matchingRuleIds: [match.ruleId],
      reasons: ["CLASSIFIED"],
      measurementId: measurements.measurementId,
      definitionId: input.definition.definitionId,
      profileId: input.definition.profileId,
      profileVersion: input.definition.profileVersion,
      authority: "RESEARCH_ONLY",
      liveCapitalAuthority: false
    };
  }

  // ../../../packages/decision-core/dist/research/strategyRegimePlaybook.js
  function resolveResearchRoutes(playbook2, regime) {
    if (!playbook2.playbookId || !playbook2.strategyId || !playbook2.strategyVersion) {
      throw new Error("playbook identity fields must be non-empty");
    }
    const seen = /* @__PURE__ */ new Set();
    for (const route of playbook2.routes) {
      if (!route.routeId)
        throw new Error("routeId must be non-empty");
      if (seen.has(route.routeId))
        throw new Error(`duplicate routeId: ${route.routeId}`);
      seen.add(route.routeId);
      if (!route.invalidationPolicyRef)
        throw new Error(`route ${route.routeId} requires invalidationPolicyRef`);
    }
    const routes = playbook2.routes.filter((route) => route.compatibleRegimes.includes(regime));
    return {
      strategyId: playbook2.strategyId,
      strategyVersion: playbook2.strategyVersion,
      regime,
      status: routes.length > 0 ? "ROUTES_AVAILABLE" : "NO_DECLARED_ROUTE",
      routes,
      calibrationStatus: "UNVALIDATED_CANDIDATE_SET",
      authority: "RESEARCH_ONLY",
      liveCapitalAuthority: false
    };
  }

  // ../../../packages/decision-core/dist/research/structuralBreaks.js
  function epoch6(value, label) {
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed))
      throw new Error(`${label} is not a valid ISO timestamp: ${value}`);
    return parsed;
  }
  function levelBoundaries(level) {
    switch (level.geometry.type) {
      case "POINT":
        return { low: level.geometry.price, high: level.geometry.price };
      case "LEVEL":
        return { low: level.geometry.price, high: level.geometry.price };
      case "ZONE":
        return { low: level.geometry.low, high: level.geometry.high };
      case "PATH":
        return null;
    }
  }
  function relationFor(bias, direction) {
    if (bias === "NEUTRAL")
      return "NEUTRAL";
    if (bias === "BULLISH")
      return direction === "UP" ? "CONTINUATION" : "OPPOSITION";
    return direction === "DOWN" ? "CONTINUATION" : "OPPOSITION";
  }
  function validateBreakDefinition(definition) {
    if (!definition.definitionId)
      throw new Error("break definitionId must be non-empty");
    if (!Number.isFinite(definition.tolerance) || definition.tolerance < 0) {
      throw new Error("break tolerance must be finite and >= 0");
    }
    if (definition.eligibleLevels.length === 0) {
      throw new Error("break definition requires at least one eligible level rule");
    }
    const seen = /* @__PURE__ */ new Set();
    for (const rule of definition.eligibleLevels) {
      if (rule.allowedDirections.length === 0) {
        throw new Error(`eligible level ${rule.concept} requires at least one break direction`);
      }
      if (new Set(rule.allowedDirections).size !== rule.allowedDirections.length) {
        throw new Error(`eligible level ${rule.concept} repeats a break direction`);
      }
      if (rule.allowedScales.length === 0) {
        throw new Error(`eligible level ${rule.concept} requires at least one scale`);
      }
      for (const scale of rule.allowedScales) {
        const key = `${rule.concept}:${String(scale)}`;
        if (seen.has(key))
          throw new Error(`ambiguous overlapping level rule: ${key}`);
        seen.add(key);
      }
    }
  }
  function validateClassificationDefinition2(definition) {
    if (!definition.definitionId)
      throw new Error("classification definitionId must be non-empty");
    const seen = /* @__PURE__ */ new Set();
    for (const rule of definition.rules) {
      if (rule.eligibleScales.length === 0) {
        throw new Error(`classification rule ${rule.relation} requires at least one scale`);
      }
      for (const scale of rule.eligibleScales) {
        const key = `${rule.relation}:${String(scale)}`;
        if (seen.has(key))
          throw new Error(`ambiguous classification rule: ${key}`);
        seen.add(key);
      }
    }
  }
  function detectStructuralBreak(level, bar, definition, levelState2) {
    validateBreakDefinition(definition);
    validateResearchStructureBar(bar);
    if (!bar.sourceBarId || !bar.evidenceId) {
      throw new Error("break source bar requires sourceBarId and immutable evidenceId");
    }
    if (!level.factId || !level.definitionId || level.sourceEvidenceIds.length === 0) {
      throw new Error("broken level identity/provenance must be complete");
    }
    const eligibleRule = definition.eligibleLevels.find((rule) => rule.concept === level.concept && rule.allowedScales.includes(level.scale));
    if (!eligibleRule) {
      return {
        status: "NO_BREAK",
        events: [],
        reasons: ["LEVEL_NOT_ELIGIBLE"],
        authority: "RESEARCH_ONLY",
        liveCapitalAuthority: false
      };
    }
    const bounds = levelBoundaries(level);
    if (!bounds) {
      return {
        status: "NO_BREAK",
        events: [],
        reasons: ["LEVEL_GEOMETRY_UNSUPPORTED"],
        authority: "RESEARCH_ONLY",
        liveCapitalAuthority: false
      };
    }
    if (!Number.isFinite(bounds.low) || !Number.isFinite(bounds.high) || bounds.low > bounds.high) {
      throw new Error("broken level geometry must contain finite ordered prices");
    }
    const levelKnownAt = epoch6(level.knownAt, "level.knownAt");
    const barKnownAt = epoch6(bar.knownAt, "bar.knownAt");
    const barClosedAt = epoch6(bar.sourceClosedAt, "bar.sourceClosedAt");
    const geometryKnownAt = level.geometry.type === "POINT" ? epoch6(level.geometry.time, "level.geometry.time") : level.geometry.type === "LEVEL" || level.geometry.type === "ZONE" ? level.geometry.startAt ? epoch6(level.geometry.startAt, "level.geometry.startAt") : levelKnownAt : levelKnownAt;
    if (geometryKnownAt > levelKnownAt) {
      return {
        status: "NO_BREAK",
        events: [],
        reasons: ["LEVEL_GEOMETRY_NOT_CAUSAL"],
        authority: "RESEARCH_ONLY",
        liveCapitalAuthority: false
      };
    }
    if (levelKnownAt >= barClosedAt || levelKnownAt > barKnownAt) {
      return {
        status: "NO_BREAK",
        events: [],
        reasons: ["LEVEL_NOT_KNOWABLE_YET"],
        authority: "RESEARCH_ONLY",
        liveCapitalAuthority: false
      };
    }
    if (levelState2.levelFactId !== level.factId || !levelState2.evidenceId || !levelState2.policyRef) {
      throw new Error("level state must identify the same level and carry evidence/policy identity");
    }
    const levelStateKnownAt = epoch6(levelState2.knownAt, "levelState.knownAt");
    if (levelStateKnownAt < levelKnownAt) {
      return {
        status: "NO_BREAK",
        events: [],
        reasons: ["LEVEL_STATE_PREDATES_LEVEL"],
        authority: "RESEARCH_ONLY",
        liveCapitalAuthority: false
      };
    }
    if (levelState2.evidenceId === bar.evidenceId) {
      return {
        status: "NO_BREAK",
        events: [],
        reasons: ["LEVEL_USES_BREAK_BAR_EVIDENCE"],
        authority: "RESEARCH_ONLY",
        liveCapitalAuthority: false
      };
    }
    if (levelStateKnownAt >= barClosedAt || levelStateKnownAt > barKnownAt) {
      return {
        status: "NO_BREAK",
        events: [],
        reasons: ["LEVEL_STATE_NOT_KNOWABLE_YET"],
        authority: "RESEARCH_ONLY",
        liveCapitalAuthority: false
      };
    }
    if (levelState2.status !== "ACTIVE") {
      return {
        status: "NO_BREAK",
        events: [],
        reasons: ["LEVEL_NOT_ACTIVE"],
        authority: "RESEARCH_ONLY",
        liveCapitalAuthority: false
      };
    }
    if (level.sourceEvidenceIds.includes(bar.evidenceId)) {
      return {
        status: "NO_BREAK",
        events: [],
        reasons: ["LEVEL_USES_BREAK_BAR_EVIDENCE"],
        authority: "RESEARCH_ONLY",
        liveCapitalAuthority: false
      };
    }
    if (bar.dataStatus === "STALE") {
      return {
        status: "NO_BREAK",
        events: [],
        reasons: ["DATA_STALE"],
        authority: "RESEARCH_ONLY",
        liveCapitalAuthority: false
      };
    }
    if (bar.dataStatus === "GAP") {
      return {
        status: "NO_BREAK",
        events: [],
        reasons: ["DATA_GAP"],
        authority: "RESEARCH_ONLY",
        liveCapitalAuthority: false
      };
    }
    if (definition.mode === "CLOSE_BEYOND" && bar.dataStatus !== "FRESH_COMPLETE") {
      return {
        status: "NO_BREAK",
        events: [],
        reasons: ["BAR_NOT_CLOSED_FOR_CLOSE_BREAK"],
        authority: "RESEARCH_ONLY",
        liveCapitalAuthority: false
      };
    }
    const upObserved = definition.mode === "CLOSE_BEYOND" ? bar.close > bounds.high + definition.tolerance : bar.high > bounds.high + definition.tolerance;
    const downObserved = definition.mode === "CLOSE_BEYOND" ? bar.close < bounds.low - definition.tolerance : bar.low < bounds.low - definition.tolerance;
    const events = [];
    if (upObserved && eligibleRule.allowedDirections.includes("UP")) {
      events.push({
        breakId: `structural-break:${definition.definitionId}:${level.factId}:${bar.sourceBarId}:${bar.evidenceId}:UP:${definition.mode}`,
        direction: "UP",
        mode: definition.mode,
        levelFactId: level.factId,
        levelConcept: level.concept,
        scale: level.scale,
        timeframe: level.timeframe,
        levelPrice: bounds.high,
        observedPrice: definition.mode === "CLOSE_BEYOND" ? bar.close : bar.high,
        sourceBarId: bar.sourceBarId,
        sourceBarEvidenceId: bar.evidenceId,
        levelStateEvidenceId: levelState2.evidenceId,
        sourceClosedAt: bar.sourceClosedAt,
        knownAt: bar.knownAt,
        definitionId: definition.definitionId,
        sourceEvidenceIds: [.../* @__PURE__ */ new Set([...level.sourceEvidenceIds, levelState2.evidenceId, bar.evidenceId])],
        authority: "RESEARCH_ONLY",
        authorityEffect: "NONE"
      });
    }
    if (downObserved && eligibleRule.allowedDirections.includes("DOWN")) {
      events.push({
        breakId: `structural-break:${definition.definitionId}:${level.factId}:${bar.sourceBarId}:${bar.evidenceId}:DOWN:${definition.mode}`,
        direction: "DOWN",
        mode: definition.mode,
        levelFactId: level.factId,
        levelConcept: level.concept,
        scale: level.scale,
        timeframe: level.timeframe,
        levelPrice: bounds.low,
        observedPrice: definition.mode === "CLOSE_BEYOND" ? bar.close : bar.low,
        sourceBarId: bar.sourceBarId,
        sourceBarEvidenceId: bar.evidenceId,
        levelStateEvidenceId: levelState2.evidenceId,
        sourceClosedAt: bar.sourceClosedAt,
        knownAt: bar.knownAt,
        definitionId: definition.definitionId,
        sourceEvidenceIds: [.../* @__PURE__ */ new Set([...level.sourceEvidenceIds, levelState2.evidenceId, bar.evidenceId])],
        authority: "RESEARCH_ONLY",
        authorityEffect: "NONE"
      });
    }
    return {
      status: events.length > 0 ? "BREAK_OBSERVED" : "NO_BREAK",
      events,
      reasons: events.length > 0 ? ["BREAK_OBSERVED"] : ["NO_BREAK"],
      authority: "RESEARCH_ONLY",
      liveCapitalAuthority: false
    };
  }
  function classifyStructuralBreak(input) {
    validateClassificationDefinition2(input.definition);
    const evaluatedAt = epoch6(input.evaluatedAt, "evaluatedAt");
    if (!input.breakEvent.breakId || !input.breakEvent.definitionId || !input.breakEvent.sourceBarEvidenceId || !input.breakEvent.levelStateEvidenceId || input.breakEvent.sourceEvidenceIds.length === 0) {
      throw new Error("structural break event identity/provenance must be complete");
    }
    if (input.breakEvent.sourceBarEvidenceId === input.breakEvent.levelStateEvidenceId || !input.breakEvent.sourceEvidenceIds.includes(input.breakEvent.sourceBarEvidenceId) || !input.breakEvent.sourceEvidenceIds.includes(input.breakEvent.levelStateEvidenceId)) {
      throw new Error("structural break provenance roles must be distinct and present in sourceEvidenceIds");
    }
    const breakKnownAt = epoch6(input.breakEvent.knownAt, "breakEvent.knownAt");
    const breakSourceClosedAt = epoch6(input.breakEvent.sourceClosedAt, "breakEvent.sourceClosedAt");
    if (input.breakEvent.mode === "CLOSE_BEYOND" && breakKnownAt < breakSourceClosedAt) {
      throw new Error("close-based structural break cannot be known before source close");
    }
    const biasKnownAt = epoch6(input.priorBias.knownAt, "priorBias.knownAt");
    if (breakKnownAt > evaluatedAt) {
      return {
        status: "UNCLASSIFIED_STRUCTURAL_BREAK",
        relation: relationFor(input.priorBias.bias, input.breakEvent.direction),
        classification: null,
        fact: null,
        reasons: ["BREAK_FROM_FUTURE"],
        authority: "RESEARCH_ONLY",
        liveCapitalAuthority: false
      };
    }
    if (!input.priorBias.evidenceId || !input.priorBias.definitionId) {
      throw new Error("prior bias requires evidenceId and definitionId");
    }
    if (biasKnownAt >= breakKnownAt) {
      return {
        status: "UNCLASSIFIED_STRUCTURAL_BREAK",
        relation: relationFor(input.priorBias.bias, input.breakEvent.direction),
        classification: null,
        fact: null,
        reasons: ["BIAS_NOT_PRIOR"],
        authority: "RESEARCH_ONLY",
        liveCapitalAuthority: false
      };
    }
    if (input.breakEvent.sourceBarEvidenceId === input.priorBias.evidenceId) {
      return {
        status: "UNCLASSIFIED_STRUCTURAL_BREAK",
        relation: relationFor(input.priorBias.bias, input.breakEvent.direction),
        classification: null,
        fact: null,
        reasons: ["BIAS_USES_BREAK_BAR_EVIDENCE"],
        authority: "RESEARCH_ONLY",
        liveCapitalAuthority: false
      };
    }
    const relation = relationFor(input.priorBias.bias, input.breakEvent.direction);
    const rule = input.definition.rules.find((candidate) => candidate.relation === relation && candidate.eligibleScales.includes(input.breakEvent.scale));
    if (!rule) {
      return {
        status: "UNCLASSIFIED_STRUCTURAL_BREAK",
        relation,
        classification: null,
        fact: null,
        reasons: ["NO_PROFILE_RULE"],
        authority: "RESEARCH_ONLY",
        liveCapitalAuthority: false
      };
    }
    let factKnownAt = breakKnownAt;
    const extraEvidenceIds = [input.priorBias.evidenceId];
    if (rule.requireDisplacement) {
      if (!input.displacement?.present) {
        return {
          status: "UNCLASSIFIED_STRUCTURAL_BREAK",
          relation,
          classification: null,
          fact: null,
          reasons: ["DISPLACEMENT_REQUIRED"],
          authority: "RESEARCH_ONLY",
          liveCapitalAuthority: false
        };
      }
      if (!input.displacement.evidenceId || !input.displacement.definitionId) {
        throw new Error("displacement evidence requires evidenceId and definitionId");
      }
      const displacementKnownAt = epoch6(input.displacement.knownAt, "displacement.knownAt");
      if (displacementKnownAt > evaluatedAt) {
        return {
          status: "UNCLASSIFIED_STRUCTURAL_BREAK",
          relation,
          classification: null,
          fact: null,
          reasons: ["DISPLACEMENT_FROM_FUTURE"],
          authority: "RESEARCH_ONLY",
          liveCapitalAuthority: false
        };
      }
      if (input.displacement.direction === null) {
        return {
          status: "UNCLASSIFIED_STRUCTURAL_BREAK",
          relation,
          classification: null,
          fact: null,
          reasons: ["DISPLACEMENT_DIRECTION_MISSING"],
          authority: "RESEARCH_ONLY",
          liveCapitalAuthority: false
        };
      }
      if (input.displacement.direction !== input.breakEvent.direction) {
        return {
          status: "UNCLASSIFIED_STRUCTURAL_BREAK",
          relation,
          classification: null,
          fact: null,
          reasons: ["DISPLACEMENT_DIRECTION_MISMATCH"],
          authority: "RESEARCH_ONLY",
          liveCapitalAuthority: false
        };
      }
      factKnownAt = Math.max(factKnownAt, displacementKnownAt);
      extraEvidenceIds.push(input.displacement.evidenceId);
    }
    if (factKnownAt > evaluatedAt) {
      return {
        status: "UNCLASSIFIED_STRUCTURAL_BREAK",
        relation,
        classification: null,
        fact: null,
        reasons: ["DISPLACEMENT_FROM_FUTURE"],
        authority: "RESEARCH_ONLY",
        liveCapitalAuthority: false
      };
    }
    const classification = rule.classification;
    const fact = {
      factId: `structural-classification:${input.definition.definitionId}:${input.breakEvent.breakId}:${classification}`,
      concept: classification,
      maturity: "RESEARCH_DERIVED",
      scale: input.breakEvent.scale,
      timeframe: input.breakEvent.timeframe,
      side: input.breakEvent.direction === "UP" ? "BUY" : "SELL",
      knownAt: new Date(factKnownAt).toISOString(),
      definitionId: input.definition.definitionId,
      sourceEvidenceIds: [
        .../* @__PURE__ */ new Set([...input.breakEvent.sourceEvidenceIds, ...extraEvidenceIds])
      ],
      geometry: {
        type: "LEVEL",
        price: input.breakEvent.levelPrice,
        startAt: input.breakEvent.knownAt
      },
      label: `${String(input.breakEvent.scale ?? "UNSCALED")} ${classification} ${input.breakEvent.direction === "UP" ? "\u2191" : "\u2193"}`,
      authority: "RESEARCH_ONLY",
      authorityEffect: "NONE"
    };
    return {
      status: "CLASSIFIED",
      relation,
      classification,
      fact,
      reasons: ["CLASSIFIED"],
      authority: "RESEARCH_ONLY",
      liveCapitalAuthority: false
    };
  }

  // ../../../packages/decision-core/dist/research/retestDerivation.js
  function epoch7(value, label) {
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) {
      throw new Error(`${label} is not a valid ISO timestamp: ${value}`);
    }
    return parsed;
  }
  function validateDefinition2(definition) {
    if (!definition.definitionId) {
      throw new Error("retest definitionId must be non-empty");
    }
    if (definition.eligibleBreakModes.length === 0) {
      throw new Error("retest definition requires at least one eligible break mode");
    }
    if (new Set(definition.eligibleBreakModes).size !== definition.eligibleBreakModes.length) {
      throw new Error("retest definition repeats an eligible break mode");
    }
    if (definition.eligibleBreakModes.some((mode) => mode !== "CLOSE_BEYOND" && mode !== "TOUCH_BEYOND")) {
      throw new Error("retest definition contains an unsupported break mode");
    }
    if (definition.holdTiming !== "TOUCH_BAR_CLOSE_ALLOWED" && definition.holdTiming !== "LATER_BAR_REQUIRED") {
      throw new Error("unsupported retest hold timing");
    }
    for (const [label, value] of Object.entries({
      touchTolerance: definition.touchTolerance,
      holdTolerance: definition.holdTolerance,
      maximumPenetration: definition.maximumPenetration
    })) {
      if (!Number.isFinite(value) || value < 0) {
        throw new Error(`${label} must be finite and >= 0`);
      }
    }
    if (definition.holdRule !== "CLOSE_VALID_SIDE") {
      throw new Error("unsupported retest hold rule");
    }
  }
  function validateBreakEvent(event3) {
    if (!event3.breakId || !event3.levelFactId || !event3.timeframe || !event3.definitionId || !event3.sourceBarId || !event3.sourceBarEvidenceId || !event3.levelStateEvidenceId || event3.sourceEvidenceIds.length === 0) {
      throw new Error("retest break event identity/provenance must be complete");
    }
    if (event3.sourceBarEvidenceId === event3.levelStateEvidenceId || !event3.sourceEvidenceIds.includes(event3.sourceBarEvidenceId) || !event3.sourceEvidenceIds.includes(event3.levelStateEvidenceId)) {
      throw new Error("retest break provenance roles must be distinct and present");
    }
    if (!Number.isFinite(event3.levelPrice) || !Number.isFinite(event3.observedPrice)) {
      throw new Error("retest break prices must be finite");
    }
    const knownAt = epoch7(event3.knownAt, "breakEvent.knownAt");
    const sourceClosedAt = epoch7(event3.sourceClosedAt, "breakEvent.sourceClosedAt");
    if (event3.mode === "CLOSE_BEYOND" && knownAt < sourceClosedAt) {
      throw new Error("close-based break cannot be known before source close");
    }
  }
  function noRetest(reason) {
    return {
      status: "NO_RETEST",
      retest: null,
      fact: null,
      reasons: [reason],
      authority: "RESEARCH_ONLY",
      liveCapitalAuthority: false
    };
  }
  function closeHolds(direction, close, levelPrice, tolerance) {
    return direction === "UP" ? close >= levelPrice - tolerance : close <= levelPrice + tolerance;
  }
  function penetrationFor(direction, bar, levelPrice) {
    return direction === "UP" ? Math.max(0, levelPrice - bar.low) : Math.max(0, bar.high - levelPrice);
  }
  function validatePriorTouch(priorTouch, breakEvent, definition, bar) {
    if (!priorTouch.retestId || !priorTouch.sourceBarEvidenceId || !priorTouch.touchAnchorEvidenceId || priorTouch.sourceEvidenceIds.length === 0) {
      throw new Error("prior retest touch identity/provenance must be complete");
    }
    if (!priorTouch.sourceEvidenceIds.includes(priorTouch.sourceBarEvidenceId) || !priorTouch.sourceEvidenceIds.includes(priorTouch.touchAnchorEvidenceId)) {
      throw new Error("prior retest provenance roles must be present in sourceEvidenceIds");
    }
    if (priorTouch.breakId !== breakEvent.breakId || priorTouch.levelFactId !== breakEvent.levelFactId || priorTouch.definitionId !== definition.definitionId || priorTouch.direction !== breakEvent.direction || priorTouch.scale !== breakEvent.scale || priorTouch.timeframe !== breakEvent.timeframe || priorTouch.levelPrice !== breakEvent.levelPrice) {
      throw new Error("prior retest touch belongs to a different break/definition");
    }
    const expectedLow = breakEvent.levelPrice - definition.touchTolerance;
    const expectedHigh = breakEvent.levelPrice + definition.touchTolerance;
    if (priorTouch.touchZone.low !== expectedLow || priorTouch.touchZone.high !== expectedHigh) {
      throw new Error("prior retest touch geometry does not match the current definition");
    }
    if (priorTouch.held || priorTouch.status === "RETEST_HELD") {
      throw new Error("prior retest touch is already held");
    }
    const priorKnownAt = epoch7(priorTouch.knownAt, "priorTouch.knownAt");
    const priorClosedAt = epoch7(priorTouch.sourceClosedAt, "priorTouch.sourceClosedAt");
    const breakKnownAt = epoch7(breakEvent.knownAt, "breakEvent.knownAt");
    const breakClosedAt = epoch7(breakEvent.sourceClosedAt, "breakEvent.sourceClosedAt");
    if (priorKnownAt <= breakKnownAt || priorClosedAt <= breakClosedAt) {
      throw new Error("prior retest touch must occur strictly after the break");
    }
    if (priorKnownAt >= epoch7(bar.knownAt, "bar.knownAt") || priorClosedAt >= epoch7(bar.sourceClosedAt, "bar.sourceClosedAt")) {
      throw new Error("prior retest touch must be strictly earlier than the current bar");
    }
    if (priorTouch.sourceBarEvidenceId === bar.evidenceId || priorTouch.sourceEvidenceIds.includes(bar.evidenceId)) {
      throw new Error("current retest bar evidence cannot be reused from prior touch provenance");
    }
  }
  function derivePostBreakRetest(input) {
    const { breakEvent, bar, definition } = input;
    validateDefinition2(definition);
    validateBreakEvent(breakEvent);
    validateResearchStructureBar(bar);
    if (!bar.sourceBarId || !bar.evidenceId) {
      throw new Error("retest source bar requires sourceBarId and immutable evidenceId");
    }
    if (!definition.eligibleBreakModes.includes(breakEvent.mode)) {
      return noRetest("BREAK_MODE_NOT_ELIGIBLE");
    }
    const breakKnownAt = epoch7(breakEvent.knownAt, "breakEvent.knownAt");
    const breakSourceClosedAt = epoch7(breakEvent.sourceClosedAt, "breakEvent.sourceClosedAt");
    const barKnownAt = epoch7(bar.knownAt, "bar.knownAt");
    const barSourceClosedAt = epoch7(bar.sourceClosedAt, "bar.sourceClosedAt");
    if (bar.sourceBarId === breakEvent.sourceBarId || barSourceClosedAt <= breakSourceClosedAt || barKnownAt <= breakKnownAt) {
      return noRetest("BAR_NOT_AFTER_BREAK");
    }
    if (breakEvent.sourceEvidenceIds.includes(bar.evidenceId)) {
      return noRetest("BAR_USES_BREAK_EVIDENCE");
    }
    if (bar.dataStatus === "INCOMPLETE") {
      return noRetest("BAR_NOT_CLOSED");
    }
    if (bar.dataStatus === "STALE") {
      return noRetest("DATA_STALE");
    }
    if (bar.dataStatus === "GAP") {
      return noRetest("DATA_GAP");
    }
    const priorTouch = input.priorTouch ?? null;
    if (priorTouch) {
      validatePriorTouch(priorTouch, breakEvent, definition, bar);
    }
    const zoneLow = breakEvent.levelPrice - definition.touchTolerance;
    const zoneHigh = breakEvent.levelPrice + definition.touchTolerance;
    if (!Number.isFinite(zoneLow) || !Number.isFinite(zoneHigh) || zoneLow > zoneHigh) {
      throw new Error("retest touch zone must contain finite ordered prices");
    }
    const touchedOnThisBar = bar.high >= zoneLow && bar.low <= zoneHigh;
    const usablePriorTouch = priorTouch !== null && priorTouch.penetrationWithinLimit;
    const effectivePriorTouch = usablePriorTouch ? priorTouch : null;
    if (!touchedOnThisBar && !usablePriorTouch) {
      return noRetest("TOUCH_ZONE_NOT_REACHED");
    }
    const penetration = penetrationFor(breakEvent.direction, bar, breakEvent.levelPrice);
    const penetrationWithinLimit = penetration <= definition.maximumPenetration;
    const holdAllowed = definition.holdTiming === "TOUCH_BAR_CLOSE_ALLOWED" ? touchedOnThisBar || effectivePriorTouch !== null : effectivePriorTouch !== null;
    const closeValid = definition.holdRule === "CLOSE_VALID_SIDE" && closeHolds(breakEvent.direction, bar.close, breakEvent.levelPrice, definition.holdTolerance);
    const held = holdAllowed && closeValid && penetrationWithinLimit;
    let status;
    const reasons = [];
    if (held) {
      status = "RETEST_HELD";
      reasons.push("HOLD_VALID");
    } else if (touchedOnThisBar && definition.holdTiming === "LATER_BAR_REQUIRED" && effectivePriorTouch === null) {
      status = "RETEST_TOUCHED";
      reasons.push("TOUCH_OBSERVED", "HOLD_PENDING_LATER_BAR");
    } else {
      status = "RETEST_TOUCH_FAILED_HOLD";
      if (touchedOnThisBar)
        reasons.push("TOUCH_OBSERVED");
      if (!penetrationWithinLimit)
        reasons.push("MAX_PENETRATION_EXCEEDED");
      if (!closeValid)
        reasons.push("HOLD_CLOSE_FAILED");
      if (definition.holdTiming === "LATER_BAR_REQUIRED" && effectivePriorTouch === null) {
        reasons.push("HOLD_PENDING_LATER_BAR");
      }
    }
    const touchAnchorEvidenceId = effectivePriorTouch?.touchAnchorEvidenceId ?? bar.evidenceId;
    const retestId = `retest:${definition.definitionId}:${breakEvent.breakId}:touch:${touchAnchorEvidenceId}:observation:${bar.sourceBarId}:${bar.evidenceId}`;
    const sourceEvidenceIds = [
      .../* @__PURE__ */ new Set([
        ...breakEvent.sourceEvidenceIds,
        ...effectivePriorTouch?.sourceEvidenceIds ?? [],
        bar.evidenceId
      ])
    ];
    const retest = {
      retestId,
      status,
      breakId: breakEvent.breakId,
      levelFactId: breakEvent.levelFactId,
      direction: breakEvent.direction,
      scale: breakEvent.scale,
      timeframe: breakEvent.timeframe,
      levelPrice: breakEvent.levelPrice,
      touchZone: {
        low: zoneLow,
        high: zoneHigh
      },
      bar: {
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close
      },
      touchedOnThisBar,
      touchAnchorEvidenceId,
      held,
      penetration,
      penetrationWithinLimit,
      priorTouchId: effectivePriorTouch?.retestId ?? null,
      sourceBarId: bar.sourceBarId,
      sourceBarEvidenceId: bar.evidenceId,
      sourceClosedAt: bar.sourceClosedAt,
      knownAt: bar.knownAt,
      definitionId: definition.definitionId,
      sourceEvidenceIds,
      authority: "RESEARCH_ONLY",
      authorityEffect: "NONE"
    };
    const fact = {
      factId: `retest-fact:${retestId}`,
      concept: "RETEST",
      maturity: "RESEARCH_DERIVED",
      scale: breakEvent.scale,
      timeframe: breakEvent.timeframe,
      side: breakEvent.direction === "UP" ? "BUY" : "SELL",
      knownAt: bar.knownAt,
      definitionId: definition.definitionId,
      sourceEvidenceIds,
      geometry: {
        type: "ZONE",
        low: zoneLow,
        high: zoneHigh,
        startAt: breakEvent.knownAt,
        endAt: bar.knownAt
      },
      label: status === "RETEST_HELD" ? "RETEST HELD" : status === "RETEST_TOUCHED" ? "RETEST TOUCHED" : "RETEST TOUCH / HOLD FAILED",
      authority: "RESEARCH_ONLY",
      authorityEffect: "NONE"
    };
    return {
      status,
      retest,
      fact,
      reasons,
      authority: "RESEARCH_ONLY",
      liveCapitalAuthority: false
    };
  }
  function retestAssessmentToLifecycleObservation(assessment) {
    const retest = assessment.retest;
    if (!retest)
      return null;
    return {
      evidenceId: retest.retestId,
      sourceBarId: retest.sourceBarId,
      sourceClosedAt: retest.sourceClosedAt,
      knownAt: retest.knownAt,
      dataStatus: "FRESH_COMPLETE",
      retestTouched: true,
      ...retest.held ? { retestHeld: true } : {}
    };
  }

  // ../../../packages/decision-core/dist/research/lifecycleObserver.js
  function epoch8(value, label) {
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed))
      throw new Error(`${label} is not a valid ISO timestamp: ${value}`);
    return parsed;
  }
  function lifecycleFromRouteState(terminal, confirmedRoute, retest, continuation) {
    if (terminal)
      return terminal;
    if (confirmedRoute)
      return "LIFECYCLE_CONFIRMED";
    if (retest === "RETEST_HELD")
      return "RETEST_HELD";
    if (continuation === "CONTINUATION_HELD")
      return "CONTINUATION_HELD";
    if (retest === "RETEST_TOUCHED")
      return "RETEST_TOUCHED";
    return "BREAK_CONFIRMED";
  }
  function orderedObservations(observations) {
    const seen = /* @__PURE__ */ new Set();
    for (const item of observations) {
      if (!item.evidenceId)
        throw new Error("lifecycle observation evidenceId must be non-empty");
      if (seen.has(item.evidenceId)) {
        throw new Error(`duplicate lifecycle evidenceId: ${item.evidenceId}`);
      }
      seen.add(item.evidenceId);
      const knownAt = epoch8(item.knownAt, "knownAt");
      const sourceClosedAt = epoch8(item.sourceClosedAt, "sourceClosedAt");
      if (item.dataStatus !== "INCOMPLETE" && knownAt < sourceClosedAt) {
        throw new Error(`closed lifecycle evidence cannot be known before its source bar closes: ${item.evidenceId}`);
      }
    }
    return [...observations].sort((a, b) => {
      const byKnownAt = epoch8(a.knownAt, "knownAt") - epoch8(b.knownAt, "knownAt");
      if (byKnownAt !== 0)
        return byKnownAt;
      const byClose = epoch8(a.sourceClosedAt, "sourceClosedAt") - epoch8(b.sourceClosedAt, "sourceClosedAt");
      if (byClose !== 0)
        return byClose;
      return a.evidenceId.localeCompare(b.evidenceId);
    });
  }
  function observeStructuralLifecycle(seed, observations) {
    if (!seed.candidateId)
      throw new Error("candidateId must be non-empty");
    if (!seed.setupIdentity)
      throw new Error("setupIdentity must be non-empty");
    const breakKnownAt = epoch8(seed.breakKnownAt, "breakKnownAt");
    const breakSourceClosedAt = epoch8(seed.breakSourceClosedAt, "breakSourceClosedAt");
    if (breakKnownAt < breakSourceClosedAt) {
      throw new Error("breakKnownAt cannot precede the source bar close");
    }
    let retest = "BREAK_CONFIRMED";
    let continuation = seed.continuationReferenceEnabled ? "BREAK_CONFIRMED" : "DISABLED";
    let terminal = null;
    let confirmedRoute = null;
    const trace = [];
    const current = () => lifecycleFromRouteState(terminal, confirmedRoute, retest, continuation);
    trace.push({
      evidenceId: seed.breakEvidenceId,
      sourceBarId: seed.breakSourceBarId,
      sourceClosedAt: seed.breakSourceClosedAt,
      knownAt: seed.breakKnownAt,
      action: "OBSERVE",
      reasonCode: "BREAK_SEED_ACCEPTED",
      from: "BREAK_CONFIRMED",
      to: "BREAK_CONFIRMED",
      route: null
    });
    const push = (observation, action, reasonCode, from, to, route = null) => {
      trace.push({
        evidenceId: observation.evidenceId,
        sourceBarId: observation.sourceBarId,
        sourceClosedAt: observation.sourceClosedAt,
        knownAt: observation.knownAt,
        action,
        reasonCode,
        from,
        to,
        route
      });
    };
    for (const observation of orderedObservations(observations)) {
      const before = current();
      if (terminal) {
        push(observation, "IGNORE", "TERMINAL_PRESERVED", before, before, confirmedRoute);
        continue;
      }
      const knownAt = epoch8(observation.knownAt, "knownAt");
      const sourceClosedAt = epoch8(observation.sourceClosedAt, "sourceClosedAt");
      if (knownAt <= breakKnownAt || sourceClosedAt <= breakSourceClosedAt) {
        push(observation, "IGNORE", "BREAK_BAR_CANNOT_CONFIRM", before, before);
        continue;
      }
      if (observation.expired) {
        terminal = "EXPIRED";
        push(observation, "TERMINATE", "EXPIRED", before, "EXPIRED");
        continue;
      }
      if (observation.dataStatus === "INCOMPLETE") {
        push(observation, "IGNORE", "BAR_NOT_CLOSED", before, before);
        continue;
      }
      if (observation.dataStatus === "STALE") {
        push(observation, "IGNORE", "DATA_STALE", before, before);
        continue;
      }
      if (observation.dataStatus === "GAP") {
        push(observation, "IGNORE", "DATA_GAP", before, before);
        continue;
      }
      if (observation.invalidated) {
        terminal = "INVALIDATED";
        push(observation, "TERMINATE", "INVALIDATED", before, "INVALIDATED");
        continue;
      }
      let changed = false;
      if (observation.retestTouched && retest === "BREAK_CONFIRMED") {
        const from = current();
        retest = "RETEST_TOUCHED";
        push(observation, "ADVANCE", "RETEST_TOUCHED", from, current(), "RETEST");
        changed = true;
      }
      if (observation.retestHeld && retest !== "RETEST_HELD") {
        if (retest === "RETEST_TOUCHED") {
          const from = current();
          retest = "RETEST_HELD";
          push(observation, "ADVANCE", "RETEST_HELD", from, current(), "RETEST");
          changed = true;
        } else {
          push(observation, "IGNORE", "CONFIRMATION_WITHOUT_HELD_ROUTE", current(), current(), "RETEST");
        }
      }
      if (observation.continuation) {
        if (!observation.continuation.extensionBudgetProvenanceId) {
          throw new Error("continuation extensionBudgetProvenanceId must be non-empty");
        }
        if (!seed.continuationReferenceEnabled) {
          push(observation, "IGNORE", "CONTINUATION_ROUTE_DISABLED", current(), current(), "CONTINUATION");
        } else if (!observation.continuation.validSideHeld) {
          push(observation, "IGNORE", "CONTINUATION_VALID_SIDE_FAILED", current(), current(), "CONTINUATION");
        } else if (!observation.continuation.extensionBudgetOk) {
          push(observation, "IGNORE", "EXTENSION_BUDGET_FAILED", current(), current(), "CONTINUATION");
        } else if (continuation === "BREAK_CONFIRMED") {
          const from = current();
          continuation = "CONTINUATION_HELD";
          push(observation, "ADVANCE", "CONTINUATION_HELD", from, current(), "CONTINUATION");
          changed = true;
        }
      }
      if (observation.confirmRoute && !confirmedRoute) {
        const held = observation.confirmRoute === "RETEST" ? retest === "RETEST_HELD" : seed.continuationReferenceEnabled && continuation === "CONTINUATION_HELD";
        if (!held) {
          push(observation, "IGNORE", observation.confirmRoute === "CONTINUATION" && !seed.continuationReferenceEnabled ? "CONTINUATION_ROUTE_DISABLED" : "CONFIRMATION_WITHOUT_HELD_ROUTE", current(), current(), observation.confirmRoute);
        } else {
          const from = current();
          confirmedRoute = observation.confirmRoute;
          push(observation, "ADVANCE", "LIFECYCLE_CONFIRMED", from, "LIFECYCLE_CONFIRMED", confirmedRoute);
          changed = true;
        }
      }
      if (!changed) {
        push(observation, "OBSERVE", "NO_STRUCTURAL_CHANGE", before, current(), null);
      }
    }
    return {
      candidateId: seed.candidateId,
      setupIdentity: seed.setupIdentity,
      setupType: seed.setupType,
      side: seed.side,
      lifecycle: current(),
      terminal,
      confirmedRoute,
      routeState: {
        retest,
        continuation
      },
      trace,
      authority: "RESEARCH_ONLY",
      liveCapitalAuthority: false
    };
  }

  // ../../../packages/decision-core/dist/research/derivedStructuralReplay.js
  var DERIVED_STRUCTURAL_SCENARIO_ID = "replay-eurusd-derived-structure";
  var TIMEFRAME = "M5";
  var bars = [
    {
      evidenceId: "ohlc-0735",
      sourceBarId: "EURUSD:M5:0735",
      open: 1.1738,
      high: 1.1744,
      low: 1.1736,
      close: 1.1741,
      sourceClosedAt: "2026-09-24T07:40:00Z",
      knownAt: "2026-09-24T07:40:01Z",
      dataStatus: "FRESH_COMPLETE"
    },
    {
      evidenceId: "ohlc-0740",
      sourceBarId: "EURUSD:M5:0740",
      open: 1.1741,
      high: 1.1749,
      low: 1.1739,
      close: 1.1747,
      sourceClosedAt: "2026-09-24T07:45:00Z",
      knownAt: "2026-09-24T07:45:01Z",
      dataStatus: "FRESH_COMPLETE"
    },
    {
      evidenceId: "ohlc-0745",
      sourceBarId: "EURUSD:M5:0745",
      open: 1.1747,
      high: 1.1754,
      low: 1.1744,
      close: 1.175,
      sourceClosedAt: "2026-09-24T07:50:00Z",
      knownAt: "2026-09-24T07:50:01Z",
      dataStatus: "FRESH_COMPLETE"
    },
    {
      evidenceId: "ohlc-0750",
      sourceBarId: "EURUSD:M5:0750",
      open: 1.175,
      high: 1.176,
      low: 1.1748,
      close: 1.1756,
      sourceClosedAt: "2026-09-24T07:55:00Z",
      knownAt: "2026-09-24T07:55:01Z",
      dataStatus: "FRESH_COMPLETE"
    },
    {
      evidenceId: "ohlc-0755",
      sourceBarId: "EURUSD:M5:0755",
      open: 1.1754,
      high: 1.1755,
      low: 1.1749,
      close: 1.1752,
      sourceClosedAt: "2026-09-24T08:00:00Z",
      knownAt: "2026-09-24T08:00:01Z",
      dataStatus: "FRESH_COMPLETE"
    },
    {
      evidenceId: "ohlc-0800",
      sourceBarId: "EURUSD:M5:0800",
      open: 1.1752,
      high: 1.1758,
      low: 1.175,
      close: 1.1757,
      sourceClosedAt: "2026-09-24T08:05:00Z",
      knownAt: "2026-09-24T08:05:01Z",
      dataStatus: "FRESH_COMPLETE"
    },
    {
      evidenceId: "ohlc-0805",
      sourceBarId: "EURUSD:M5:0805",
      open: 1.1757,
      high: 1.1766,
      low: 1.1756,
      close: 1.1764,
      sourceClosedAt: "2026-09-24T08:10:00Z",
      knownAt: "2026-09-24T08:10:01Z",
      dataStatus: "FRESH_COMPLETE"
    },
    {
      evidenceId: "ohlc-0810",
      sourceBarId: "EURUSD:M5:0810",
      open: 1.1764,
      high: 1.1765,
      low: 1.17595,
      close: 1.17618,
      sourceClosedAt: "2026-09-24T08:15:00Z",
      knownAt: "2026-09-24T08:15:01Z",
      dataStatus: "FRESH_COMPLETE"
    },
    {
      evidenceId: "ohlc-0815",
      sourceBarId: "EURUSD:M5:0815",
      open: 1.17618,
      high: 1.17655,
      low: 1.17615,
      close: 1.1763,
      sourceClosedAt: "2026-09-24T08:20:00Z",
      knownAt: "2026-09-24T08:20:01Z",
      dataStatus: "FRESH_COMPLETE"
    },
    {
      evidenceId: "ohlc-0820",
      sourceBarId: "EURUSD:M5:0820",
      open: 1.1763,
      high: 1.17662,
      low: 1.1761,
      close: 1.1765,
      sourceClosedAt: "2026-09-24T08:25:00Z",
      knownAt: "2026-09-24T08:25:01Z",
      dataStatus: "FRESH_COMPLETE"
    },
    {
      evidenceId: "ohlc-0825",
      sourceBarId: "EURUSD:M5:0825",
      open: 1.1765,
      high: 1.17655,
      low: 1.17555,
      close: 1.1761,
      sourceClosedAt: "2026-09-24T08:30:00Z",
      knownAt: "2026-09-24T08:30:01Z",
      dataStatus: "FRESH_COMPLETE"
    },
    {
      evidenceId: "ohlc-0830",
      sourceBarId: "EURUSD:M5:0830",
      open: 1.1761,
      high: 1.1769,
      low: 1.1758,
      close: 1.1765,
      sourceClosedAt: "2026-09-24T08:35:00Z",
      knownAt: "2026-09-24T08:35:01Z",
      dataStatus: "FRESH_COMPLETE"
    },
    {
      evidenceId: "ohlc-0835",
      sourceBarId: "EURUSD:M5:0835",
      open: 1.1765,
      high: 1.17655,
      low: 1.17555,
      close: 1.17558,
      sourceClosedAt: "2026-09-24T08:40:00Z",
      knownAt: "2026-09-24T08:40:01Z",
      dataStatus: "FRESH_COMPLETE"
    },
    {
      evidenceId: "ohlc-0840",
      sourceBarId: "EURUSD:M5:0840",
      open: 1.17558,
      high: 1.1761,
      low: 1.1754,
      close: 1.1759,
      sourceClosedAt: "2026-09-24T08:45:00Z",
      knownAt: "2026-09-24T08:45:01Z",
      dataStatus: "FRESH_COMPLETE"
    },
    {
      evidenceId: "ohlc-0845",
      sourceBarId: "EURUSD:M5:0845",
      open: 1.1759,
      high: 1.1763,
      low: 1.1758,
      close: 1.17615,
      sourceClosedAt: "2026-09-24T08:50:00Z",
      knownAt: "2026-09-24T08:50:01Z",
      dataStatus: "FRESH_COMPLETE"
    },
    {
      evidenceId: "ohlc-0850",
      sourceBarId: "EURUSD:M5:0850",
      open: 1.17615,
      high: 1.17635,
      low: 1.1759,
      close: 1.1761,
      sourceClosedAt: "2026-09-24T08:55:00Z",
      knownAt: "2026-09-24T08:55:01Z",
      dataStatus: "FRESH_COMPLETE"
    },
    {
      evidenceId: "ohlc-0855",
      sourceBarId: "EURUSD:M5:0855",
      open: 1.1761,
      high: 1.17625,
      low: 1.17555,
      close: 1.1759,
      sourceClosedAt: "2026-09-24T09:00:00Z",
      knownAt: "2026-09-24T09:00:01Z",
      dataStatus: "FRESH_COMPLETE"
    },
    {
      evidenceId: "ohlc-0900",
      sourceBarId: "EURUSD:M5:0900",
      open: 1.1759,
      high: 1.1763,
      low: 1.1759,
      close: 1.1762,
      sourceClosedAt: "2026-09-24T09:05:00Z",
      knownAt: "2026-09-24T09:05:01Z",
      dataStatus: "FRESH_COMPLETE"
    },
    {
      evidenceId: "ohlc-0905",
      sourceBarId: "EURUSD:M5:0905",
      open: 1.1762,
      high: 1.17645,
      low: 1.176,
      close: 1.1763,
      sourceClosedAt: "2026-09-24T09:10:00Z",
      knownAt: "2026-09-24T09:10:01Z",
      dataStatus: "FRESH_COMPLETE"
    },
    {
      evidenceId: "ohlc-0910",
      sourceBarId: "EURUSD:M5:0910",
      open: 1.1763,
      high: 1.17635,
      low: 1.1757,
      close: 1.176,
      sourceClosedAt: "2026-09-24T09:15:00Z",
      knownAt: "2026-09-24T09:15:01Z",
      dataStatus: "FRESH_COMPLETE"
    },
    {
      evidenceId: "ohlc-0915",
      sourceBarId: "EURUSD:M5:0915",
      open: 1.176,
      high: 1.1764,
      low: 1.17595,
      close: 1.1763,
      sourceClosedAt: "2026-09-24T09:20:00Z",
      knownAt: "2026-09-24T09:20:01Z",
      dataStatus: "FRESH_COMPLETE"
    },
    {
      evidenceId: "ohlc-0920",
      sourceBarId: "EURUSD:M5:0920",
      open: 1.1763,
      high: 1.17645,
      low: 1.17578,
      close: 1.1761,
      sourceClosedAt: "2026-09-24T09:25:00Z",
      knownAt: "2026-09-24T09:25:01Z",
      dataStatus: "FRESH_COMPLETE"
    },
    {
      evidenceId: "ohlc-0925",
      sourceBarId: "EURUSD:M5:0925",
      open: 1.1761,
      high: 1.1763,
      low: 1.17575,
      close: 1.17588,
      sourceClosedAt: "2026-09-24T09:30:00Z",
      knownAt: "2026-09-24T09:30:01Z",
      dataStatus: "FRESH_COMPLETE"
    },
    {
      evidenceId: "ohlc-0930",
      sourceBarId: "EURUSD:M5:0930",
      open: 1.17588,
      high: 1.176,
      low: 1.1756,
      close: 1.1758,
      sourceClosedAt: "2026-09-24T09:35:00Z",
      knownAt: "2026-09-24T09:35:01Z",
      dataStatus: "FRESH_COMPLETE"
    }
  ];
  var frames = [
    { evaluatedAt: "2026-09-24T08:00:01Z" },
    { evaluatedAt: "2026-09-24T08:05:01Z" },
    { evaluatedAt: "2026-09-24T08:10:01Z" },
    { evaluatedAt: "2026-09-24T08:15:01Z" },
    { evaluatedAt: "2026-09-24T08:20:01Z" },
    { evaluatedAt: "2026-09-24T08:25:01Z" },
    { evaluatedAt: "2026-09-24T08:30:01Z" },
    { evaluatedAt: "2026-09-24T08:35:01Z" },
    { evaluatedAt: "2026-09-24T08:40:01Z" },
    { evaluatedAt: "2026-09-24T08:45:01Z" },
    { evaluatedAt: "2026-09-24T08:50:01Z" },
    { evaluatedAt: "2026-09-24T08:55:01Z" },
    { evaluatedAt: "2026-09-24T09:00:01Z" },
    { evaluatedAt: "2026-09-24T09:05:01Z" },
    { evaluatedAt: "2026-09-24T09:10:01Z" },
    { evaluatedAt: "2026-09-24T09:15:01Z" },
    { evaluatedAt: "2026-09-24T09:20:01Z" },
    { evaluatedAt: "2026-09-24T09:25:01Z" },
    { evaluatedAt: "2026-09-24T09:30:01Z" },
    { evaluatedAt: "2026-09-24T09:35:01Z" }
  ];
  var breakDefinition = {
    definitionId: "derived-alpha:break-close:v1",
    mode: "CLOSE_BEYOND",
    tolerance: 1e-4,
    eligibleLevels: [
      {
        concept: "SWING_HIGH",
        allowedDirections: ["UP"],
        allowedScales: ["EXTERNAL"]
      }
    ]
  };
  var classificationDefinition = {
    definitionId: "derived-alpha:classification:v1",
    rules: [
      {
        relation: "CONTINUATION",
        classification: "BOS",
        eligibleScales: ["EXTERNAL"],
        requireDisplacement: false
      }
    ]
  };
  var retestDefinition = {
    definitionId: "derived-alpha:retest:v1",
    eligibleBreakModes: ["CLOSE_BEYOND"],
    touchTolerance: 1e-4,
    holdTolerance: 5e-5,
    maximumPenetration: 2e-4,
    holdRule: "CLOSE_VALID_SIDE",
    holdTiming: "LATER_BAR_REQUIRED"
  };
  var equalLiquidityDefinition = {
    definitionId: "derived-alpha:equal-liquidity:v1",
    tolerance: 5e-5,
    pairing: "ADJACENT_CONFIRMED_PIVOTS"
  };
  var liquiditySweepDefinition = {
    definitionId: "derived-alpha:liquidity-sweep:v1",
    penetrationTolerance: 1e-4
  };
  var fvgDefinition = {
    definitionId: "derived-alpha:fvg:wick-gap:v1",
    minimumGap: 5e-5
  };
  var fvgRevisitDefinition = {
    definitionId: "derived-alpha:fvg-revisit:v1",
    partialFillRule: "CLOSE_INSIDE_ZONE",
    fullFillRule: "WICK_REACH_FAR_BOUNDARY"
  };
  var trendlineDefinition = {
    definitionId: "derived-alpha:trendline:three-anchor:v1",
    pairing: "ADJACENT_SAME_SIDE_CONFIRMED_PIVOTS",
    minimumAnchorSeparationMs: 10 * 60 * 1e3,
    anchorTolerance: 2e-5,
    allowedScales: ["EXTERNAL"]
  };
  var trendlineInteractionDefinition = {
    definitionId: "derived-alpha:trendline-interaction:v1",
    touchTolerance: 3e-5,
    penetrationBuffer: 5e-5,
    closeBreakBuffer: 5e-5,
    breakRule: "CLOSE_BEYOND"
  };
  var regimeMeasurementDefinition = {
    definitionId: "derived-alpha:regime-measurements:v2",
    lookbackBars: 5,
    baselineBars: 2,
    maxLatestBarAgeMs: 6e4
  };
  var regimeClassificationDefinition = {
    definitionId: "derived-alpha:canonical-regime:v2",
    profileId: "zugrio-core-derived-alpha",
    profileVersion: "0.1.0",
    rules: [
      {
        ruleId: "directional-trending-fixture",
        regime: "TRENDING",
        predicates: [
          {
            measurement: "CLOSE_EFFICIENCY",
            operator: "GTE",
            threshold: 0.3,
            thresholdProvenanceId: "derived-alpha:fixture-threshold:close-efficiency:v2"
          },
          {
            measurement: "SIGNED_CLOSE_MOVE",
            operator: "GT",
            threshold: 4e-4,
            thresholdProvenanceId: "derived-alpha:fixture-threshold:signed-move:v2"
          }
        ]
      }
    ]
  };
  var lens = {
    strategyId: "zugrio-core-derived-alpha",
    version: "0.1.0",
    compatibleRegimes: ["TRENDING", "EXPANSION", "BREAKOUT"],
    requiredConcepts: ["SWING_HIGH", "BOS", "RETEST"],
    optionalConcepts: ["FVG", "EQUAL_HIGHS", "LIQUIDITY_SWEEP"],
    entryRouteFamilies: ["BOS_RETEST", "BREAKOUT_RETEST"],
    objectiveFamilies: ["NEAREST_CREDIBLE_STRUCTURE", "OPPOSING_LIQUIDITY"],
    invalidationPolicyRef: "derived-alpha:structural-invalidation:v1",
    authority: "RESEARCH_ONLY"
  };
  var playbook = {
    playbookId: "zugrio-core-derived-alpha:playbook:v1",
    strategyId: lens.strategyId,
    strategyVersion: lens.version,
    authority: "RESEARCH_ONLY",
    routes: [
      {
        routeId: "derived-alpha:bos-retest",
        family: "BOS_RETEST",
        compatibleRegimes: ["TRENDING"],
        requiredConceptGroups: [["BOS"], ["RETEST"]],
        optionalContextConcepts: ["FVG", "EQUAL_HIGHS", "LIQUIDITY_SWEEP"],
        objectiveFamilies: ["NEAREST_CREDIBLE_STRUCTURE", "OPPOSING_LIQUIDITY"],
        invalidationPolicyRef: lens.invalidationPolicyRef,
        managementPolicyRef: null,
        authority: "RESEARCH_ONLY"
      },
      {
        routeId: "derived-alpha:breakout-retest",
        family: "BREAKOUT_RETEST",
        compatibleRegimes: ["BREAKOUT", "EXPANSION"],
        requiredConceptGroups: [["BREAKOUT"], ["RETEST"]],
        optionalContextConcepts: ["FVG"],
        objectiveFamilies: ["NEAREST_CREDIBLE_STRUCTURE", "OPPOSING_LIQUIDITY"],
        invalidationPolicyRef: lens.invalidationPolicyRef,
        managementPolicyRef: null,
        authority: "RESEARCH_ONLY"
      }
    ]
  };
  var priorBias = {
    bias: "BULLISH",
    evidenceId: "bias-0805",
    knownAt: "2026-09-24T08:05:01Z",
    definitionId: "derived-alpha:bias:v1"
  };
  function event(id, kind, knownAt, value) {
    return { id, kind, knownAt, value, source: "REPLAY_FIXTURE" };
  }
  function epoch9(value) {
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed))
      throw new Error(`invalid fixture timestamp: ${value}`);
    return parsed;
  }
  function barsKnownBy(evaluatedAt) {
    const cutoff = epoch9(evaluatedAt);
    return bars.filter((bar) => epoch9(bar.knownAt) <= cutoff);
  }
  function confirmedPivotsAt(evaluatedAt) {
    return detectConfirmedPivots(TIMEFRAME, barsKnownBy(evaluatedAt), [
      {
        definitionId: "derived-alpha:external-pivot:1x1:v1",
        scale: "EXTERNAL",
        leftBars: 1,
        rightBars: 1
      }
    ]);
  }
  function deriveLiquidityContextAt(evaluatedAt, pivots) {
    const equalLevels = deriveEqualLiquidityLevels({
      evaluatedAt,
      pivots,
      definition: equalLiquidityDefinition
    });
    const sweeps = deriveLiquiditySweeps({
      evaluatedAt,
      levels: equalLevels,
      bars: barsKnownBy(evaluatedAt),
      definition: liquiditySweepDefinition
    });
    return { equalLevels, sweeps };
  }
  function deriveTrendlineContextAt(evaluatedAt, pivots) {
    const trendlines = deriveConfirmedTrendlines({
      evaluatedAt,
      pivots,
      definition: trendlineDefinition
    });
    const interactions = trendlines.flatMap((trendline) => deriveTrendlineInteractions({
      evaluatedAt,
      trendline,
      bars: barsKnownBy(evaluatedAt),
      definition: trendlineInteractionDefinition
    }));
    return { trendlines, interactions };
  }
  function deriveImbalanceContextAt(evaluatedAt) {
    const knownBars = barsKnownBy(evaluatedAt);
    const facts = [];
    const factIds = /* @__PURE__ */ new Set();
    const add = (fact) => {
      if (!fact || factIds.has(fact.factId))
        return;
      factIds.add(fact.factId);
      facts.push(fact);
    };
    for (let index = 2; index < knownBars.length; index += 1) {
      const first = knownBars[index - 2];
      const middle = knownBars[index - 1];
      const third = knownBars[index];
      if (!first || !middle || !third)
        continue;
      const fvg = detectThreeBarFvg(TIMEFRAME, first, middle, third, fvgDefinition);
      if (!fvg)
        continue;
      add(fvg);
      let revisitRank = 0;
      for (let revisitIndex = index + 1; revisitIndex < knownBars.length; revisitIndex += 1) {
        const revisitBar = knownBars[revisitIndex];
        if (!revisitBar)
          continue;
        const assessment = assessFvgRevisit(fvg, revisitBar, fvgRevisitDefinition);
        const rank = assessment.status === "FULL_FILL" ? 3 : assessment.status === "PARTIAL_FILL" ? 2 : assessment.status === "TOUCHED" ? 1 : 0;
        if (rank > revisitRank) {
          add(assessment.fact);
          revisitRank = rank;
        }
        if (assessment.status === "FULL_FILL")
          break;
      }
    }
    return facts.sort((a, b) => {
      const byKnownAt = epoch9(a.knownAt) - epoch9(b.knownAt);
      if (byKnownAt !== 0)
        return byKnownAt;
      return a.factId.localeCompare(b.factId);
    });
  }
  function regimeAt(evaluatedAt) {
    return classifyCanonicalRegime({
      assessment: computeRegimeMeasurements({
        timeframe: TIMEFRAME,
        evaluatedAt,
        bars,
        definition: regimeMeasurementDefinition
      }),
      definition: regimeClassificationDefinition
    });
  }
  function chartRegimeContext(regime) {
    return {
      status: regime.status,
      measurementId: regime.measurementId,
      profileId: regime.profileId,
      profileVersion: regime.profileVersion,
      matchingRuleIds: regime.matchingRuleIds,
      reasons: regime.reasons
    };
  }
  function routeContextFor(regime) {
    if (regime.status !== "CLASSIFIED" || regime.regime === null) {
      return {
        resolved: null,
        scene: {
          status: "UNAVAILABLE",
          families: [],
          calibrationStatus: null
        }
      };
    }
    const resolved = resolveResearchRoutes(playbook, regime.regime);
    return {
      resolved,
      scene: {
        status: resolved.status,
        families: resolved.routes.map((route) => route.family),
        calibrationStatus: resolved.calibrationStatus
      }
    };
  }
  function confirmedLevelAt(evaluatedAt) {
    const pivots = confirmedPivotsAt(evaluatedAt);
    return pivots.find((fact) => fact.concept === "SWING_HIGH" && fact.geometry.type === "POINT" && Math.abs(fact.geometry.price - 1.176) < 1e-10) ?? null;
  }
  function levelState(level) {
    return {
      levelFactId: level.factId,
      status: "ACTIVE",
      evidenceId: "level-state-active-0805",
      knownAt: "2026-09-24T08:05:02Z",
      policyRef: "derived-alpha:level-consumption:v1"
    };
  }
  function firstBreakAt(evaluatedAt, level) {
    const state = levelState(level);
    const candidates = barsKnownBy(evaluatedAt).filter((bar) => epoch9(bar.sourceClosedAt) > epoch9(state.knownAt));
    for (const bar of candidates) {
      const assessment = detectStructuralBreak(level, bar, breakDefinition, state);
      const first = assessment.events[0];
      if (first)
        return first;
    }
    return null;
  }
  function deriveRetestsAt(evaluatedAt, breakEvent) {
    const observations = [];
    const facts = [];
    let priorTouch = null;
    for (const bar of barsKnownBy(evaluatedAt)) {
      if (epoch9(bar.sourceClosedAt) <= epoch9(breakEvent.sourceClosedAt))
        continue;
      const assessment = derivePostBreakRetest({
        breakEvent,
        bar,
        definition: retestDefinition,
        priorTouch
      });
      const observation = retestAssessmentToLifecycleObservation(assessment);
      if (observation)
        observations.push(observation);
      if (assessment.fact)
        facts.push(assessment.fact);
      if (assessment.retest && !assessment.retest.held && assessment.retest.penetrationWithinLimit) {
        priorTouch = assessment.retest;
      }
      if (assessment.retest?.held)
        break;
    }
    return { observations, facts };
  }
  function buildDerivedStructuralReplayFrame(frameIndex) {
    if (!Number.isInteger(frameIndex) || frameIndex < 0 || frameIndex >= frames.length) {
      throw new RangeError("frameIndex is outside the derived structural replay");
    }
    const frame2 = frames[frameIndex];
    const evaluatedAt = frame2.evaluatedAt;
    const regime = regimeAt(evaluatedAt);
    const routeContext = routeContextFor(regime);
    const pivots = confirmedPivotsAt(evaluatedAt);
    const level = confirmedLevelAt(evaluatedAt);
    const liquidityContext = deriveLiquidityContextAt(evaluatedAt, pivots);
    const imbalanceFacts = deriveImbalanceContextAt(evaluatedAt);
    const trendlineContext = deriveTrendlineContextAt(evaluatedAt, pivots);
    const facts = [
      ...liquidityContext.equalLevels,
      ...liquidityContext.sweeps,
      ...imbalanceFacts,
      ...trendlineContext.trendlines,
      ...trendlineContext.interactions
    ];
    if (level)
      facts.push(level);
    let breakEvent = null;
    let classificationFact = null;
    let lifecycle = null;
    if (level) {
      breakEvent = firstBreakAt(evaluatedAt, level);
    }
    if (breakEvent) {
      const classified = classifyStructuralBreak({
        breakEvent,
        priorBias,
        evaluatedAt,
        definition: classificationDefinition
      });
      if (classified.fact) {
        classificationFact = classified.fact;
        facts.push(classified.fact);
      }
      const retest = deriveRetestsAt(evaluatedAt, breakEvent);
      facts.push(...retest.facts);
      const seed = {
        candidateId: `derived-alpha:${breakEvent.breakId}`,
        setupIdentity: `derived-alpha:BOS_RETEST:${breakEvent.levelFactId}`,
        setupType: "BOS_RETEST",
        side: breakEvent.direction === "UP" ? "BUY" : "SELL",
        breakEvidenceId: breakEvent.sourceBarEvidenceId,
        breakSourceBarId: breakEvent.sourceBarId,
        breakSourceClosedAt: breakEvent.sourceClosedAt,
        breakKnownAt: breakEvent.knownAt,
        continuationReferenceEnabled: false
      };
      lifecycle = observeStructuralLifecycle(seed, retest.observations);
    }
    const map = buildResearchMarketMap({
      mapId: `derived-alpha:${frameIndex}`,
      instrument: "EURUSD",
      timeframe: TIMEFRAME,
      evaluatedAt,
      regime: regime.fact,
      facts,
      strategyLens: lens
    });
    return {
      evaluatedAt,
      regime,
      resolvedRoutes: routeContext.resolved,
      level,
      breakEvent,
      classificationFact,
      lifecycle,
      equalLiquidityFacts: liquidityContext.equalLevels,
      liquiditySweepFacts: liquidityContext.sweeps,
      imbalanceFacts,
      trendlineFacts: trendlineContext.trendlines,
      trendlineInteractionFacts: trendlineContext.interactions,
      marketFacts: map.facts,
      scene: projectMarketMapToChartScene(map, routeContext.scene, chartRegimeContext(regime))
    };
  }
  function lifecycleAt(frameIndex) {
    const derived = buildDerivedStructuralReplayFrame(frameIndex);
    if (!derived.level)
      return "CANDIDATE_IDENTIFIED";
    if (!derived.breakEvent)
      return "CANDIDATE_IDENTIFIED";
    if (!derived.lifecycle)
      return "BREAK_CONFIRMED";
    if (derived.lifecycle.lifecycle === "INVALIDATED" || derived.lifecycle.lifecycle === "EXPIRED") {
      return "BREAK_CONFIRMED";
    }
    return derived.lifecycle.lifecycle;
  }
  function buildGeneratedEvidence() {
    const result = [
      event("derived-eligibility", "ELIGIBILITY", frames[0].evaluatedAt, "ELIGIBLE")
    ];
    let previousLifecycle = null;
    let previousRegimeStatus = null;
    for (let index = 0; index < frames.length; index += 1) {
      const frame2 = frames[index];
      const knownBars = barsKnownBy(frame2.evaluatedAt);
      const latestBar = knownBars.at(-1);
      if (latestBar) {
        result.push(event(`derived-price-${index}`, "PRICE", frame2.evaluatedAt, latestBar.close));
      }
      const derivedForRegime = buildDerivedStructuralReplayFrame(index);
      const regimeStatus = derivedForRegime.regime.status === "CLASSIFIED" ? "AVAILABLE" : derivedForRegime.regime.status === "UNCERTAIN" ? "UNCERTAIN" : "UNAVAILABLE";
      if (regimeStatus !== previousRegimeStatus) {
        result.push(event(`derived-regime-${regimeStatus.toLowerCase()}`, "REGIME_STATUS", frame2.evaluatedAt, regimeStatus));
        previousRegimeStatus = regimeStatus;
      }
      const lifecycle = lifecycleAt(index);
      if (lifecycle !== previousLifecycle) {
        result.push(event(`derived-lifecycle-${lifecycle.toLowerCase()}`, "LIFECYCLE", frame2.evaluatedAt, lifecycle));
        previousLifecycle = lifecycle;
      }
      const derived = derivedForRegime;
      const note = derived.lifecycle?.lifecycle === "RETEST_HELD" ? "Engine-derived BOS retest is held from immutable post-break OHLC evidence." : derived.lifecycle?.lifecycle === "RETEST_TOUCHED" ? "Engine-derived post-break retest has touched; hold remains pending." : derived.breakEvent ? `Engine-derived structural break is classified under the research profile. Canonical regime: ${derived.regime.regime ?? derived.regime.status}.` : derived.regime.status === "CLASSIFIED" ? `Canonical regime ${derived.regime.regime} is causally available; no structural break is yet confirmed.` : "Canonical regime evidence is not yet available from the bounded window.";
      result.push(event(`derived-note-${index}`, "NOTE", frame2.evaluatedAt, note));
    }
    return result;
  }
  function createDerivedStructuralReplayScenario(bundle2) {
    return {
      id: DERIVED_STRUCTURAL_SCENARIO_ID,
      version: "0.1.0-alpha.6",
      caseId: "case-alpha-eurusd-derived-001",
      title: "Derived structure \u2192 liquidity \u2192 imbalance \u2192 trendline context from OHLC",
      description: "A fabricated point-in-time validation replay whose structure, BOS/retest lifecycle, canonical regime, liquidity, imbalance and three-anchor trendline interactions are derived by the research engine from immutable OHLC evidence.",
      bundle: bundle2,
      evidence: buildGeneratedEvidence(),
      frames
    };
  }

  // ../../../packages/decision-core/dist/fixtures.js
  var identity = {
    methodProfile: { kind: "METHOD_PROFILE", id: "zugrio-core-fixture", version: "0.1.0-alpha.2" },
    tradeBundle: { kind: "TRADE_BUNDLE", id: "core-fx-intraday-fixture", version: "0.1.0-alpha.2" },
    regimeModel: { kind: "REGIME_MODEL", id: "fixture-regime", version: "0.1.0-alpha.2" },
    timeframeMap: { kind: "TIMEFRAME_MAP", id: "fixture-intraday-map", version: "0.1.0-alpha.2" },
    scope: {
      market: "FX",
      instrument: "EURUSD",
      horizon: "Intraday",
      admission: "NON_ADMITTED_FIXTURE",
      liveData: false,
      liveCapital: false
    }
  };
  var bundle = {
    identity,
    strategy: "Zugrio Core",
    evidenceStatus: "VALIDATION_ONLY",
    authoritySpecVersion: "1.0.2"
  };
  function event2(id, kind, knownAt, value) {
    return { id, kind, knownAt, value, source: "REPLAY_FIXTURE" };
  }
  function frame(evaluatedAt) {
    return { evaluatedAt };
  }
  var staleEntryScenario = {
    id: "replay-eurusd-stale-entry",
    version: "0.1.0-alpha.2",
    caseId: "case-alpha-eurusd-stale-001",
    title: "Retest holds; the available entry later goes stale",
    description: "A deterministic point-in-time fixture following the frozen structural lifecycle while current-entry conditions change independently.",
    bundle,
    evidence: [
      event2("eligibility-0800", "ELIGIBILITY", "2026-09-24T08:00:00Z", "ELIGIBLE"),
      event2("regime-0800", "REGIME_STATUS", "2026-09-24T08:00:00Z", "AVAILABLE"),
      event2("lifecycle-0800", "LIFECYCLE", "2026-09-24T08:00:00Z", "CANDIDATE_IDENTIFIED"),
      event2("price-0800", "PRICE", "2026-09-24T08:00:00Z", 1.1762),
      event2("note-0800", "NOTE", "2026-09-24T08:00:00Z", "A structural candidate is identified."),
      event2("lifecycle-0805", "LIFECYCLE", "2026-09-24T08:05:00Z", "BREAK_CONFIRMED"),
      event2("price-0805", "PRICE", "2026-09-24T08:05:00Z", 1.1768),
      event2("note-0805", "NOTE", "2026-09-24T08:05:00Z", "The break is confirmed in the replay fixture."),
      event2("lifecycle-0810", "LIFECYCLE", "2026-09-24T08:10:00Z", "RETEST_TOUCHED"),
      event2("price-0810", "PRICE", "2026-09-24T08:10:00Z", 1.1765),
      event2("note-0810", "NOTE", "2026-09-24T08:10:00Z", "Price touches the replay retest area."),
      event2("lifecycle-0812", "LIFECYCLE", "2026-09-24T08:12:00Z", "RETEST_HELD"),
      event2("price-0812", "PRICE", "2026-09-24T08:12:00Z", 1.1764),
      event2("note-0812", "NOTE", "2026-09-24T08:12:00Z", "The replay retest holds. No model conviction or execution permission is created."),
      event2("lifecycle-0815", "LIFECYCLE", "2026-09-24T08:15:00Z", "LIFECYCLE_CONFIRMED"),
      event2("price-0815", "PRICE", "2026-09-24T08:15:00Z", 1.1771),
      event2("note-0815", "NOTE", "2026-09-24T08:15:00Z", "The frozen structural lifecycle is complete."),
      event2("entry-event-0817", "ENTRY_EVENT_OBSERVED", "2026-09-24T08:17:00Z", true),
      event2("entry-status-0817", "CURRENT_ENTRY_STATUS", "2026-09-24T08:17:00Z", "CURRENT"),
      event2("price-0817", "PRICE", "2026-09-24T08:17:00Z", 1.1772),
      event2("note-0817", "NOTE", "2026-09-24T08:17:00Z", "A fixture-only entry event is observed. It is not an admitted ENTRY_EVENT_CONFIRMED predicate."),
      event2("entry-status-0820", "CURRENT_ENTRY_STATUS", "2026-09-24T08:20:00Z", "STALE"),
      event2("price-0820", "PRICE", "2026-09-24T08:20:00Z", 1.1784),
      event2("note-0820", "NOTE", "2026-09-24T08:20:00Z", "The original structural case remains recorded, but the currently available entry is stale."),
      event2("eligibility-0825", "ELIGIBILITY", "2026-09-24T08:25:00Z", "INVALIDATED"),
      event2("price-0825", "PRICE", "2026-09-24T08:25:00Z", 1.1792),
      event2("note-0825", "NOTE", "2026-09-24T08:25:00Z", "The structural case is invalidated.")
    ],
    frames: [
      frame("2026-09-24T08:00:00Z"),
      frame("2026-09-24T08:05:00Z"),
      frame("2026-09-24T08:10:00Z"),
      frame("2026-09-24T08:12:00Z"),
      frame("2026-09-24T08:15:00Z"),
      frame("2026-09-24T08:17:00Z"),
      frame("2026-09-24T08:20:00Z"),
      frame("2026-09-24T08:25:00Z")
    ]
  };
  var currentEntryScenario = {
    id: "replay-eurusd-current-entry",
    version: "0.1.0-alpha.2",
    caseId: "case-alpha-eurusd-current-001",
    title: "Retest holds; current entry remains available",
    description: "A second deterministic point-in-time fixture using the same structural lifecycle while the fixture current-entry condition remains current.",
    bundle,
    evidence: [
      event2("eligibility-0900", "ELIGIBILITY", "2026-09-24T09:00:00Z", "ELIGIBLE"),
      event2("regime-0900", "REGIME_STATUS", "2026-09-24T09:00:00Z", "AVAILABLE"),
      event2("lifecycle-0900", "LIFECYCLE", "2026-09-24T09:00:00Z", "CANDIDATE_IDENTIFIED"),
      event2("price-0900", "PRICE", "2026-09-24T09:00:00Z", 1.1758),
      event2("note-0900", "NOTE", "2026-09-24T09:00:00Z", "A structural candidate is identified."),
      event2("lifecycle-0905", "LIFECYCLE", "2026-09-24T09:05:00Z", "BREAK_CONFIRMED"),
      event2("price-0905", "PRICE", "2026-09-24T09:05:00Z", 1.1764),
      event2("lifecycle-0910", "LIFECYCLE", "2026-09-24T09:10:00Z", "RETEST_TOUCHED"),
      event2("price-0910", "PRICE", "2026-09-24T09:10:00Z", 1.1761),
      event2("lifecycle-0912", "LIFECYCLE", "2026-09-24T09:12:00Z", "RETEST_HELD"),
      event2("price-0912", "PRICE", "2026-09-24T09:12:00Z", 1.176),
      event2("lifecycle-0915", "LIFECYCLE", "2026-09-24T09:15:00Z", "LIFECYCLE_CONFIRMED"),
      event2("price-0915", "PRICE", "2026-09-24T09:15:00Z", 1.1769),
      event2("entry-event-0917", "ENTRY_EVENT_OBSERVED", "2026-09-24T09:17:00Z", true),
      event2("entry-status-0917", "CURRENT_ENTRY_STATUS", "2026-09-24T09:17:00Z", "CURRENT"),
      event2("price-0917", "PRICE", "2026-09-24T09:17:00Z", 1.177),
      event2("note-0917", "NOTE", "2026-09-24T09:17:00Z", "A fixture-only entry event is current."),
      event2("price-0920", "PRICE", "2026-09-24T09:20:00Z", 1.1772),
      event2("note-0920", "NOTE", "2026-09-24T09:20:00Z", "The fixture current-entry condition remains current.")
    ],
    frames: [
      frame("2026-09-24T09:00:00Z"),
      frame("2026-09-24T09:05:00Z"),
      frame("2026-09-24T09:10:00Z"),
      frame("2026-09-24T09:12:00Z"),
      frame("2026-09-24T09:15:00Z"),
      frame("2026-09-24T09:17:00Z"),
      frame("2026-09-24T09:20:00Z")
    ]
  };
  var noSetupScenario = {
    id: "replay-eurusd-no-setup",
    version: "0.1.0-alpha.2",
    caseId: "case-alpha-eurusd-pass-001",
    title: "No qualifying structural setup",
    description: "A fail-closed fixture proving PASS is an outcome, not an opportunity state.",
    bundle,
    evidence: [
      event2("eligibility-1000", "ELIGIBILITY", "2026-09-24T10:00:00Z", "INELIGIBLE"),
      event2("regime-1000", "REGIME_STATUS", "2026-09-24T10:00:00Z", "AVAILABLE"),
      event2("price-1000", "PRICE", "2026-09-24T10:00:00Z", 1.176),
      event2("note-1000", "NOTE", "2026-09-24T10:00:00Z", "Fixture evidence does not qualify a structural candidate.")
    ],
    frames: [frame("2026-09-24T10:00:00Z")]
  };
  var regimeUnavailableScenario = {
    id: "replay-eurusd-regime-unavailable",
    version: "0.1.0-alpha.2",
    caseId: "case-alpha-eurusd-regime-pass-001",
    title: "Regime unavailable at evaluation time",
    description: "A fail-closed point-in-time fixture for unavailable regime evidence.",
    bundle,
    evidence: [
      event2("eligibility-1100", "ELIGIBILITY", "2026-09-24T11:00:00Z", "ELIGIBLE"),
      event2("regime-1100", "REGIME_STATUS", "2026-09-24T11:00:00Z", "UNAVAILABLE"),
      event2("lifecycle-1100", "LIFECYCLE", "2026-09-24T11:00:00Z", "CANDIDATE_IDENTIFIED"),
      event2("price-1100", "PRICE", "2026-09-24T11:00:00Z", 1.176),
      event2("note-1100", "NOTE", "2026-09-24T11:00:00Z", "Required regime evidence is unavailable.")
    ],
    frames: [frame("2026-09-24T11:00:00Z")]
  };
  var derivedStructuralScenario = createDerivedStructuralReplayScenario(bundle);

  // ../../../packages/decision-core/dist/research/currentEntryRecheck.js
  function epoch10(value, label) {
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed))
      throw new Error(`${label} is not a valid ISO timestamp: ${value}`);
    return parsed;
  }
  function validateKnownAt(evidence, evaluatedAt) {
    if (!evidence.evidenceId)
      throw new Error("recheck evidenceId must be non-empty");
    if (epoch10(evidence.knownAt, "knownAt") > evaluatedAt) {
      throw new Error(`future evidence is not available at evaluation time: ${evidence.evidenceId}`);
    }
  }
  function recheckCurrentEntry(entryEvent, input) {
    const evaluatedAt = epoch10(input.evaluatedAt, "evaluatedAt");
    validateKnownAt(input.quote, evaluatedAt);
    validateKnownAt(input.entryFreshness, evaluatedAt);
    validateKnownAt(input.geometryCurrent, evaluatedAt);
    validateKnownAt(input.costsWithinBudget, evaluatedAt);
    validateKnownAt(input.targetRunwayAvailable, evaluatedAt);
    validateKnownAt(input.continuityOk, evaluatedAt);
    if (input.quote.status === "FRESH" && input.quote.quoteAt === null) {
      throw new Error("FRESH quote requires quoteAt");
    }
    if (input.quote.quoteAt && epoch10(input.quote.quoteAt, "quoteAt") > evaluatedAt) {
      throw new Error("quoteAt cannot be in the future relative to evaluatedAt");
    }
    if (!entryEvent) {
      return {
        status: "NOT_AVAILABLE",
        reasons: ["NO_ENTRY_EVENT"],
        originalEntryEventId: null,
        originalConfirmedAt: null,
        evaluatedAt: input.evaluatedAt,
        evidenceIds: [],
        authority: "RESEARCH_ONLY",
        liveCapitalAuthority: false
      };
    }
    if (!entryEvent.eventId)
      throw new Error("entryEvent.eventId must be non-empty");
    const confirmedAt = epoch10(entryEvent.confirmedAt, "entryEvent.confirmedAt");
    const sourceBarClosedAt = epoch10(entryEvent.sourceBarClosedAt, "entryEvent.sourceBarClosedAt");
    if (sourceBarClosedAt > confirmedAt) {
      throw new Error("entryEvent.sourceBarClosedAt cannot follow confirmedAt");
    }
    if (confirmedAt > evaluatedAt) {
      throw new Error("entryEvent.confirmedAt cannot be in the future relative to evaluatedAt");
    }
    const recheckEvidence = [
      input.quote,
      input.entryFreshness,
      input.geometryCurrent,
      input.costsWithinBudget,
      input.targetRunwayAvailable,
      input.continuityOk
    ];
    for (const evidence of recheckEvidence) {
      if (epoch10(evidence.knownAt, "recheck evidence knownAt") < confirmedAt) {
        throw new Error(`current-entry recheck evidence predates the entry event: ${evidence.evidenceId}`);
      }
    }
    if (input.quote.status === "FRESH" && input.quote.quoteAt !== null && epoch10(input.quote.quoteAt, "quoteAt") < confirmedAt) {
      throw new Error("FRESH quote cannot predate the entry event");
    }
    const reasons = [];
    if (input.quote.status === "UNAVAILABLE")
      reasons.push("QUOTE_UNAVAILABLE");
    if (input.quote.status === "STALE")
      reasons.push("QUOTE_STALE");
    if (!input.entryFreshness.ok)
      reasons.push("ENTRY_EVENT_STALE");
    if (!input.geometryCurrent.ok)
      reasons.push("GEOMETRY_NO_LONGER_CURRENT");
    if (!input.costsWithinBudget.ok)
      reasons.push("COST_BUDGET_FAILED");
    if (!input.targetRunwayAvailable.ok)
      reasons.push("TARGET_RUNWAY_FAILED");
    if (!input.continuityOk.ok)
      reasons.push("CONTINUITY_FAILED");
    const evidenceIds = [
      input.quote.evidenceId,
      input.entryFreshness.evidenceId,
      input.geometryCurrent.evidenceId,
      input.costsWithinBudget.evidenceId,
      input.targetRunwayAvailable.evidenceId,
      input.continuityOk.evidenceId
    ];
    return {
      status: reasons.length === 0 ? "CURRENT" : "STALE",
      reasons: reasons.length === 0 ? ["CURRENT"] : reasons,
      originalEntryEventId: entryEvent.eventId,
      originalConfirmedAt: entryEvent.confirmedAt,
      evaluatedAt: input.evaluatedAt,
      evidenceIds,
      authority: "RESEARCH_ONLY",
      liveCapitalAuthority: false
    };
  }

  // ../../../packages/decision-core/dist/validation/invariants.js
  function instant(value) {
    if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value) || !Number.isFinite(Date.parse(value)))
      throw new Error("Invalid UTC timestamp");
    return Date.parse(value);
  }
  function finite(value, label, minimum = 0) {
    if (!Number.isFinite(value) || value < minimum)
      throw new Error(`Invalid ${label}`);
  }
  function nonempty(value) {
    if (typeof value !== "string" || !value.trim())
      throw new Error("Missing identity");
  }
  function exact(value, keys) {
    if (Object.keys(value).some((key) => !keys.includes(key)))
      throw new Error("Unexpected field at canonical boundary");
  }
  function canonical(value) {
    return JSON.stringify(value, (_key, inner) => inner && typeof inner === "object" && !Array.isArray(inner) ? Object.fromEntries(Object.entries(inner).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : inner);
  }
  function immutable(value) {
    const copy = structuredClone(value);
    const freeze = (v) => {
      if (v && typeof v === "object") {
        Object.values(v).forEach(freeze);
        Object.freeze(v);
      }
    };
    freeze(copy);
    return copy;
  }
  function version(ref3) {
    nonempty(ref3.id);
    nonempty(ref3.version);
  }
  function causal(sourceAt, knownAt, evaluatedAt) {
    if (instant(sourceAt) > instant(knownAt) || instant(knownAt) > instant(evaluatedAt))
      throw new Error("Future-known or reordered evidence");
  }
  var RESEARCH_AUTHORITY = Object.freeze({ authority: "RESEARCH_ONLY", liveCapitalAuthority: false });

  // ../../../packages/decision-core/dist/validation/sharedState.js
  var SharedMarketStore = class {
    constructor(capacity = 4096) {
      __publicField(this, "capacity");
      __publicField(this, "states", /* @__PURE__ */ new Map());
      __publicField(this, "versions", /* @__PURE__ */ new Map());
      __publicField(this, "definitions", /* @__PURE__ */ new Map());
      __publicField(this, "derived", /* @__PURE__ */ new Map());
      __publicField(this, "computations", 0);
      this.capacity = capacity;
      if (!Number.isSafeInteger(capacity) || capacity < 1)
        throw new Error("Invalid capacity");
    }
    get computationCount() {
      return this.computations;
    }
    materialize(input) {
      exact(input, ["instrument", "source", "timeframe", "evaluatedAt", "dataVersion", "featureDefinition", "pivots", "bars"]);
      [input.instrument, input.source, input.timeframe, input.dataVersion].forEach(nonempty);
      version(input.featureDefinition);
      exact(input.featureDefinition, ["id", "version"]);
      instant(input.evaluatedAt);
      if (!input.bars.length || !input.pivots.length)
        throw new Error("Empty market evidence/definitions");
      const ids = /* @__PURE__ */ new Set();
      const times = /* @__PURE__ */ new Set();
      const evidenceIds = /* @__PURE__ */ new Set();
      for (const p of input.pivots) {
        exact(p, ["definitionId", "scale", "leftBars", "rightBars"]);
        if (!["INTERNAL", "INTERMEDIATE", "EXTERNAL"].includes(p.scale))
          throw new Error("Unknown pivot scale");
      }
      if (new Set(input.pivots.map((p) => p.definitionId)).size !== input.pivots.length)
        throw new Error("Duplicate definition");
      for (const b of input.bars) {
        exact(b, ["evidenceId", "sourceBarId", "open", "high", "low", "close", "sourceClosedAt", "knownAt", "dataStatus"]);
        nonempty(b.evidenceId);
        nonempty(b.sourceBarId);
        validateResearchStructureBar(b);
        causal(b.sourceClosedAt, b.knownAt, input.evaluatedAt);
        if (!["FRESH_COMPLETE", "INCOMPLETE", "STALE", "GAP"].includes(b.dataStatus))
          throw new Error("Unknown data status");
        if (ids.has(b.sourceBarId) || evidenceIds.has(b.evidenceId) || times.has(instant(b.sourceClosedAt)))
          throw new Error("Duplicate market evidence");
        ids.add(b.sourceBarId);
        evidenceIds.add(b.evidenceId);
        times.add(instant(b.sourceClosedAt));
      }
      const bars3 = [...input.bars].sort((a, b) => instant(a.sourceClosedAt) - instant(b.sourceClosedAt));
      if (bars3.some((b, i) => i > 0 && instant(b.knownAt) < instant(bars3[i - 1].knownAt)))
        throw new Error("Reordered source knowledge");
      const pivots = [...input.pivots].sort((a, b) => a.definitionId.localeCompare(b.definitionId));
      const versionKey = canonical([input.instrument, input.source, input.timeframe, input.dataVersion]);
      const content = canonical(bars3);
      const definitionKey = canonical(input.featureDefinition);
      const definition = canonical(pivots);
      if (this.versions.has(versionKey) && this.versions.get(versionKey) !== content)
        throw new Error("Data version mutation");
      if (this.definitions.has(definitionKey) && this.definitions.get(definitionKey) !== definition)
        throw new Error("Definition version mutation");
      const key = canonical([versionKey, input.evaluatedAt, definitionKey]);
      const existing = this.states.get(key);
      if (existing)
        return existing;
      if (this.states.size >= this.capacity)
        throw new Error("Research shared-state capacity exceeded");
      const derivedKey = canonical([versionKey, definitionKey]);
      let facts = this.derived.get(derivedKey);
      if (!facts) {
        facts = immutable(detectConfirmedPivots(input.timeframe, bars3, pivots));
        this.derived.set(derivedKey, facts);
        this.computations++;
      }
      const result = immutable({ ...input, bars: bars3, pivots, key, knownAt: bars3.at(-1).knownAt, facts });
      this.states.set(key, result);
      this.versions.set(versionKey, content);
      this.definitions.set(definitionKey, definition);
      return result;
    }
  };

  // ../../../packages/decision-core/dist/validation/entryGrammar.js
  function same(a, b) {
    return a.id === b.id && a.version === b.version;
  }
  function ref(p) {
    return { id: p.id, version: p.version };
  }
  function point(f) {
    if (f.geometry.type !== "POINT")
      throw new Error("Entry route requires confirmed point geometry");
    return f.geometry.price;
  }
  function validateProfiles(i) {
    exact(i, ["markets", "family", "instrument", "horizon", "timeframes", "model", "binding"]);
    exact(i.family, ["id", "version", "family", "priceOrigin"]);
    exact(i.instrument, ["id", "version", "instrument", "source", "familyProfile", "tickSize"]);
    exact(i.horizon, ["id", "version", "horizon", "timeframeMap", "setupExpiryMs", "entryExpiryMs"]);
    exact(i.timeframes, ["id", "version", "context", "location", "entry", "management", "maxAgeMs"]);
    exact(i.timeframes.maxAgeMs, ["context", "location", "entry", "management"]);
    exact(i.binding, ["side", "contextFactId", "locationFactId", "objectiveFactId"]);
    exact(i.model, ["id", "version", "route", "familyProfile", "instrumentProfile", "horizonProfile", "strategy", "tradeBundle", "regimeModel", "calibration", "calibrationStatus", "breakTicks", "touchTicks", "stopTicks", "maxChaseTicks", "minimumRunwayTicks"]);
    for (const p of [i.family, i.instrument, i.horizon, i.timeframes, i.model])
      version(p);
    for (const p of [i.instrument.familyProfile, i.horizon.timeframeMap, i.model.familyProfile, i.model.instrumentProfile, i.model.horizonProfile, i.model.strategy, i.model.tradeBundle, i.model.regimeModel, i.model.calibration]) {
      version(p);
      exact(p, ["id", "version"]);
    }
    if (!same(i.instrument.familyProfile, i.family) || !same(i.model.familyProfile, i.family) || !same(i.model.instrumentProfile, i.instrument) || !same(i.model.horizonProfile, i.horizon) || !same(i.horizon.timeframeMap, i.timeframes))
      throw new Error("Profile scope mismatch");
    if (!["CONTINUATION_RETEST", "REVERSAL_RECLAIM"].includes(i.model.route) || !["BUY", "SELL"].includes(i.binding.side) || i.model.calibrationStatus !== "UNVALIDATED_RESEARCH")
      throw new Error("Unsupported research entry model");
    if (!["EXTERNAL_MARKET", "SYNTHETIC_GENERATOR"].includes(i.family.priceOrigin))
      throw new Error("Unknown price origin");
    [i.family.family, i.instrument.instrument, i.instrument.source, i.horizon.horizon, ...Object.values(i.binding), i.timeframes.context, i.timeframes.location, i.timeframes.entry, i.timeframes.management].forEach(nonempty);
    finite(i.instrument.tickSize, "tickSize", Number.MIN_VALUE);
    for (const n of ["breakTicks", "touchTicks", "stopTicks", "maxChaseTicks", "minimumRunwayTicks"]) {
      finite(i.model[n], n, Number.MIN_VALUE);
      finite(i.model[n] * i.instrument.tickSize, `${n} price distance`, Number.MIN_VALUE);
    }
    finite(i.horizon.entryExpiryMs, "entry expiry", 1);
    finite(i.horizon.setupExpiryMs, "setup expiry", 1);
    for (const role of ["context", "location", "entry", "management"])
      finite(i.timeframes.maxAgeMs[role], role, 1);
  }
  var SharedEntryEngine = class {
    constructor(capacity = 4096) {
      __publicField(this, "capacity");
      __publicField(this, "markets");
      __publicField(this, "states", /* @__PURE__ */ new Map());
      __publicField(this, "profiles", /* @__PURE__ */ new Map());
      __publicField(this, "bundles", /* @__PURE__ */ new Map());
      __publicField(this, "computations", 0);
      this.capacity = capacity;
      this.markets = new SharedMarketStore(capacity);
    }
    get computationCount() {
      return this.computations;
    }
    evaluate(input) {
      validateProfiles(input);
      for (const [kind, p] of Object.entries({ family: input.family, instrument: input.instrument, horizon: input.horizon, timeframes: input.timeframes, model: input.model })) {
        const key2 = canonical([kind, p.id, p.version]);
        const bytes = canonical(p);
        if (this.profiles.has(key2) && this.profiles.get(key2) !== bytes)
          throw new Error("Profile version mutation");
      }
      const bundleKey = canonical(input.model.tradeBundle);
      const bundleDefinition = canonical({ model: input.model, family: input.family, instrument: input.instrument, horizon: input.horizon, timeframes: input.timeframes });
      if (this.bundles.has(bundleKey) && this.bundles.get(bundleKey) !== bundleDefinition)
        throw new Error("TradeBundle version mutation");
      const markets = input.markets.map((m) => this.markets.materialize(m));
      const roles = ["context", "location", "entry", "management"];
      const required = [...new Set(roles.map((r) => input.timeframes[r]))].sort();
      if (markets.length !== required.length || new Set(markets.map((m) => m.timeframe)).size !== markets.length || required.some((tf) => !markets.some((m) => m.timeframe === tf)))
        throw new Error("Exact timeframe map required");
      const evaluatedAt = markets[0].evaluatedAt;
      if (markets.some((m) => m.instrument !== input.instrument.instrument || m.source !== input.instrument.source || m.evaluatedAt !== evaluatedAt))
        throw new Error("Market scope/observation mismatch");
      const key = canonical({ markets: markets.map((m) => m.key).sort(), family: input.family, instrument: input.instrument, horizon: input.horizon, timeframes: input.timeframes, model: input.model, binding: input.binding });
      const cached = this.states.get(key);
      if (cached)
        return cached;
      if (this.states.size >= this.capacity)
        throw new Error("Research strategy capacity exceeded");
      const result = immutable(interpret(input, markets, key));
      this.states.set(key, result);
      this.bundles.set(bundleKey, bundleDefinition);
      this.computations++;
      for (const [kind, p] of Object.entries({ family: input.family, instrument: input.instrument, horizon: input.horizon, timeframes: input.timeframes, model: input.model }))
        this.profiles.set(canonical([kind, p.id, p.version]), canonical(p));
      return result;
    }
  };
  function interpret(i, markets, key) {
    const byTf = (tf) => markets.find((m) => m.timeframe === tf);
    const context = byTf(i.timeframes.context), location = byTf(i.timeframes.location), entry = byTf(i.timeframes.entry);
    const evaluatedAt = entry.evaluatedAt, now = instant(evaluatedAt), sign = i.binding.side === "BUY" ? 1 : -1;
    const fact = (m, id) => m.facts.find((f) => f.factId === id);
    const contextFact = fact(context, i.binding.contextFactId), locationFact = fact(location, i.binding.locationFactId), objectiveFact = fact(context, i.binding.objectiveFactId);
    const stages = [
      { stage: "Context", factIds: contextFact ? [contextFact.factId] : [], evidenceIds: contextFact?.sourceEvidenceIds ?? [] },
      { stage: "Location", factIds: locationFact ? [locationFact.factId] : [], evidenceIds: locationFact?.sourceEvidenceIds ?? [] },
      { stage: "Reaction / Confirmation", factIds: [], evidenceIds: [] },
      { stage: "Current Entry", factIds: [], evidenceIds: [] },
      { stage: "Invalidation", factIds: locationFact ? [locationFact.factId] : [], evidenceIds: locationFact?.sourceEvidenceIds ?? [] },
      { stage: "Objective", factIds: objectiveFact ? [objectiveFact.factId] : [], evidenceIds: objectiveFact?.sourceEvidenceIds ?? [] },
      { stage: "Management", factIds: [], evidenceIds: [] }
    ];
    const base = {
      key,
      opportunityId: canonical([i.model.strategy, i.model.tradeBundle, i.binding]),
      instrument: i.instrument.instrument,
      side: i.binding.side,
      strategy: ref(i.model.strategy),
      tradeBundle: ref(i.model.tradeBundle),
      entryModel: ref(i.model),
      familyProfile: ref(i.family),
      horizonProfile: ref(i.horizon),
      timeframes: i.timeframes,
      calibration: ref(i.model.calibration),
      calibrationStatus: "UNVALIDATED_RESEARCH",
      marketKeys: markets.map((m) => m.key).sort(),
      evaluatedAt,
      knownAt: markets.map((m) => m.knownAt).sort().at(-1),
      state: "STRUCTURAL_CANDIDATE",
      currentEntry: null,
      currentPrice: { price: entry.bars.at(-1).close, sourceAt: entry.bars.at(-1).sourceClosedAt, knownAt: entry.bars.at(-1).knownAt, evidenceId: entry.bars.at(-1).evidenceId },
      economics: "CLOSED_BAR_ONLY_NOT_EXECUTABLE",
      parentContext: contextFact ? { factId: contextFact.factId, invalidation: point(contextFact), timeframe: contextFact.timeframe, knownAt: contextFact.knownAt } : null,
      reasons: [],
      geometry: null,
      stages,
      management: { timeframe: i.timeframes.management, policy: "OBSERVE_CHILD_SEPARATELY_FROM_PARENT" },
      ...RESEARCH_AUTHORITY,
      modelScored: false
    };
    const reasons = [];
    for (const role of ["context", "location", "entry", "management"]) {
      const m = byTf(i.timeframes[role]);
      if (m.bars.some((b) => b.dataStatus !== "FRESH_COMPLETE") || now - instant(m.bars.at(-1).sourceClosedAt) > i.timeframes.maxAgeMs[role])
        reasons.push(`MARKET_UNAVAILABLE:${role}`);
    }
    if (reasons.length)
      return { ...base, reasons };
    if (!contextFact || !locationFact || !objectiveFact)
      return { ...base, reasons: ["REQUIRED_FACT_UNAVAILABLE"] };
    const support = i.binding.side === "BUY" ? "SWING_LOW" : "SWING_HIGH";
    const resistance = i.binding.side === "BUY" ? "SWING_HIGH" : "SWING_LOW";
    if (contextFact.concept !== support || objectiveFact.concept !== resistance || locationFact.concept !== (i.model.route === "CONTINUATION_RETEST" ? resistance : support))
      return { ...base, reasons: ["FACT_ROLE_MISMATCH"] };
    const level = point(locationFact), objective = point(objectiveFact);
    const stop = level - sign * i.model.stopTicks * i.instrument.tickSize;
    finite(stop, "child invalidation");
    const contextLevel = point(contextFact);
    const contextSourceAt = contextFact.geometry.type === "POINT" ? contextFact.geometry.time : null;
    if (contextSourceAt === null)
      throw new Error("Parent context requires point geometry");
    if (context.bars.some((b) => instant(b.sourceClosedAt) > instant(contextSourceAt) && sign * (b.close - contextLevel) <= 0))
      return { ...base, reasons: ["PARENT_CONTEXT_INVALID"] };
    if (sign * (objective - level) <= 0)
      return { ...base, reasons: ["OBJECTIVE_GEOMETRY_INVALID"] };
    const nearest = context.facts.filter((f) => f.concept === resistance && f.geometry.type === "POINT" && sign * (point(f) - level) > 0).sort((a, b) => sign * (point(a) - point(b)))[0];
    if (nearest && point(nearest) !== objective)
      return { ...base, reasons: ["NEARER_OBJECTIVE_EXISTS"] };
    const start = Math.max(instant(contextFact.knownAt), instant(locationFact.knownAt), instant(objectiveFact.knownAt));
    if (now - start > i.horizon.setupExpiryMs)
      return { ...base, reasons: ["SETUP_EXPIRED"] };
    const bars3 = entry.bars.filter((b) => instant(b.sourceClosedAt) > start);
    const threshold = i.model.breakTicks * i.instrument.tickSize, tolerance = i.model.touchTicks * i.instrument.tickSize;
    let reaction, confirmation;
    for (const b of bars3) {
      const extreme = sign === 1 ? b.low : b.high;
      if (sign * (b.close - stop) <= 0 || confirmation && sign * (extreme - stop) <= 0)
        return { ...base, state: "STRUCTURAL_WATCH", reasons: ["CHILD_INVALIDATED"] };
      if (sign * ((sign === 1 ? b.high : b.low) - objective) >= 0)
        return { ...base, state: "STRUCTURAL_WATCH", reasons: ["OBJECTIVE_ALREADY_REACHED"] };
      if (!reaction) {
        const prior = entry.bars[entry.bars.indexOf(b) - 1];
        if (prior && (i.model.route === "CONTINUATION_RETEST" ? sign * (prior.close - level) <= 0 && sign * (b.close - level) >= threshold : sign * (prior.close - level) >= 0 && sign * ((sign === 1 ? b.low : b.high) - level) <= -threshold))
          reaction = b;
        continue;
      }
      if (!confirmation && sign * (b.close - level) >= threshold && (i.model.route === "REVERSAL_RECLAIM" || Math.abs(extreme - level) <= tolerance))
        confirmation = b;
      if (confirmation && sign * (b.close - level) < 0)
        return { ...base, state: "STRUCTURAL_WATCH", reasons: [i.model.route === "REVERSAL_RECLAIM" ? "FAILED_RECLAIM" : "FAILED_RETEST"] };
    }
    if (!reaction || !confirmation)
      return { ...base, state: reaction ? "STRUCTURAL_WATCH" : "STRUCTURAL_CANDIDATE", reasons: [reaction ? "CONFIRMATION_REQUIRED" : "REACTION_REQUIRED"] };
    const current = entry.bars.at(-1);
    const geometry = { entryReference: confirmation.close, childInvalidation: stop, objective, frozenAt: confirmation.knownAt };
    const predicate = (ok) => ({ ok, evidenceId: current.evidenceId, knownAt: current.knownAt, provenanceId: canonical([i.model.calibration, i.horizon]) });
    const currentEntry = recheckCurrentEntry({ eventId: confirmation.evidenceId, confirmedAt: confirmation.knownAt, sourceBarClosedAt: confirmation.sourceClosedAt }, {
      evaluatedAt,
      quote: { status: "FRESH", quoteAt: current.sourceClosedAt, evidenceId: current.evidenceId, knownAt: current.knownAt },
      entryFreshness: predicate(now - instant(confirmation.knownAt) <= i.horizon.entryExpiryMs),
      geometryCurrent: predicate(sign * (current.close - stop) > 0 && Math.abs(current.close - level) <= i.model.maxChaseTicks * i.instrument.tickSize),
      // This is closed-bar structural research, not executable bid/ask economics.
      costsWithinBudget: predicate(true),
      targetRunwayAvailable: predicate(sign * (objective - current.close) >= i.model.minimumRunwayTicks * i.instrument.tickSize),
      continuityOk: predicate(true)
    });
    return {
      ...base,
      state: currentEntry.status === "CURRENT" ? "STRUCTURAL_READY" : "STRUCTURAL_WATCH",
      geometry,
      currentEntry,
      reasons: currentEntry.status === "CURRENT" ? ["STRUCTURAL_READY_NOT_MODEL_SCORED"] : currentEntry.reasons,
      stages: stages.map((s) => s.stage === "Reaction / Confirmation" ? { ...s, factIds: [], evidenceIds: [reaction.evidenceId, confirmation.evidenceId] } : s.stage === "Current Entry" ? { ...s, factIds: [], evidenceIds: [current.evidenceId] } : s)
    };
  }

  // ../../../packages/decision-core/dist/validation/fixtures.js
  var validationTime = (minute) => new Date(Date.UTC(2026, 0, 1, 0, minute)).toISOString();
  function bars2(tf, values, frame2) {
    return values.slice(0, frame2).map(([open, high, low, close], index) => ({ evidenceId: `${tf}:e${index + 1}`, sourceBarId: `${tf}:b${index + 1}`, open, high, low, close, sourceClosedAt: validationTime(index + 1), knownAt: validationTime(index + 1), dataStatus: "FRESH_COMPLETE" }));
  }
  function createEntryValidationInput(route = "CONTINUATION_RETEST", family = "GOLD", horizon = "INTRADAY", frame2 = 7) {
    const ver = (id) => ({ id, version: "fixture-v1" });
    const familyProfile = { ...ver(`family:${family}`), family, priceOrigin: family === "SYNTHETIC" ? "SYNTHETIC_GENERATOR" : "EXTERNAL_MARKET" };
    const instrument = { ...ver(`instrument:${family}`), instrument: `fixture:${family}`, source: "fabricated-ohlc-v1", familyProfile: ver(familyProfile.id), tickSize: 1 };
    const map = { ...ver(`map:${horizon}`), context: "H1", location: "M5", entry: "M1", management: "H1", maxAgeMs: { context: 6e5, location: 6e5, entry: 6e4, management: 6e5 } };
    const hp = { ...ver(`horizon:${horizon}`), horizon, timeframeMap: ver(map.id), setupExpiryMs: 36e5, entryExpiryMs: horizon === "SWING" ? 6e5 : 12e4 };
    const featureDefinition = ver("confirmed-pivot");
    const context = bars2("H1", [[100, 105, 95, 100], [100, 105, 90, 100], [100, 130, 95, 115], [115, 120, 100, 110], [110, 119, 100, 110], [110, 118, 100, 112], [112, 119, 101, 112]], frame2);
    const location = bars2("M5", route === "CONTINUATION_RETEST" ? [[100, 105, 95, 100], [100, 110, 96, 105], [105, 108, 97, 104], [104, 107, 98, 104], [104, 108, 98, 105], [105, 109, 99, 106], [106, 109, 100, 107]] : [[115, 119, 114, 116], [116, 118, 110, 114], [114, 120, 113, 116], [116, 121, 114, 117], [117, 122, 115, 118], [118, 123, 116, 119], [119, 124, 117, 120]], frame2);
    const entries = bars2("M1", route === "CONTINUATION_RETEST" ? [[106, 108, 104, 106], [106, 109, 105, 108], [108, 110, 107, 109], [109, 110, 108, 109], [109, 113, 109, 112], [112, 113, 109.5, 111], [111, 112, 110, 111]] : [[113, 115, 112, 114], [114, 116, 112, 115], [115, 117, 113, 114], [114, 115, 111, 113], [113, 114, 108, 109], [109, 113, 109, 111], [111, 112, 110, 111]], frame2);
    return {
      markets: [["H1", context], ["M5", location], ["M1", entries]].map(([timeframe, series]) => ({ instrument: instrument.instrument, source: instrument.source, timeframe, evaluatedAt: validationTime(frame2), dataVersion: `frame:${frame2}:${timeframe === "H1" ? "context" : route}`, featureDefinition, pivots: [{ definitionId: "p1", scale: "INTERMEDIATE", leftBars: 1, rightBars: 1 }], bars: series })),
      family: familyProfile,
      instrument,
      horizon: hp,
      timeframes: map,
      model: { ...ver(`model:${route}:${family}:${horizon}`), route, familyProfile: ver(familyProfile.id), instrumentProfile: ver(instrument.id), horizonProfile: ver(hp.id), strategy: ver("zugrio-core-research"), tradeBundle: ver(`bundle:${route}:${family}:${horizon}`), regimeModel: ver("context-pivot-hold"), calibration: ver(`calibration:${family}:${horizon}`), calibrationStatus: "UNVALIDATED_RESEARCH", breakTicks: family === "SYNTHETIC" ? 3 : 1, touchTicks: 1, stopTicks: 5, maxChaseTicks: 4, minimumRunwayTicks: 2 },
      binding: { side: "BUY", contextFactId: "pivot:p1:H1:b2:low", locationFactId: `pivot:p1:M5:b2:${route === "CONTINUATION_RETEST" ? "high" : "low"}`, objectiveFactId: "pivot:p1:H1:b3:high" }
    };
  }
  var laneBScenarios = immutable([
    { id: "gold-continuation", route: "CONTINUATION_RETEST", family: "GOLD", horizon: "INTRADAY", frameCount: 3 },
    { id: "gold-reclaim", route: "REVERSAL_RECLAIM", family: "GOLD", horizon: "INTRADAY", frameCount: 3 },
    { id: "fx-continuation", route: "CONTINUATION_RETEST", family: "FX", horizon: "INTRADAY", frameCount: 3 },
    { id: "synthetic-continuation", route: "CONTINUATION_RETEST", family: "SYNTHETIC", horizon: "INTRADAY", frameCount: 3 },
    { id: "gold-swing", route: "CONTINUATION_RETEST", family: "GOLD", horizon: "SWING", frameCount: 3 },
    { id: "gold-protected-addon", route: "CONTINUATION_RETEST", family: "GOLD", horizon: "INTRADAY", frameCount: 3 },
    { id: "gold-campaign-reentry", route: "CONTINUATION_RETEST", family: "GOLD", horizon: "INTRADAY", frameCount: 3 },
    { id: "gold-margin-conflict", route: "CONTINUATION_RETEST", family: "GOLD", horizon: "INTRADAY", frameCount: 3 },
    { id: "gold-stale-account", route: "CONTINUATION_RETEST", family: "GOLD", horizon: "INTRADAY", frameCount: 3 }
  ]);

  // src/bridge.ts
  var RANKING = "SEL-4: lifecycle state (READY > WATCH > CANDIDATE) \u2192 setup priority (single route) \u2192 causal age (most recent confirmation first) \u2192 opportunityId";
  var STATE_RANK = { STRUCTURAL_READY: 3, STRUCTURAL_WATCH: 2, STRUCTURAL_CANDIDATE: 1 };
  function ref2(id, version2) {
    return { id, version: version2 };
  }
  function point2(f) {
    return f.geometry.type === "POINT" && typeof f.geometry.price === "number" ? f.geometry.price : null;
  }
  function trendOf(facts) {
    const lastTwo = (concept) => facts.filter((f) => f.concept === concept && point2(f) !== null && typeof f.geometry.time === "string").sort((a, b) => Date.parse(a.geometry.time) - Date.parse(b.geometry.time)).slice(-2).map((f) => point2(f));
    const highs = lastTwo("SWING_HIGH"), lows = lastTwo("SWING_LOW");
    if (highs.length < 2 || lows.length < 2) return "UNKNOWN";
    if (highs[1] > highs[0] && lows[1] > lows[0]) return "UP";
    if (highs[1] < highs[0] && lows[1] < lows[0]) return "DOWN";
    return "MIXED";
  }
  function profiles(r) {
    const v = r.configVersion;
    const family = { ...ref2(`family:${r.family.family}`, v), family: r.family.family, priceOrigin: r.family.priceOrigin };
    const instrument = { ...ref2(`instrument:${r.instrument.symbol}`, v), instrument: r.instrument.symbol, source: r.instrument.source, familyProfile: ref2(family.id, v), tickSize: r.instrument.tickSize };
    const timeframes = { ...ref2(`map:${r.horizon.horizon}`, v), context: r.timeframes.context, location: r.timeframes.location, entry: r.timeframes.entry, management: r.timeframes.management, maxAgeMs: { ...r.timeframes.maxAgeMs } };
    const horizon = { ...ref2(`horizon:${r.horizon.horizon}`, v), horizon: r.horizon.horizon, timeframeMap: ref2(timeframes.id, v), setupExpiryMs: r.horizon.setupExpiryMs, entryExpiryMs: r.horizon.entryExpiryMs };
    const model = {
      ...ref2(`model:${r.model.route}:${r.family.family}:${r.horizon.horizon}`, v),
      route: r.model.route,
      familyProfile: ref2(family.id, v),
      instrumentProfile: ref2(instrument.id, v),
      horizonProfile: ref2(horizon.id, v),
      strategy: ref2("zugrio-core-research", v),
      tradeBundle: ref2(`bundle:${r.model.route}:${r.instrument.symbol}:${r.horizon.horizon}`, v),
      regimeModel: ref2("context-pivot-hold", v),
      calibration: ref2(`calibration:${r.instrument.symbol}:${r.horizon.horizon}`, v),
      calibrationStatus: "UNVALIDATED_RESEARCH",
      breakTicks: r.model.breakTicks,
      touchTicks: r.model.touchTicks,
      stopTicks: r.model.stopTicks,
      maxChaseTicks: r.model.maxChaseTicks,
      minimumRunwayTicks: r.model.minimumRunwayTicks
    };
    return { family, instrument, timeframes, horizon, model };
  }
  function marketInputs(r) {
    const needed = [.../* @__PURE__ */ new Set([r.timeframes.context, r.timeframes.location, r.timeframes.entry, r.timeframes.management])].sort();
    return needed.map((tf) => {
      const m = r.markets.find((x) => x.timeframe === tf);
      if (!m || !m.bars.length) throw new Error(`missing bars for ${tf}`);
      const bars3 = m.bars.map((b) => ({
        evidenceId: `${r.instrument.symbol}:${tf}:${b.closedAt}`,
        sourceBarId: `${tf}:${b.closedAt}`,
        open: b.o,
        high: b.h,
        low: b.l,
        close: b.c,
        sourceClosedAt: b.closedAt,
        knownAt: b.closedAt,
        dataStatus: "FRESH_COMPLETE"
      }));
      return {
        instrument: r.instrument.symbol,
        source: r.instrument.source,
        timeframe: tf,
        evaluatedAt: r.evaluatedAt,
        dataVersion: `${tf}:${bars3[0].sourceClosedAt}..${bars3.at(-1).sourceClosedAt}:${bars3.length}`,
        featureDefinition: ref2("confirmed-pivot", r.configVersion),
        pivots: r.pivots.map((p) => ({ ...p })),
        bars: bars3
      };
    });
  }
  function scan(r) {
    if (r.schema !== "zugrio.ea-scan-request/v1") throw new Error("unknown request schema");
    return scanWith(prepare(r), r, r.model.route);
  }
  function scanRoutes(r) {
    if (r.schema !== "zugrio.ea-scan-request/v1") throw new Error("unknown request schema");
    if (!Array.isArray(r.routes) || r.routes.length === 0) throw new Error("routes required");
    const shared = prepare(r);
    const results = [...new Set(r.routes)].map((route) => {
      if (route !== "CONTINUATION_RETEST" && route !== "REVERSAL_RECLAIM") throw new Error(`unknown route ${route}`);
      return scanWith(shared, { ...r, model: { ...r.model, route } }, route);
    });
    return { schema: "zugrio.ea-multi-scan-result/v1", configVersion: r.configVersion, evaluatedAt: r.evaluatedAt, results };
  }
  function prepare(r) {
    const markets = marketInputs(r);
    const engine = new SharedEntryEngine();
    const store = engine.markets;
    const facts = new Map(markets.map((m) => [m.timeframe, store.materialize(m).facts]));
    const entryBars = [...markets.find((m) => m.timeframe === r.timeframes.entry).bars].sort((a, b) => Date.parse(a.sourceClosedAt) - Date.parse(b.sourceClosedAt));
    return { markets, engine, facts, lastClose: entryBars.at(-1).close };
  }
  function scanWith(shared, r, route) {
    const errors = [];
    const p = profiles(r);
    const { markets, engine, facts, lastClose } = shared;
    const tickSize = r.instrument.tickSize;
    let skipped = 0;
    let nearest = null;
    let openSky = false;
    const k = Math.max(1, Math.floor(r.enumeration.recentFactsPerRole));
    const out = [];
    for (const side of ["BUY", "SELL"]) {
      const sign = side === "BUY" ? 1 : -1;
      const support = side === "BUY" ? "SWING_LOW" : "SWING_HIGH";
      const resistance = side === "BUY" ? "SWING_HIGH" : "SWING_LOW";
      const locationConcept = route === "CONTINUATION_RETEST" ? resistance : support;
      const ctxFacts = facts.get(r.timeframes.context) ?? [];
      const locFacts = facts.get(r.timeframes.location) ?? [];
      const recent = (xs) => [...xs].sort((a, b) => Date.parse(b.knownAt) - Date.parse(a.knownAt)).slice(0, k);
      for (const c of recent(ctxFacts.filter((f) => f.concept === support && point2(f) !== null))) {
        for (const l of recent(locFacts.filter((f) => f.concept === locationConcept && point2(f) !== null))) {
          const level = point2(l);
          const objective = ctxFacts.filter((f) => f.concept === resistance && point2(f) !== null && sign * (point2(f) - level) > 0).sort((a, b) => sign * (point2(a) - point2(b)))[0];
          if (!objective) {
            if (Math.abs(lastClose - level) <= r.model.maxChaseTicks * tickSize) openSky = true;
            continue;
          }
          const distance = Math.abs(lastClose - level);
          if (!nearest || distance < nearest.distance) nearest = { distance, level, side };
          if (r.enumeration.readyOnly) {
            const stop = level - sign * r.model.stopTicks * tickSize;
            const objectivePrice = point2(objective);
            const readyable = sign * (lastClose - stop) > 0 && Math.abs(lastClose - level) <= r.model.maxChaseTicks * tickSize && sign * (objectivePrice - lastClose) >= r.model.minimumRunwayTicks * tickSize;
            if (!readyable) {
              skipped++;
              continue;
            }
          }
          const input = { markets, ...p, binding: { side, contextFactId: c.factId, locationFactId: l.factId, objectiveFactId: objective.factId } };
          try {
            const e = engine.evaluate(input);
            out.push({
              opportunityId: e.opportunityId,
              side,
              state: e.state,
              reasons: e.reasons,
              geometry: e.geometry,
              currentEntryStatus: e.currentEntry ? e.currentEntry.status : null,
              binding: { contextFactId: c.factId, locationFactId: l.factId, objectiveFactId: objective.factId },
              knownAt: e.knownAt
            });
          } catch (err) {
            errors.push(`${side} ${c.factId} ${l.factId}: ${err.message}`);
          }
        }
      }
    }
    const ranked = [...out].sort((a, b) => (STATE_RANK[b.state] ?? 0) - (STATE_RANK[a.state] ?? 0) || Date.parse(b.geometry?.frozenAt ?? b.knownAt) - Date.parse(a.geometry?.frozenAt ?? a.knownAt) || (a.opportunityId < b.opportunityId ? -1 : a.opportunityId > b.opportunityId ? 1 : 0));
    const best = ranked.find((x) => x.state === "STRUCTURAL_READY") ?? null;
    return {
      schema: "zugrio.ea-scan-result/v1",
      configVersion: r.configVersion,
      evaluatedAt: r.evaluatedAt,
      route,
      ranking: RANKING,
      candidates: ranked,
      best,
      skippedNotReadyable: skipped,
      nearestLevel: nearest,
      lastClose,
      trend: trendOf(facts.get(r.timeframes.context) ?? []),
      openSky,
      errors
    };
  }
  function selfTest() {
    const e = new SharedEntryEngine().evaluate(createEntryValidationInput("CONTINUATION_RETEST", "GOLD", "INTRADAY", 7));
    const g = e.geometry;
    const ok = e.state === "STRUCTURAL_READY" && !!g && g.entryReference === 111 && g.childInvalidation === 105 && g.objective === 130;
    return { ok, detail: `${e.state} ${g ? `${g.entryReference}/${g.childInvalidation}/${g.objective}` : "no-geometry"}` };
  }
  globalThis.ZugrioEngineBridge = {
    scan: (json) => JSON.stringify(scan(JSON.parse(json))),
    scanRoutes: (json) => JSON.stringify(scanRoutes(JSON.parse(json))),
    selfTest: () => JSON.stringify(selfTest())
  };
})();
