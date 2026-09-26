import { Fragment, useMemo, useState } from "react";
import {
  alphaScenarios,
  buildDecisionCase,
  type DecisionCase,
  type ReplayScenario,
  type StructuralLifecycle,
  type StructuralState,
} from "@zugrio/decision-core";

const STATE_LABELS: Record<StructuralState, string> = {
  STRUCTURAL_CANDIDATE: "STRUCTURAL CANDIDATE",
  STRUCTURAL_WATCH: "STRUCTURAL WATCH",
  STRUCTURAL_READY: "STRUCTURAL READY",
};

const CHANGE_LABELS = {
  eligibility: "ELIGIBILITY",
  lifecycle: "LIFECYCLE",
  regimeStatus: "REGIME",
  entryEventObserved: "ENTRY EVENT",
  currentEntryStatus: "CURRENT ENTRY",
} as const;

function stateLabel(state: StructuralState | null): string {
  return state ? STATE_LABELS[state] : "NO ACTIVE STRUCTURAL STATE";
}

function lifecycleAtLeastRetest(lifecycle: StructuralLifecycle | null): boolean {
  return lifecycle === "RETEST_TOUCHED" ||
    lifecycle === "RETEST_HELD" ||
    lifecycle === "LIFECYCLE_CONFIRMED";
}

function formatValue(value: string | boolean | number | null): string {
  if (value === null) return "UNAVAILABLE";
  if (typeof value === "boolean") return value ? "OBSERVED" : "NOT OBSERVED";
  if (typeof value === "number") return String(value);
  return value.replaceAll("_", " ");
}

function EvidenceRow({ label, value }: { label: string; value: string }) {
  return <div className="evidence-row"><span>{label}</span><strong>{value}</strong></div>;
}

function PriceField({
  scenario,
  frame,
  decision,
}: {
  scenario: ReplayScenario;
  frame: number;
  decision: DecisionCase;
}) {
  const decisions = scenario.frames
    .slice(0, frame + 1)
    .map((_, index) => buildDecisionCase(scenario, index));

  const snapshots = decisions
    .map((item) => item.current)
    .filter((snapshot) => snapshot.price !== null);

  const prices = snapshots.map((snapshot) => snapshot.price as number);
  const min = Math.min(...prices) - 0.0005;
  const max = Math.max(...prices) + 0.0005;
  const range = Math.max(max - min, 0.0001);
  const coords = prices.map((price, index) => {
    const x = prices.length === 1 ? 20 : 20 + (index / (prices.length - 1)) * 720;
    const y = 220 - ((price - min) / range) * 170;
    return `${x},${y}`;
  });

  const current = decision.current;
  const retestObserved = lifecycleAtLeastRetest(current.lifecycle);
  const entryClass =
    current.currentEntryStatus === "CURRENT"
      ? "evidence-chip on"
      : current.currentEntryStatus === "STALE"
        ? "evidence-chip stale"
        : "evidence-chip";
  const entryLabel =
    current.currentEntryStatus === "CURRENT"
      ? "ENTRY CURRENT"
      : current.currentEntryStatus === "STALE"
        ? "ENTRY STALE"
        : "NO ENTRY";

  return <div className="chart-shell">
    <div className="chart-grid" />
    <svg viewBox="0 0 760 250" role="img" aria-label="Point-in-time replay price trace">
      <polyline points={coords.join(" ")} fill="none" stroke="currentColor" strokeWidth="2.2" vectorEffect="non-scaling-stroke" />
      {coords.map((pair, index) => {
        const [x,y] = pair.split(",");
        const item = decisions[index];
        const labels = item?.annotations.map(annotation => annotation.label) ?? [];
        const meaningful = labels.filter(label =>
          label.includes("BREAK") ||
          label.includes("RETEST") ||
          label.includes("LIFECYCLE CONFIRMED") ||
          label.includes("ENTRY CURRENT") ||
          label.includes("ENTRY STALE")
        );
        return <g key={pair + index}>
          <circle cx={x} cy={y} r={index === coords.length - 1 ? 4.5 : 2.4} fill="currentColor" />
          {meaningful.map((label, labelIndex) => <g key={label}>
            <line x1={x} y1={Number(y) - 8} x2={x} y2={Number(y) - 29 - labelIndex * 19} className="annotation-line" />
            <rect
              x={Math.max(4, Math.min(620, Number(x) - 42))}
              y={Number(y) - 47 - labelIndex * 19}
              width="118"
              height="16"
              rx="8"
              className="annotation-badge"
            />
            <text
              x={Math.max(12, Math.min(628, Number(x) - 34))}
              y={Number(y) - 36 - labelIndex * 19}
              className="annotation-text"
            >
              {label}
            </text>
          </g>)}
        </g>;
      })}
    </svg>
    <div className="chart-watermark">POINT-IN-TIME REPLAY / NOT LIVE DATA</div>
    <div className="chart-evidence" aria-label="Current replay evidence">
      <span className={retestObserved ? "evidence-chip on" : "evidence-chip"}>RETEST</span>
      <span className={current.entryEventObserved ? "evidence-chip on" : "evidence-chip"}>ENTRY EVENT</span>
      <span className={entryClass}>{entryLabel}</span>
    </div>
  </div>;
}

