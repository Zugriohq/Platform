import { useMemo, type KeyboardEvent } from "react";
import type { EngineChartPrimitive } from "@zugrio/decision-core";
import { anchorFor, buildScale, formatPrice, horizontalSpan, priceTicks, PLOT, type ChartScale, type TracePoint } from "./geometry";
import { DEFAULT_LAYOUT, layoutLabels, type LabelBox } from "./layout";
import { MAX_CALLOUTS, selectChartPrimitives, type ChartMode } from "./modes";
import type { RenderableScene } from "./sceneGuard";
import { STYLE_TOKENS } from "./styleTokens";

type ReadyScene = Extract<RenderableScene, { ok: true }>;

const CALLOUT_MARKER_RADIUS = 7.5;
const BOUNDS = { left: PLOT.left, top: PLOT.top, right: PLOT.width - PLOT.right, bottom: PLOT.height - PLOT.bottom };

export interface EngineChartProps {
  readonly prepared: ReadyScene;
  readonly trace: readonly TracePoint[];
  readonly mode: ChartMode;
  readonly selectedId: string | null;
  readonly onSelect: (primitiveId: string) => void;
}

function Shape({ primitive, scale }: { primitive: EngineChartPrimitive; scale: ChartScale }) {
  const style = STYLE_TOKENS[primitive.styleToken];
  const geometry = primitive.geometry;
  switch (geometry.type) {
    case "POINT":
      return <circle className="prim-mark" cx={scale.x(geometry.time)} cy={scale.y(geometry.price)} r={3.4} />;
    case "LEVEL": {
      const span = horizontalSpan(geometry, scale);
      const y = scale.y(geometry.price);
      return <line className="prim-line" x1={span.x1} x2={span.x2} y1={y} y2={y} strokeWidth={style.strokeWidth} strokeDasharray={style.dash} />;
    }
    case "ZONE": {
      const span = horizontalSpan(geometry, scale);
      const top = scale.y(geometry.high);
      const bottom = scale.y(geometry.low);
      return <rect
        className="prim-zone"
        x={span.x1}
        y={top}
        width={Math.max(0, span.x2 - span.x1)}
        height={Math.max(1, bottom - top)}
        fillOpacity={style.fillOpacity}
        strokeWidth={style.strokeWidth * 0.7}
        strokeDasharray={style.dash}
      />;
    }
    case "PATH":
      // Exactly the engine's points: no anchor choice, refit, smoothing or extension.
      return <polyline
        className="prim-path"
        points={geometry.points.map(point => `${scale.x(point.time)},${scale.y(point.price)}`).join(" ")}
        strokeWidth={style.strokeWidth}
        strokeDasharray={style.dash}
      />;
  }
}

function LabelLayer({ boxes, numbered }: { boxes: readonly LabelBox[]; numbered: boolean }) {
  return <g className={numbered ? "callout-layer" : "label-layer"}>
    {boxes.map((box, index) => <g key={box.id} data-label-for={box.id} data-placed={String(box.placed)}>
      {numbered ? <g className="callout-marker">
        <circle cx={box.anchorX} cy={box.anchorY} r={CALLOUT_MARKER_RADIUS} />
        <text x={box.anchorX} y={box.anchorY + 3.4} textAnchor="middle">{index + 1}</text>
      </g> : null}
      {box.placed ? <>
        <line
          className="label-leader"
          x1={box.anchorX}
          y1={box.anchorY}
          x2={Math.min(Math.max(box.anchorX, box.x), box.x + box.width)}
          y2={Math.min(Math.max(box.anchorY, box.y), box.y + box.height)}
        />
        <rect className="label-box" x={box.x} y={box.y} width={box.width} height={box.height} rx={3} />
        <text className="label-text" x={box.x + DEFAULT_LAYOUT.paddingX} y={box.y + box.height / 2 + 4}>{box.text}</text>
      </> : null}
    </g>)}
  </g>;
}

