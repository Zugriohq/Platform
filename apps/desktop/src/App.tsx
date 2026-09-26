import { Fragment, useMemo, useState } from "react";
import {
  alphaScenarios,
  buildDecisionCase,
  type ReplayScenario,
  type StructuralLifecycle,
  type StructuralState,
} from "@zugrio/decision-core";

const STATE_LABELS: Record<StructuralState, string> = {
  STRUCTURAL_CANDIDATE: "STRUCTURAL CANDIDATE",
  STRUCTURAL_WATCH: "STRUCTURAL WATCH",
  STRUCTURAL_READY: "STRUCTURAL READY",
  INVALIDATED: "INVALIDATED",
};

const CHANGE_LABELS = {
  lifecycle: "LIFECYCLE",
  entryEventObserved: "ENTRY EVENT",
  currentEntryStatus: "CURRENT ENTRY",
} as const;

function lifecycleAtLeastRetest(lifecycle: StructuralLifecycle): boolean {
  return lifecycle === "RETEST_TOUCHED" ||
    lifecycle === "RETEST_HELD" ||
    lifecycle === "LIFECYCLE_CONFIRMED";
}

function formatValue(value: string | boolean): string {
  if (typeof value === "boolean") return value ? "OBSERVED" : "NOT OBSERVED";
  return value.replaceAll("_", " ");
}

function EvidenceRow({ label, value }: { label: string; value: string }) {
  return <div className="evidence-row"><span>{label}</span><strong>{value}</strong></div>;
}

function PriceField({ scenario, frame }: { scenario: ReplayScenario; frame: number }) {
  const points = scenario.frames.slice(0, frame + 1);
  const prices = points.map(item => item.price);
  const min = Math.min(...prices) - 0.0005;
  const max = Math.max(...prices) + 0.0005;
  const range = Math.max(max - min, 0.0001);
  const coords = prices.map((price, index) => {
    const x = points.length === 1 ? 20 : 20 + (index / (points.length - 1)) * 720;
    const y = 220 - ((price - min) / range) * 170;
    return `${x},${y}`;
  });
  const current = points[points.length - 1];
  const retestObserved = current ? lifecycleAtLeastRetest(current.lifecycle) : false;

  return <div className="chart-shell">
    <div className="chart-grid" />
    <svg viewBox="0 0 760 250" role="img" aria-label="Replay price trace">
      <polyline points={coords.join(" ")} fill="none" stroke="currentColor" strokeWidth="2.2" vectorEffect="non-scaling-stroke" />
      {coords.map((pair, index) => {
        const [x,y] = pair.split(",");
        return <circle key={pair + index} cx={x} cy={y} r={index === coords.length - 1 ? 4.5 : 2.4} fill="currentColor" />;
      })}
    </svg>
    <div className="chart-watermark">REPLAY / NOT LIVE DATA</div>
    <div className="chart-evidence" aria-label="Current replay evidence">
      <span className={retestObserved ? "evidence-chip on" : "evidence-chip"}>RETEST</span>
      <span className={current?.entryEventObserved ? "evidence-chip on" : "evidence-chip"}>ENTRY EVENT</span>
      <span className={current?.currentEntryStatus === "CURRENT" ? "evidence-chip on" : current?.currentEntryStatus === "STALE" ? "evidence-chip stale" : "evidence-chip"}>
        {current?.currentEntryStatus === "STALE" ? "ENTRY STALE" : "ENTRY CURRENT"}
      </span>
    </div>
  </div>;
}