export function App() {
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const scenario = alphaScenarios[scenarioIndex] ?? alphaScenarios[0];
  const [frame, setFrame] = useState(0);
  const safeFrame = Math.min(frame, scenario.frames.length - 1);
  const decision = useMemo(
    () => buildDecisionCase(scenario, safeFrame),
    [scenario, safeFrame],
  );
  const scope = scenario.bundle.identity.scope;

  function chooseScenario(index: number) {
    setScenarioIndex(index);
    setFrame(0);
  }

  const rail: readonly StructuralState[] = [
    "STRUCTURAL_CANDIDATE",
    "STRUCTURAL_WATCH",
    "STRUCTURAL_READY",
  ];

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand"><img src="./brand/zugrio-wordmark-flat-white.svg" alt="Zugrio" /></div>
      <div className="release-chip">PRIVATE VALIDATION / ALPHA</div>
      <div className="topbar-right">STRUCTURAL ONLY · NO LIVE CAPITAL</div>
    </header>

    <aside className="sidebar">
      <div className="sidebar-label">REPLAY CASES</div>
      {alphaScenarios.map((item, index) => <button
        className={index === scenarioIndex ? "case-button selected" : "case-button"}
        key={item.id}
        onClick={() => chooseScenario(index)}
      >
        <span>{item.bundle.identity.scope.instrument}</span>
        <strong>{item.title}</strong>
        <small>{item.bundle.strategy} · {item.bundle.identity.scope.admission.replaceAll("_", " ")}</small>
      </button>)}
      <div className="sidebar-foot"><span>BUILD</span><strong>0.1.0-alpha.2</strong></div>
    </aside>

    <section className="workspace">
      <div className="workspace-head">
        <div>
          <div className="eyebrow">{scope.instrument} / {scope.market} / {scope.horizon}</div>
          <h1>{scenario.title}</h1>
          <p>{scenario.description}</p>
        </div>
        <div className={"decision-state state-" + (decision.structuralState ?? "none").toLowerCase()}>
          <span>CURRENT STRUCTURAL STATE</span>
          <strong>{stateLabel(decision.structuralState)}</strong>
          <em>{decision.outcome.replaceAll("_", " ")}</em>
        </div>
      </div>

      <div className="state-rail">
        {rail.map((state,index) => <Fragment key={state}>
          <span className={decision.structuralState === state ? "state-mark active" : "state-mark"}>{STATE_LABELS[state]}</span>
          {index < rail.length - 1 ? <i /> : null}
        </Fragment>)}
      </div>

      {decision.structuralState === "STRUCTURAL_READY" ? <div className="structural-banner">
        <strong>STRUCTURAL READY · NOT MODEL-SCORED</strong>
        <span>Valid structure and trade geometry. No validated pWin/EV is available for this setup.</span>
      </div> : null}

      <PriceField scenario={scenario} frame={safeFrame} decision={decision} />

      <div className="replay-strip">
        <button onClick={() => setFrame(value => Math.max(0, value - 1))} disabled={safeFrame === 0}>PREV</button>
        <div><span>REPLAY FRAME</span><strong>{safeFrame + 1} / {scenario.frames.length}</strong></div>
        <input
          aria-label="Replay frame"
          type="range"
          min="0"
          max={scenario.frames.length - 1}
          value={safeFrame}
          onChange={event => setFrame(Number(event.target.value))}
        />
        <button onClick={() => setFrame(value => Math.min(scenario.frames.length - 1, value + 1))} disabled={safeFrame === scenario.frames.length - 1}>NEXT</button>
      </div>

      <div className="lower-grid">
        <section className="panel">
          <div className="panel-kicker">WHAT IS STILL TRUE?</div>
          <h2>{decision.outcomeReason}</h2>
          <EvidenceRow label="Eligibility" value={formatValue(decision.current.eligibility)} />
          <EvidenceRow label="Regime evidence" value={formatValue(decision.current.regimeStatus)} />
          <EvidenceRow label="Lifecycle" value={formatValue(decision.current.lifecycle)} />
          <EvidenceRow label="Retest" value={lifecycleAtLeastRetest(decision.current.lifecycle) ? "OBSERVED" : "NOT YET"} />
          <EvidenceRow label="Entry event" value={decision.current.entryEventObserved ? "FIXTURE OBSERVED" : "NOT OBSERVED"} />
          <EvidenceRow label="Current entry" value={formatValue(decision.current.currentEntryStatus)} />
          <EvidenceRow label="Outcome" value={formatValue(decision.outcome)} />
          <div className="current-note">{decision.current.note}</div>
        </section>

        <section className="panel">
          <div className="panel-kicker">DECISION CASE / HISTORY</div>
          <div className="timeline">
            {decision.history.map((event,index)=><div className="timeline-row" key={event.evaluationId + index}>
              <time>{new Date(event.evaluatedAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</time>
              <span className="mini-state">{stateLabel(event.structuralState)}</span>
              <div className="event-copy">
                <p>{event.outcomeReason}</p>
                {event.changes.length > 0 ? <div className="event-changes">
                  {event.changes.map(change => <span key={change.field + String(change.to)} className="event-change on">
                    {CHANGE_LABELS[change.field]} → {formatValue(change.to)}
                  </span>)}
                </div> : null}
              </div>
            </div>)}
          </div>
        </section>
      </div>

      <footer className="validation-foot">
        <strong>Validation fixture.</strong> Point-in-time structural lifecycle and current-entry evidence only. PASS is an outcome, not an opportunity state. No admitted inference, model-scored READY, FIRE, live market data, trading permission or broker execution is present in this build.
      </footer>
    </section>
  </main>;
}
