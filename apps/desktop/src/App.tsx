import { Fragment, useEffect, useMemo, useState } from "react";
import {
  alphaScenarios,
  buildDecisionCase,
  buildReplayChartScene,
  type DecisionCase,
  type EngineChartScene,
  type ReplayScenario,
  type StructuralState,
} from "@zugrio/decision-core";
import type { ScenarioSummary } from "@zugrio/alpha-api-contract";
import {
  LOCAL_REPLAY_LABEL,
  createConfiguredAlphaApiClient,
  type AlphaApiClient,
} from "./cloud";
import { ChartModeControls, ResearchInspector } from "./chart/ChartControls";
import { EngineChart } from "./chart/EngineChart";
import type { TracePoint } from "./chart/geometry";
import type { ChartMode } from "./chart/modes";
import { prepareSceneForRender } from "./chart/sceneGuard";

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

type CloudUiStatus =
  | { status: "idle" | "loading" | "ready" }
  | { status: "unavailable" | "error" | "rejected"; reason: string };

type RecordStatus =
  | { status: "idle" | "saving" }
  | { status: "saved"; id: string; created: boolean }
  | { status: "failed"; reason: string };

function stateLabel(state: StructuralState | null): string {
  return state ? STATE_LABELS[state] : "NO ACTIVE STRUCTURAL STATE";
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

function failureReason(status: CloudUiStatus): string | undefined {
  return "reason" in status ? status.reason : undefined;
}

export interface AppProps {
  /** Test seam only; production builds use the build-configured client. */
  readonly apiClient?: AlphaApiClient;
}

export function App({ apiClient: injectedClient }: AppProps = {}) {
  const apiClient = useMemo(() => injectedClient ?? createConfiguredAlphaApiClient(), [injectedClient]);
  const cloudConfigured = apiClient.baseUrl !== undefined;

  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [frame, setFrame] = useState(0);
  const [cloudSummaries, setCloudSummaries] = useState<readonly ScenarioSummary[]>([]);
  const [cloudScenario, setCloudScenario] = useState<ReplayScenario | undefined>();
  const [cloudDecisions, setCloudDecisions] = useState<readonly DecisionCase[]>([]);
  const [cloudScenes, setCloudScenes] = useState<readonly EngineChartScene[]>([]);
  const [cloudStatus, setCloudStatus] = useState<CloudUiStatus>({ status: cloudConfigured ? "loading" : "idle" });
  const [recordStatus, setRecordStatus] = useState<RecordStatus>({ status: "idle" });
  const [retryNonce, setRetryNonce] = useState(0);
  const [chartMode, setChartMode] = useState<ChartMode>("CLEAN");
  const [selectedPrimitiveId, setSelectedPrimitiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!cloudConfigured) return;
    let cancelled = false;

    setCloudStatus({ status: "loading" });
    void apiClient.listScenarios().then(result => {
      if (cancelled) return;
      if (result.status !== "ok") {
        setCloudStatus({
          status: result.status === "not-configured" ? "error" : result.status,
          reason: result.reason,
        });
        return;
      }
      setCloudSummaries(result.data);
      setScenarioIndex(index => Math.min(index, Math.max(0, result.data.length - 1)));
    });

    return () => { cancelled = true; };
  }, [apiClient, cloudConfigured, retryNonce]);

  const selectedCloudSummary = cloudSummaries[scenarioIndex];

  useEffect(() => {
    if (!cloudConfigured || !selectedCloudSummary) return;
    let cancelled = false;

    setCloudStatus({ status: "loading" });
    setCloudScenario(undefined);
    setCloudDecisions([]);
    setCloudScenes([]);
    setRecordStatus({ status: "idle" });
    setFrame(0);

    void (async () => {
      const detail = await apiClient.getScenario(selectedCloudSummary.id);
      if (cancelled) return;
      if (detail.status !== "ok") {
        setCloudStatus({
          status: detail.status === "not-configured" ? "error" : detail.status,
          reason: detail.reason,
        });
        return;
      }

      const frameResults = await Promise.all(
        detail.data.frames.map(async (_, index) => ({
          decision: await apiClient.getFrameDecisionCase(detail.data.id, index),
          scene: await apiClient.getFrameChartScene(detail.data.id, index),
        })),
      );
      if (cancelled) return;

      const failedDecision = frameResults
        .map(result => result.decision)
        .find(result => result.status !== "ok");
      if (failedDecision) {
        setCloudStatus({
          status: failedDecision.status === "not-configured" ? "error" : failedDecision.status,
          reason: failedDecision.reason,
        });
        return;
      }

      const failedScene = frameResults
        .map(result => result.scene)
        .find(result => result.status !== "ok");
      if (failedScene) {
        setCloudStatus({
          status: failedScene.status === "not-configured" ? "error" : failedScene.status,
          reason: failedScene.reason,
        });
        return;
      }

      setCloudScenario(detail.data as ReplayScenario);
      setCloudDecisions(
        frameResults.map(result => {
          if (result.decision.status !== "ok") throw new Error("decision result narrowed after fail-closed check");
          return result.decision.data;
        }),
      );
      setCloudScenes(
        frameResults.map(result => {
          if (result.scene.status !== "ok") throw new Error("scene result narrowed after fail-closed check");
          return result.scene.data;
        }),
      );
      setCloudStatus({ status: "ready" });
    })();

    return () => { cancelled = true; };
  }, [apiClient, cloudConfigured, selectedCloudSummary]);

  const localScenario = alphaScenarios[scenarioIndex] ?? alphaScenarios[0];
  const localDecisions = useMemo(
    () => localScenario.frames.map((_, index) => buildDecisionCase(localScenario, index)),
    [localScenario],
  );
  const localScenes = useMemo(
    () => localScenario.frames.map((_, index) => buildReplayChartScene(localScenario, index)),
    [localScenario],
  );

  const scenario = cloudConfigured ? cloudScenario : localScenario;
  const decisions = cloudConfigured ? cloudDecisions : localDecisions;
  const scenes = cloudConfigured ? cloudScenes : localScenes;
  const maxFrame = Math.max(0, (scenario?.frames.length ?? 1) - 1);
  const safeFrame = Math.min(frame, maxFrame);
  const decision = decisions[safeFrame];
  const scene = scenes[safeFrame];
  const scope = scenario?.bundle.identity.scope;

  // Presentation boundary: the scene must belong to the displayed frame and pass
  // the renderer's fail-closed checks before anything is drawn.
  const prepared = useMemo(
    () => prepareSceneForRender(scene, decision?.current.evaluatedAt),
    [scene, decision],
  );
  // Replay trace: each frame's own evaluatedAt/price, up to and including the displayed frame only.
  const trace = useMemo<readonly TracePoint[]>(
    () => decisions
      .slice(0, safeFrame + 1)
      .filter(item => item.current.price !== null)
      .map(item => ({ time: item.current.evaluatedAt, price: item.current.price as number })),
    [decisions, safeFrame],
  );
  const selectedInScene = prepared.ok && prepared.primitives.some(primitive => primitive.primitiveId === selectedPrimitiveId)
    ? selectedPrimitiveId
    : null;

  const sidebarItems = cloudConfigured
    ? cloudSummaries
    : alphaScenarios.map(item => ({
        id: item.id,
        title: item.title,
        bundle: item.bundle,
      }));

  function chooseScenario(index: number) {
    setScenarioIndex(index);
    setFrame(0);
    setRecordStatus({ status: "idle" });
  }

  async function recordCurrentCase() {
    if (!cloudConfigured || !scenario || !decision) return;
    setRecordStatus({ status: "saving" });
    const result = await apiClient.materializeDecisionCase({
      scenarioId: scenario.id,
      frameIndex: safeFrame,
    });
    if (result.status !== "ok") {
      setRecordStatus({ status: "failed", reason: result.reason });
      return;
    }
    setRecordStatus({
      status: "saved",
      id: result.data.decisionCase.id,
      created: result.data.created,
    });
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
      <div className="topbar-right">
        {cloudConfigured ? "CLOUD VALIDATION" : LOCAL_REPLAY_LABEL} · NO LIVE CAPITAL
      </div>
    </header>

    <aside className="sidebar">
      <div className="sidebar-label">{cloudConfigured ? "CLOUD CASES" : "REPLAY CASES"}</div>
      {sidebarItems.map((item, index) => <button
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
      <div className={"source-banner " + (cloudConfigured ? "cloud" : "local")}>
        <div>
          <strong>{cloudConfigured ? "ZUGRIO CLOUD" : LOCAL_REPLAY_LABEL}</strong>
          <span>
            {cloudConfigured
              ? apiClient.baseUrl
              : "Cloud API is not configured in this build. Decisions are computed locally from bundled validation fixtures."}
          </span>
        </div>
        {cloudConfigured ? <span className={"source-status status-" + cloudStatus.status}>
          {cloudStatus.status.toUpperCase()}
        </span> : <span className="source-status status-local">EXPLICIT LOCAL MODE</span>}
      </div>

      {cloudConfigured && cloudStatus.status !== "ready" ? <section className="cloud-gate">
        <div className="panel-kicker">CLOUD DECISION SOURCE</div>
        <h1>{cloudStatus.status === "loading" ? "Connecting to Zugrio Cloud…" : "Cloud decision data is unavailable."}</h1>
        <p>
          {cloudStatus.status === "loading"
            ? "The desktop is waiting for the validation API. It will not silently substitute local decision output."
            : failureReason(cloudStatus)}
        </p>
        {cloudStatus.status !== "loading" ? <button onClick={() => setRetryNonce(value => value + 1)}>RETRY CLOUD</button> : null}
      </section> : null}

      {scenario && decision && (!cloudConfigured || cloudStatus.status === "ready") ? <>
        <div className="workspace-head">
          <div>
            <div className="eyebrow">{scope?.instrument} / {scope?.market} / {scope?.horizon}</div>
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

        <div className="market-context" aria-label="Engine market context">
          <div>
            <span>STRATEGY</span>
            <strong>{scene ? `${scene.strategyId} · v${scene.strategyVersion}` : "UNAVAILABLE"}</strong>
          </div>
          <i />
          <div>
            <span>CANONICAL REGIME</span>
            <strong>{scene?.regimeLabel ?? scene?.regimeContext.status ?? "UNAVAILABLE"}</strong>
            {scene?.regimeDefinitionId ? <small>{scene.regimeDefinitionId}</small> : null}
            {scene?.regimeContext.profileId ? <small>{scene.regimeContext.profileId} · v{scene.regimeContext.profileVersion}</small> : null}
          </div>
          <i />
          <div className="market-context-routes">
            <span>ELIGIBLE RESEARCH ROUTES</span>
            <strong>
              {scene?.routeContext.status === "ROUTES_AVAILABLE"
                ? scene.routeContext.families.map(item => item.replaceAll("_", " ")).join(" · ")
                : scene?.routeContext.status === "NO_DECLARED_ROUTE"
                  ? "NO DECLARED ROUTE"
                  : "UNAVAILABLE"}
            </strong>
            {scene?.routeContext.calibrationStatus ? <small>UNVALIDATED CANDIDATE SET</small> : null}
          </div>
        </div>

        {decision.structuralState === "STRUCTURAL_READY" ? <div className="structural-banner">
          <strong>STRUCTURAL READY · NOT MODEL-SCORED</strong>
          <span>Valid structure and trade geometry. No validated pWin/EV is available for this setup.</span>
        </div> : null}

        <div className="chart-head">
          <div className="panel-kicker">ENGINE CHART SCENE</div>
          <ChartModeControls mode={chartMode} onChange={setChartMode} />
        </div>
        {prepared.ok
          ? <EngineChart
              prepared={prepared}
              trace={trace}
              mode={chartMode}
              selectedId={selectedInScene}
              onSelect={setSelectedPrimitiveId}
            />
          : <div className="chart-shell chart-rejected" role="alert">
              <strong>CHART REJECTED</strong>
              <span>{prepared.reason} Nothing from this scene is drawn.</span>
            </div>}
        {chartMode === "RESEARCH" && prepared.ok ? <ResearchInspector
          scene={prepared.scene}
          primitives={prepared.primitives}
          parents={prepared.parents}
          selectedId={selectedInScene}
          onSelect={setSelectedPrimitiveId}
        /> : null}

        <div className="replay-strip">
          <button onClick={() => setFrame(value => Math.max(0, value - 1))} disabled={safeFrame === 0}>PREV</button>
          <div><span>REPLAY FRAME</span><strong>{safeFrame + 1} / {scenario.frames.length}</strong></div>
          <input
            aria-label="Replay frame"
            type="range"
            min="0"
            max={maxFrame}
            value={safeFrame}
            onChange={event => {
              setFrame(Number(event.target.value));
              setRecordStatus({ status: "idle" });
            }}
          />
          <button onClick={() => setFrame(value => Math.min(maxFrame, value + 1))} disabled={safeFrame === maxFrame}>NEXT</button>
          {cloudConfigured ? <button className="record-case" onClick={() => void recordCurrentCase()} disabled={recordStatus.status === "saving"}>
            {recordStatus.status === "saving" ? "RECORDING…" : "RECORD CASE"}
          </button> : null}
        </div>

        {cloudConfigured && recordStatus.status !== "idle" ? <div className={"record-status record-" + recordStatus.status}>
          {recordStatus.status === "saved"
            ? `Decision Case ${recordStatus.created ? "recorded" : "already recorded"} · ${recordStatus.id}`
            : recordStatus.status === "failed"
              ? `Decision Case was not recorded · ${recordStatus.reason}`
              : "Recording Decision Case…"}
        </div> : null}

        <div className="lower-grid">
          <section className="panel">
            <div className="panel-kicker">WHAT IS STILL TRUE?</div>
            <h2>{decision.outcomeReason}</h2>
            <EvidenceRow label="Eligibility" value={formatValue(decision.current.eligibility)} />
            <EvidenceRow label="Regime evidence" value={formatValue(decision.current.regimeStatus)} />
            <EvidenceRow label="Lifecycle" value={formatValue(decision.current.lifecycle)} />
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
      </> : null}
    </section>
  </main>;
}