export function EngineChart({ prepared, trace, mode, selectedId, onSelect }: EngineChartProps) {
  const selection = useMemo(
    () => selectChartPrimitives(prepared.primitives, prepared.parents, mode),
    [prepared, mode],
  );
  const scale = useMemo(
    () => buildScale(trace, prepared.primitives, prepared.scene.evaluatedAt),
    [trace, prepared],
  );

  const byId = useMemo(() => new Map(prepared.primitives.map(primitive => [primitive.primitiveId, primitive])), [prepared]);

  const labelBoxes = useMemo(() => {
    if (!scale) return [];
    return layoutLabels(
      selection.labelled.map(id => {
        const primitive = byId.get(id)!;
        const anchor = anchorFor(primitive, scale);
        return { id, anchorX: anchor.x, anchorY: anchor.y, text: primitive.label };
      }),
      BOUNDS,
    );
  }, [selection, scale, byId]);

  const calloutBoxes = useMemo(() => {
    if (!scale) return [];
    return layoutLabels(
      selection.callouts.slice(0, MAX_CALLOUTS).map(primitive => {
        const anchor = anchorFor(primitive, scale);
        return { id: primitive.primitiveId, anchorX: anchor.x, anchorY: anchor.y, text: primitive.label };
      }),
      BOUNDS,
      { ...DEFAULT_LAYOUT, maxPlaced: MAX_CALLOUTS, anchorClearance: CALLOUT_MARKER_RADIUS + 2 },
    );
  }, [selection, scale]);

  if (!scale) {
    return <div className="chart-shell chart-rejected" role="alert">
      <strong>CHART UNAVAILABLE</strong>
      <span>This frame has no finite engine geometry or replay price to draw.</span>
    </div>;
  }

  const interactive = mode === "RESEARCH";
  const hiddenLabels = labelBoxes.filter(box => !box.placed).length;
  const tracePoints = trace.map(point => `${scale.x(point.time)},${scale.y(point.price)}`);
  const last = trace.at(-1);

  function keySelect(event: KeyboardEvent, id: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(id);
    }
  }

  return <div className={"chart-shell mode-" + mode.toLowerCase()} data-chart-mode={mode}>
    <svg viewBox={`0 0 ${PLOT.width} ${PLOT.height}`} role="img" aria-label={`Engine chart scene, ${mode.toLowerCase()} view`}>
      <g className="price-axis" aria-hidden="true">
        {priceTicks(scale).map(price => <g key={price}>
          <line x1={PLOT.left} x2={PLOT.width - PLOT.right} y1={scale.y(price)} y2={scale.y(price)} />
          <text x={PLOT.width - PLOT.right + 10} y={scale.y(price) + 3.5}>{formatPrice(price, scale)}</text>
        </g>)}
      </g>

      <g className="primitive-layer">
        {selection.drawn.map(primitive => {
          const selected = primitive.primitiveId === selectedId;
          return <g
            key={primitive.primitiveId}
            className={[
              "prim",
              STYLE_TOKENS[primitive.styleToken].className,
              "emph-" + (selection.emphasis.get(primitive.primitiveId) ?? "HISTORICAL").toLowerCase(),
              selected ? "is-selected" : "",
            ].join(" ")}
            data-primitive-id={primitive.primitiveId}
            data-concept={primitive.concept}
            data-geometry={primitive.geometry.type}
            data-emphasis={selection.emphasis.get(primitive.primitiveId)}
            {...(interactive ? {
              role: "button",
              tabIndex: 0,
              "aria-label": `Inspect ${primitive.label}`,
              "aria-pressed": selected,
              onClick: () => onSelect(primitive.primitiveId),
              onKeyDown: (event: KeyboardEvent) => keySelect(event, primitive.primitiveId),
            } : {})}
          >
            <title>{primitive.label}</title>
            <Shape primitive={primitive} scale={scale} />
          </g>;
        })}
      </g>

      {tracePoints.length > 0 ? <g className="trace" aria-hidden="true">
        <polyline points={tracePoints.join(" ")} />
        {last ? <circle cx={scale.x(last.time)} cy={scale.y(last.price)} r={3.6} /> : null}
      </g> : null}

      {mode === "EXPLAIN" ? <LabelLayer boxes={calloutBoxes} numbered /> : <LabelLayer boxes={labelBoxes} numbered={false} />}
    </svg>
    <div className="chart-watermark">POINT-IN-TIME REPLAY · ENGINE-OWNED FACTS · NOT LIVE DATA</div>
    {mode === "EXPLAIN" && calloutBoxes.length > 0 ? <ol className="callout-legend" aria-label="Causal callouts">
      {calloutBoxes.map(box => <li key={box.id} title={byId.get(box.id)?.label}>{box.text}</li>)}
    </ol> : null}
    {hiddenLabels > 0 ? <div className="chart-collapsed">{hiddenLabels} labels collapsed · inspect in RESEARCH</div> : null}
  </div>;
}