export function App() {
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const scenario = alphaScenarios[scenarioIndex] ?? alphaScenarios[0];
  const [frame, setFrame] = useState(0);
  const decision = useMemo(() => buildDecisionCase(scenario, Math.min(frame, scenario.frames.length - 1)), [scenario, frame]);

  function chooseScenario(index: number) {
    setScenarioIndex(index);
    setFrame(0);
  }

  const rail: readonly StructuralState[] = [
    "STRUCTURAL_CANDIDATE",
    "STRUCTURAL_WATCH",
    "STRUCTURAL_READY",
    "INVALIDATED",
  ];

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand"><img src="./brand/zugrio-wordmark-flat-white.svg" alt="Zugrio" /></div>
      <div className="release-chip">PRIVATE VALIDATION / ALPHA</div>
      <div className="topbar-right">STRUCTURAL ONLY · NO LIVE CAPITAL</div>
    </header>

    <aside className="sidebar">
      <div className="sidebar-label">REPLAY CASES</div>
      {alphaScenarios.map((item, index) => <button className={index === scenarioIndex ? "case-button selected" : "case-button"} key={item.id} onClick={() => chooseScenario(index)}>
        <span>{item.bundle.instrument}</span>
        <strong>{item.title}</strong>
        <small>{item.bundle.strategy} · VALIDATION ONLY</small>
      </button>)}
      <div className="sidebar-foot"><span>BUILD</span><strong>0.1.0-alpha.2</strong></div>
    </aside>

    <section className="workspace">
      <div className="workspace-head">
        <div>
          <div className="eyebrow">{scenario.bundle.instrument} / {scenario.bundle.market} / {scenario.bundle.horizon}</div>
          <h1>{scenario.title}</h1>
          <p>{scenario.description}</p>
        </div>
        <div className={"decision-state state-" + decision.state.toLowerCase()}>
          <span>CURRENT STRUCTURAL STATE</span><strong>{STATE_LABELS[decision.state]}</strong>
        </div>
      </div>

      <div className="state-rail">
        {rail.map((state,index) => <Fragment key={state}>
          <span className={decision.state === state ? "state-mark active" : "state-mark"}>{STATE_LABELS[state]}</span>
          {index < rail.length - 1 ? <i /> : null}
        </Fragment>)}
      </div>

      {decision.state === "STRUCTURAL_READY" ? <div className="structural-banner">
        <strong>STRUCTURAL READY · NOT MODEL-SCORED</strong>
        <span>Valid structure and trade geometry. No validated pWin/EV is available for this setup.</span>
      </div> : null}

      <PriceField scenario={scenario} frame={frame} />

      <div className="replay-strip">
        <button onClick={() => setFrame(v => Math.max(0,v-1))} disabled={frame===0}>PREV</button>
        <div><span>REPLAY FRAME</span><strong>{frame+1} / {scenario.frames.length}</strong></div>
        <input aria-label="Replay frame" type="range" min="0" max={scenario.frames.length-1} value={frame} onChange={e=>setFrame(Number(e.target.value))}/>
        <button onClick={() => setFrame(v => Math.min(scenario.frames.length-1,v+1))} disabled={frame===scenario.frames.length-1}>NEXT</button>
      </div>

      <div className="lower-grid">
        <section className="panel">
          <div className="panel-kicker">WHAT IS STILL TRUE?</div>
          <h2>{decision.entryReason}</h2>
          <EvidenceRow label="Lifecycle" value={formatValue(decision.current.lifecycle)}/>
          <EvidenceRow label="Retest" value={lifecycleAtLeastRetest(decision.current.lifecycle) ? "OBSERVED" : "NOT YET"}/>
          <EvidenceRow label="Entry event" value={decision.current.entryEventObserved ? "FIXTURE OBSERVED" : "NOT OBSERVED"}/>
          <EvidenceRow label="Current entry" value={formatValue(decision.current.currentEntryStatus)}/>
          <div className="current-note">{decision.current.note}</div>
        </section>

        <section className="panel">
          <div className="panel-kicker">DECISION CASE / HISTORY</div>
          <div className="timeline">
            {decision.history.map((event,index)=><div className="timeline-row" key={event.timestamp+index}>
              <time>{new Date(event.timestamp).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</time>
              <span className="mini-state">{STATE_LABELS[event.state]}</span>
              <div className="event-copy">
                <p>{event.entryReason}</p>
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
        <strong>Validation fixture.</strong> Structural lifecycle and current-entry evidence only. No admitted inference, model-scored READY, FIRE, live market data, trading permission or broker execution is present in this build.
      </footer>
    </section>
  </main>;
}
