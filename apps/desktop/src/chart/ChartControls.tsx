import type { EngineChartPrimitive, EngineChartScene } from "@zugrio/decision-core";
import { CHART_MODES, type ChartMode } from "./modes";

const MODE_HINT: Record<ChartMode, string> = {
  CLEAN: "Primary engine facts only",
  EXPLAIN: "Up to five callouts: the newest fact's engine lineage, then other recent facts",
  STRUCTURE: "Full structural map",
  RESEARCH: "Provenance inspection",
};

export function ChartModeControls({ mode, onChange }: { mode: ChartMode; onChange: (mode: ChartMode) => void }) {
  return <div className="chart-modes" role="group" aria-label="Chart view">
    {CHART_MODES.map(item => <button
      key={item}
      type="button"
      className={item === mode ? "chart-mode active" : "chart-mode"}
      aria-pressed={item === mode}
      title={MODE_HINT[item]}
      onClick={() => onChange(item)}
    >{item}</button>)}
  </div>;
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return <div className="inspect-field">
    <dt>{label}</dt>
    <dd>{value === null || value === undefined || value === "" ? "NOT SUPPLIED" : value}</dd>
  </div>;
}

function list(values: readonly string[]): string {
  return values.length === 0 ? "NONE" : values.join("\n");
}

/** RESEARCH mode: engine-owned provenance for the scene and the selected fact. Nothing is derived. */
export function ResearchInspector({
  scene,
  primitives,
  parents,
  selectedId,
  onSelect,
}: {
  scene: EngineChartScene;
  primitives: readonly EngineChartPrimitive[];
  parents: ReadonlyMap<string, readonly string[]>;
  selectedId: string | null;
  onSelect: (primitiveId: string) => void;
}) {
  const selected = primitives.find(primitive => primitive.primitiveId === selectedId);
  return <section className="research-inspector" aria-label="Research inspector">
    <div className="inspect-facts">
      <div className="panel-kicker">ENGINE FACTS · CAUSAL ORDER</div>
      <ol>
        {primitives.map(primitive => <li key={primitive.primitiveId}>
          <button
            type="button"
            className={primitive.primitiveId === selectedId ? "fact-row selected" : "fact-row"}
            aria-pressed={primitive.primitiveId === selectedId}
            onClick={() => onSelect(primitive.primitiveId)}
          >
            <span>{primitive.label}</span>
            <small>{primitive.layer} · {primitive.visibility}</small>
          </button>
        </li>)}
      </ol>
      {primitives.length === 0 ? <p className="inspect-empty">The engine supplied no facts for this frame.</p> : null}
    </div>
    <div className="inspect-detail">
      <div className="panel-kicker">SELECTED FACT</div>
      {selected ? <dl>
        <Field label="Primitive ID" value={selected.primitiveId} />
        <Field label="Label" value={selected.label} />
        <Field label="Concept" value={selected.concept} />
        <Field label="Layer" value={selected.layer} />
        <Field label="Maturity" value={selected.maturity} />
        <Field label="Structure scale" value={selected.scale} />
        <Field label="Known at" value={selected.knownAt} />
        <Field label="Geometry" value={selected.geometry.type} />
        <Field label="Source fact IDs" value={list(selected.sourceFactIds)} />
        <Field label="Upstream facts in this scene" value={list(parents.get(selected.primitiveId) ?? [])} />
        <Field label="Source evidence IDs" value={list(selected.sourceEvidenceIds)} />
        <Field label="Visibility" value={selected.visibility} />
        <Field label="Style token" value={selected.styleToken} />
        <Field label="Authority effect" value={selected.authorityEffect} />
      </dl> : <p className="inspect-empty">Select a fact on the chart or in the list to inspect its provenance.</p>}
    </div>
    <div className="inspect-scene">
      <div className="panel-kicker">SCENE</div>
      <dl>
        <Field label="Scene ID" value={scene.sceneId} />
        <Field label="Evaluated at" value={scene.evaluatedAt} />
        <Field label="Instrument" value={scene.instrument} />
        <Field label="Timeframe" value={scene.timeframe} />
        <Field label="Strategy" value={`${scene.strategyId} · v${scene.strategyVersion}`} />
        <Field label="Regime status" value={scene.regimeContext.status} />
        <Field label="Regime" value={scene.regimeLabel} />
        <Field label="Regime evidence" value={scene.regimeEvidenceId} />
        <Field label="Regime definition" value={scene.regimeDefinitionId} />
        <Field label="Regime known at" value={scene.regimeKnownAt} />
        <Field label="Regime profile" value={scene.regimeContext.profileId ? `${scene.regimeContext.profileId} · v${scene.regimeContext.profileVersion ?? "(version not supplied)"}` : null} />
        <Field label="Route status" value={scene.routeContext.status} />
        <Field label="Route families" value={list(scene.routeContext.families)} />
        <Field label="Route calibration" value={scene.routeContext.calibrationStatus} />
        <Field label="Authority" value={scene.authority} />
        <Field label="Live capital authority" value={String(scene.liveCapitalAuthority)} />
      </dl>
    </div>
  </section>;
}
