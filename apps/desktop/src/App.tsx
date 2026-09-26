import { useMemo, useState } from "react";
import { alphaScenarios, buildDecisionCase, type ReplayScenario } from "@zugrio/decision-core";

function EvidenceRow({ label, value }: { label: string; value: boolean }) {
  return <div className="evidence-row"><span>{label}</span><strong>{value ? "QUALIFIES" : "NOT YET"}</strong></div>;
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

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand">ZUGRIO</div>
      <div className="release-chip">PRIVATE VALIDATION / ALPHA</div>
      <div className="topbar-right">NO LIVE CAPITAL</div>
    </header>

    <aside className="sidebar">
      <div className="sidebar-label">REPLAY CASES</div>
      {alphaScenarios.map((item, index) => <button className={index === scenarioIndex ? "case-button selected" : "case-button"} key={item.id} onClick={() => chooseScenario(index)}>
        <span>{item.bundle.instrument}</span>
        <strong>{item.title}</strong>
        <small>{item.bundle.strategy} · VALIDATION ONLY</small>
      </button>)}
      <div className="sidebar-foot"><span>BUILD</span><strong>0.1.0-alpha.1</strong></div>
    </aside>

    <section className="workspace">
      <div className="workspace-head">
        <div>
          <div className="eyebrow">{scenario.bundle.instrument} / {scenario.bundle.market} / {scenario.bundle.horizon}</div>
          <h1>{scenario.title}</h1>
          <p>{scenario.description}</p>
        </div>
        <div className={"decision-state state-" + decision.state.toLowerCase()}>
          <span>CURRENT STATE</span><strong>{decision.state}</strong>
        </div>
      </div>

      <div className="state-rail">
        {(["FORMING","READY","TRIGGERED","PASS"] as const).map((state,index) => <>
          <span key={state} className={decision.state === state ? "state-mark active" : "state-mark"}>{state}</span>
          {index < 3 ? <i key={state+"-line"} /> : null}
        </>)}
      </div>

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
          <h2>{decision.reason}</h2>
          <EvidenceRow label="Setup" value={decision.current.setupQualified}/>
          <EvidenceRow label="Location" value={decision.current.locationQualified}/>
          <EvidenceRow label="Entry trigger" value={decision.current.triggerQualified}/>
          <EvidenceRow label="Current conditions" value={decision.current.currentConditionsValid}/>
          <div className="current-note">{decision.current.note}</div>
        </section>

        <section className="panel">
          <div className="panel-kicker">DECISION CASE / HISTORY</div>
          <div className="timeline">
            {decision.history.map((event,index)=><div className="timeline-row" key={event.timestamp+index}>
              <time>{new Date(event.timestamp).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</time>
              <span className="mini-state">{event.state}</span>
              <p>{event.reason}</p>
            </div>)}
          </div>
        </section>
      </div>

      <footer className="validation-foot"><strong>Validation fixture.</strong> No live market data, performance claim, trading permission or broker execution is present in this build.</footer>
    </section>
  </main>;
}
