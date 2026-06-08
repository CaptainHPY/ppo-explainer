"use client";

import { useMemo, useState } from "react";

import DiagnosticsModal from "@/components/metrics/DiagnosticsModal";
import { useMetricSeries } from "@/hooks/useMetricSeries";
import type { MetricPoint } from "@/lib/metrics";

type TrainingState = "safe" | "policyShift" | "clipActive" | "criticLearning" | "criticLagging";
type ViewMode = "spiral" | "transition" | "network" | null;

type TrainingPoint = {
  index: number;
  step: number;
  approxKl: number;
  clipfrac: number;
  valueLoss: number;
  explainedVariance: number;
  state: TrainingState;
};

type NetworkLayer = {
  id: string;
  label: string;
  role: string;
  shape: string;
  formula: string;
  x: number;
  y: number;
  color: string;
  columns: number;
  rows: number;
};

const stateLabels: Record<TrainingState, string> = {
  safe: "Stable update",
  policyShift: "Policy step rising",
  clipActive: "Clip active",
  criticLearning: "Critic improving",
  criticLagging: "Critic lagging",
};

const stateColors: Record<TrainingState, string> = {
  safe: "#45b7a8",
  policyShift: "#4c78d8",
  clipActive: "#e85d75",
  criticLearning: "#7c60d4",
  criticLagging: "#f2a93b",
};

const networkLayers: NetworkLayer[] = [
  {
    id: "obs",
    label: "Input s",
    role: "Shared input",
    shape: "(16)",
    formula: "state vector",
    x: 92,
    y: 282,
    color: "#64748b",
    columns: 4,
    rows: 4,
  },
  {
    id: "actor_fc1",
    label: "Actor fc1",
    role: "Actor branch",
    shape: "Wpi1 (64,16)",
    formula: "u1 = Wpi1 s + b1",
    x: 260,
    y: 132,
    color: "#4c78d8",
    columns: 6,
    rows: 6,
  },
  {
    id: "actor_fc2",
    label: "Actor fc2",
    role: "Actor branch",
    shape: "Wpi2 (64,64)",
    formula: "h2 = tanh(Wpi2 h1 + b2)",
    x: 452,
    y: 132,
    color: "#4c78d8",
    columns: 6,
    rows: 6,
  },
  {
    id: "actor_logits",
    label: "logits",
    role: "Policy output",
    shape: "WpiOut (4,64)",
    formula: "pi(a|s) = softmax(logits)",
    x: 648,
    y: 132,
    color: "#4c78d8",
    columns: 2,
    rows: 4,
  },
  {
    id: "critic_fc1",
    label: "Critic fc1",
    role: "Critic branch",
    shape: "WV1 (64,16)",
    formula: "u1 = WV1 s + b1",
    x: 260,
    y: 410,
    color: "#e85d75",
    columns: 6,
    rows: 6,
  },
  {
    id: "critic_fc2",
    label: "Critic fc2",
    role: "Critic branch",
    shape: "WV2 (64,64)",
    formula: "h2 = tanh(WV2 h1 + b2)",
    x: 452,
    y: 410,
    color: "#e85d75",
    columns: 6,
    rows: 6,
  },
  {
    id: "critic_value",
    label: "V(s)",
    role: "Value output",
    shape: "WVOut (1,64)",
    formula: "V(s) = WVOut h2 + b",
    x: 648,
    y: 410,
    color: "#e85d75",
    columns: 1,
    rows: 5,
  },
];

const networkEdges = [
  ["obs", "actor_fc1", "shared to actor"],
  ["actor_fc1", "actor_fc2", "tanh(h1)"],
  ["actor_fc2", "actor_logits", "policy logits"],
  ["obs", "critic_fc1", "shared to critic"],
  ["critic_fc1", "critic_fc2", "tanh(h1)"],
  ["critic_fc2", "critic_value", "state value"],
] as const;

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function normalize(value: number, min: number, max: number) {
  if (max <= min) return 0;
  return clamp((value - min) / (max - min));
}

function nearestPoint(data: MetricPoint[], step: number) {
  if (!data.length) return null;

  let best = data[0];
  let bestDistance = Math.abs(best.step - step);
  for (let index = 1; index < data.length; index += 1) {
    const candidate = data[index];
    const distance = Math.abs(candidate.step - step);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

function classifyPoint(point: Omit<TrainingPoint, "state">): TrainingState {
  if (point.clipfrac >= 0.01) return "clipActive";
  if (point.approxKl >= 0.0015) return "policyShift";
  if (point.explainedVariance >= 0.28 && point.valueLoss < 55) return "criticLearning";
  if (point.explainedVariance < 0.05 || point.valueLoss >= 65) return "criticLagging";
  return "safe";
}

function buildTrainingPoints(
  approxKl: MetricPoint[],
  clipfrac: MetricPoint[],
  valueLoss: MetricPoint[],
  explainedVariance: MetricPoint[],
) {
  return approxKl
    .map((approxPoint, index) => {
      const clipPoint = nearestPoint(clipfrac, approxPoint.step);
      const valuePoint = nearestPoint(valueLoss, approxPoint.step);
      const evPoint = nearestPoint(explainedVariance, approxPoint.step);
      if (!clipPoint || !valuePoint || !evPoint) return null;

      const basePoint = {
        index,
        step: approxPoint.step,
        approxKl: approxPoint.value,
        clipfrac: clipPoint.value,
        valueLoss: valuePoint.value,
        explainedVariance: evPoint.value,
      };

      return { ...basePoint, state: classifyPoint(basePoint) };
    })
    .filter((point): point is TrainingPoint => point !== null);
}

function metricExtent(points: TrainingPoint[], read: (point: TrainingPoint) => number) {
  const values = points.map(read);
  return { min: Math.min(...values), max: Math.max(...values) };
}

function SpiralGlyphView({ points }: { points: TrainingPoint[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const activePoint = activeIndex === null ? points[points.length - 1] : points[activeIndex];

  const extents = useMemo(
    () => ({
      approxKl: metricExtent(points, (point) => point.approxKl),
      clipfrac: metricExtent(points, (point) => point.clipfrac),
      valueLoss: metricExtent(points, (point) => point.valueLoss),
      explainedVariance: metricExtent(points, (point) => point.explainedVariance),
    }),
    [points],
  );

  const glyphs = useMemo(() => {
    const centerX = 360;
    const centerY = 286;
    const turns = 3.4;
    return points.map((point, index) => {
      const t = points.length <= 1 ? 0 : index / (points.length - 1);
      const angle = -Math.PI / 2 + t * turns * Math.PI * 2;
      const radius = 32 + t * 212;
      const kl = normalize(point.approxKl, extents.approxKl.min, extents.approxKl.max);
      const clip = normalize(point.clipfrac, extents.clipfrac.min, extents.clipfrac.max);
      const value = normalize(point.valueLoss, extents.valueLoss.min, extents.valueLoss.max);
      const ev = normalize(point.explainedVariance, extents.explainedVariance.min, extents.explainedVariance.max);

      return {
        ...point,
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        radius: 5 + value * 8,
        strokeWidth: 1.6 + kl * 4.2,
        opacity: 0.38 + ev * 0.55,
        dash: clip > 0 ? `${Math.max(2, 8 - clip * 5)} ${Math.max(2, 2 + clip * 8)}` : "0",
      };
    });
  }, [extents, points]);

  const path = glyphs
    .map((glyph, index) => `${index === 0 ? "M" : "L"} ${glyph.x.toFixed(1)} ${glyph.y.toFixed(1)}`)
    .join(" ");

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
      <div className="rounded-xl border border-base-300 bg-base-200/60 p-3">
        <svg viewBox="0 0 720 570" className="h-[56vh] min-h-[420px] w-full" role="img">
          <title>PPO training state spiral</title>
          <path d={path} fill="none" stroke="currentColor" strokeOpacity="0.16" strokeWidth="2" />
          {glyphs.map((glyph) => (
            <g
              key={glyph.step}
              onMouseEnter={() => setActiveIndex(glyph.index)}
              onFocus={() => setActiveIndex(glyph.index)}
              tabIndex={0}
              className="cursor-pointer outline-none"
            >
              <circle
                cx={glyph.x}
                cy={glyph.y}
                r={glyph.radius}
                fill={stateColors[glyph.state]}
                fillOpacity={glyph.opacity}
                stroke={stateColors[glyph.state]}
                strokeWidth={glyph.strokeWidth}
                strokeDasharray={glyph.dash}
              />
              <circle cx={glyph.x} cy={glyph.y} r={Math.max(2.2, glyph.radius * 0.32)} fill="#fff" fillOpacity="0.72" />
            </g>
          ))}
          {activePoint ? (
            <circle
              cx={glyphs[activePoint.index]?.x}
              cy={glyphs[activePoint.index]?.y}
              r={(glyphs[activePoint.index]?.radius ?? 8) + 7}
              fill="none"
              stroke="#111827"
              strokeWidth="2"
              strokeOpacity="0.7"
            />
          ) : null}
        </svg>
      </div>

      <aside className="rounded-xl border border-base-300 bg-base-100 p-4">
        <div className="text-sm font-semibold text-base-content">Selected update</div>
        <div className="mt-3 rounded-lg border border-base-300 bg-base-200/60 p-3">
          <div className="text-xs font-semibold text-base-content/55">State</div>
          <div className="mt-1 text-sm font-semibold text-base-content">
            {activePoint ? stateLabels[activePoint.state] : "None"}
          </div>
          <div className="mt-2 text-xs leading-5 text-base-content/65">
            {activePoint
              ? `step ${activePoint.step} / KL ${activePoint.approxKl.toFixed(4)} / clip ${(
                  activePoint.clipfrac * 100
                ).toFixed(1)}% / value loss ${activePoint.valueLoss.toFixed(1)} / EV ${activePoint.explainedVariance.toFixed(3)}`
              : "Hover a spiral node to inspect a PPO update."}
          </div>
        </div>
        <p className="mt-4 text-xs leading-5 text-base-content/60">
          The spiral encodes time from center to edge. Stroke width shows KL, broken rings show clip pressure, size shows
          value loss, and brightness shows explained variance.
        </p>
      </aside>
    </div>
  );
}

function buildTransitionEdges(points: TrainingPoint[]) {
  const edgeMap = new Map<string, { from: TrainingState; to: TrainingState; count: number }>();
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1].state;
    const to = points[index].state;
    const key = `${from}->${to}`;
    edgeMap.set(key, { from, to, count: (edgeMap.get(key)?.count ?? 0) + 1 });
  }
  return Array.from(edgeMap.values()).sort((left, right) => right.count - left.count);
}

function TransitionStateView({ points }: { points: TrainingPoint[] }) {
  const edges = useMemo(() => buildTransitionEdges(points), [points]);
  const counts = useMemo(
    () =>
      points.reduce<Record<TrainingState, number>>(
        (accumulator, point) => {
          accumulator[point.state] += 1;
          return accumulator;
        },
        { safe: 0, policyShift: 0, clipActive: 0, criticLearning: 0, criticLagging: 0 },
      ),
    [points],
  );

  const nodePositions: Record<TrainingState, { x: number; y: number }> = {
    safe: { x: 360, y: 285 },
    policyShift: { x: 358, y: 96 },
    clipActive: { x: 610, y: 240 },
    criticLearning: { x: 470, y: 472 },
    criticLagging: { x: 112, y: 372 },
  };
  const maxEdge = Math.max(...edges.map((edge) => edge.count), 1);
  const maxCount = Math.max(...Object.values(counts), 1);

  function edgePath(from: TrainingState, to: TrainingState) {
    const start = nodePositions[from];
    const end = nodePositions[to];
    if (from === to) {
      return `M ${start.x - 34} ${start.y - 34} C ${start.x - 98} ${start.y - 98}, ${start.x + 98} ${start.y - 98}, ${
        start.x + 34
      } ${start.y - 34}`;
    }
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2 - 55;
    return `M ${start.x} ${start.y} Q ${midX} ${midY} ${end.x} ${end.y}`;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="rounded-xl border border-base-300 bg-base-200/60 p-3">
        <svg viewBox="0 0 720 570" className="h-[56vh] min-h-[420px] w-full" role="img">
          <title>PPO state transition graph</title>
          <defs>
            <marker id="state-arrow" markerWidth="9" markerHeight="9" refX="8" refY="3" orient="auto">
              <polygon points="0 0, 9 3, 0 6" fill="#6b7280" />
            </marker>
          </defs>
          {edges.map((edge) => (
            <path
              key={`${edge.from}-${edge.to}`}
              d={edgePath(edge.from, edge.to)}
              fill="none"
              stroke="#6b7280"
              strokeOpacity={0.18 + 0.5 * (edge.count / maxEdge)}
              strokeWidth={1.5 + 8 * (edge.count / maxEdge)}
              markerEnd="url(#state-arrow)"
            />
          ))}
          {(Object.keys(nodePositions) as TrainingState[]).map((state) => {
            const position = nodePositions[state];
            const radius = 34 + 32 * (counts[state] / maxCount);
            return (
              <g key={state}>
                <circle
                  cx={position.x}
                  cy={position.y}
                  r={radius}
                  fill={stateColors[state]}
                  fillOpacity="0.22"
                  stroke={stateColors[state]}
                  strokeWidth="2"
                />
                <circle cx={position.x} cy={position.y} r={radius * 0.58} fill={stateColors[state]} fillOpacity="0.8" />
                <text x={position.x} y={position.y - 5} textAnchor="middle" className="fill-base-100 text-[16px] font-bold">
                  {counts[state]}
                </text>
                <text
                  x={position.x}
                  y={position.y + radius + 24}
                  textAnchor="middle"
                  className="fill-base-content text-[15px] font-semibold"
                >
                  {stateLabels[state]}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <aside className="rounded-xl border border-base-300 bg-base-100 p-4">
        <div className="text-sm font-semibold text-base-content">Transition summary</div>
        <p className="mt-2 text-xs leading-5 text-base-content/60">
          Nodes are training states. Node size shows dwell time; edge thickness shows transition frequency.
        </p>
        <div className="mt-4 space-y-2">
          {edges.slice(0, 7).map((edge) => (
            <div key={`${edge.from}-${edge.to}`} className="rounded-lg border border-base-300 bg-base-200/50 px-3 py-2">
              <div className="text-xs font-semibold text-base-content/70">
                {stateLabels[edge.from]} -&gt; {stateLabels[edge.to]}
              </div>
              <div className="mt-1 text-xs text-base-content/45">{edge.count} transitions</div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

function NetworkMatrixBlock({ layer, active }: { layer: NetworkLayer; active: boolean }) {
  const width = layer.columns * 12 + (layer.columns - 1) * 3 + 24;
  const height = layer.rows * 10 + (layer.rows - 1) * 3 + 48;
  const left = layer.x - width / 2;
  const top = layer.y - height / 2;
  const cells = Array.from({ length: layer.columns * layer.rows }, (_, index) => index);

  return (
    <g>
      <rect
        x={left}
        y={top}
        width={width}
        height={height}
        rx="12"
        fill={layer.color}
        fillOpacity={active ? 0.18 : 0.1}
        stroke={layer.color}
        strokeWidth={active ? 2.6 : 1.4}
      />
      <text x={layer.x} y={top + 18} textAnchor="middle" className="fill-base-content text-[13px] font-bold">
        {layer.label}
      </text>
      <text x={layer.x} y={top + 34} textAnchor="middle" className="fill-base-content/60 text-[10px]">
        {layer.shape}
      </text>
      {cells.map((index) => {
        const col = index % layer.columns;
        const row = Math.floor(index / layer.columns);
        const opacity = 0.28 + ((index * 7 + layer.id.length) % 9) * 0.07;
        return (
          <rect
            key={index}
            x={left + 12 + col * 15}
            y={top + 42 + row * 13}
            width="12"
            height="10"
            rx="2"
            fill={layer.color}
            fillOpacity={opacity}
          />
        );
      })}
    </g>
  );
}

function ActorCriticNetworkView() {
  const [activeLayerId, setActiveLayerId] = useState("actor_fc1");
  const activeLayer = networkLayers.find((layer) => layer.id === activeLayerId) ?? networkLayers[1];
  const layerById = new Map(networkLayers.map((layer) => [layer.id, layer]));

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="rounded-xl border border-base-300 bg-base-200/60 p-3">
        <svg viewBox="0 0 760 570" className="h-[56vh] min-h-[420px] w-full" role="img">
          <title>Layered NodeTrix Actor-Critic Network</title>
          <defs>
            <marker id="network-arrow" markerWidth="9" markerHeight="9" refX="8" refY="3" orient="auto">
              <polygon points="0 0, 9 3, 0 6" fill="#64748b" />
            </marker>
          </defs>

          <rect x="190" y="42" width="530" height="218" rx="18" fill="#4c78d8" fillOpacity="0.06" />
          <rect x="190" y="318" width="530" height="218" rx="18" fill="#e85d75" fillOpacity="0.06" />
          <text x="214" y="70" className="fill-base-content/65 text-[14px] font-bold">
            Actor Branch
          </text>
          <text x="214" y="346" className="fill-base-content/65 text-[14px] font-bold">
            Critic Branch
          </text>
          <text x="58" y="236" className="fill-base-content/55 text-[12px] font-semibold">
            Shared Input
          </text>

          {networkEdges.map(([fromId, toId, label]) => {
            const from = layerById.get(fromId)!;
            const to = layerById.get(toId)!;
            const midX = (from.x + to.x) / 2;
            const midY = (from.y + to.y) / 2;
            const active = activeLayerId === fromId || activeLayerId === toId;
            return (
              <g key={`${fromId}-${toId}`}>
                <path
                  d={`M ${from.x + 46} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x - 54} ${to.y}`}
                  fill="none"
                  stroke={active ? to.color : "#64748b"}
                  strokeOpacity={active ? 0.72 : 0.28}
                  strokeWidth={active ? 3 : 1.6}
                  markerEnd="url(#network-arrow)"
                />
                <text x={midX} y={midY - 8} textAnchor="middle" className="fill-base-content/45 text-[10px]">
                  {label}
                </text>
              </g>
            );
          })}

          {networkLayers.map((layer) => (
            <g
              key={layer.id}
              className="cursor-pointer"
              onMouseEnter={() => setActiveLayerId(layer.id)}
              onFocus={() => setActiveLayerId(layer.id)}
              tabIndex={0}
            >
              <NetworkMatrixBlock layer={layer} active={activeLayerId === layer.id} />
            </g>
          ))}
        </svg>
      </div>

      <aside className="rounded-xl border border-base-300 bg-base-100 p-4">
        <div className="text-sm font-semibold text-base-content">Layer details</div>
        <div className="mt-3 rounded-lg border border-base-300 bg-base-200/60 p-3">
          <div className="text-xs font-semibold text-base-content/55">{activeLayer.role}</div>
          <div className="mt-1 text-sm font-bold text-base-content">{activeLayer.label}</div>
          <div className="mt-2 text-xs leading-5 text-base-content/65">
            <div>Shape: {activeLayer.shape}</div>
            <div>Formula: {activeLayer.formula}</div>
          </div>
        </div>
        <p className="mt-4 text-xs leading-5 text-base-content/60">
          Node-link edges show information flow. Matrix blocks show each Linear layer as a compact NodeTrix-style weight
          structure, avoiding a dense 64-neuron drawing.
        </p>
        <div className="mt-4 space-y-2 text-xs text-base-content/65">
          <div className="rounded-lg bg-primary/10 px-3 py-2">Actor maps state features to policy logits.</div>
          <div className="rounded-lg bg-secondary/10 px-3 py-2">Critic maps the same state features to V(s).</div>
        </div>
      </aside>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-[360px] items-center justify-center rounded-xl border border-base-300 bg-base-200/60 text-sm text-base-content/60">
      Loading PPO training metrics...
    </div>
  );
}

export default function TimeVariantVisualizations() {
  const [mode, setMode] = useState<ViewMode>(null);
  const approxKl = useMetricSeries("/data/approx_kl.csv");
  const clipfrac = useMetricSeries("/data/clipfrac.csv");
  const valueLoss = useMetricSeries("/data/value_loss.csv");
  const explainedVariance = useMetricSeries("/data/explained_variance.csv");

  const isLoading = approxKl.isLoading || clipfrac.isLoading || valueLoss.isLoading || explainedVariance.isLoading;
  const error = approxKl.error ?? clipfrac.error ?? valueLoss.error ?? explainedVariance.error;
  const points = useMemo(
    () => buildTrainingPoints(approxKl.data, clipfrac.data, valueLoss.data, explainedVariance.data),
    [approxKl.data, clipfrac.data, explainedVariance.data, valueLoss.data],
  );

  const title =
    mode === "spiral"
      ? "PPO Training State Spiral"
      : mode === "transition"
        ? "PPO State Transition Graph"
        : "Actor-Critic Network Structure";
  const subtitle =
    mode === "spiral"
      ? "Each update is encoded as a four-metric temporal glyph."
      : mode === "transition"
        ? "Consecutive updates are grouped into PPO training states and transitions."
        : "A layered NodeTrix view of the shared input, Actor branch, and Critic branch.";

  return (
    <>
      <div className="absolute left-1/2 top-0 z-30 flex -translate-x-1/2 -translate-y-12 items-center gap-2 rounded-full border border-base-300 bg-base-100/85 px-3 py-2 shadow-lg backdrop-blur">
        <button
          type="button"
          onClick={() => setMode("spiral")}
          className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-content transition hover:brightness-105"
        >
          Spiral
        </button>
        <button
          type="button"
          onClick={() => setMode("transition")}
          className="rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-content transition hover:brightness-105"
        >
          Transition
        </button>
        <button
          type="button"
          onClick={() => setMode("network")}
          className="rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-content transition hover:brightness-105"
        >
          Network
        </button>
      </div>

      <DiagnosticsModal open={mode !== null} title={title} subtitle={subtitle} onClose={() => setMode(null)}>
        {mode === "network" ? <ActorCriticNetworkView /> : null}
        {mode !== "network" && isLoading ? <LoadingState /> : null}
        {mode !== "network" && !isLoading && error ? (
          <div className="rounded-xl border border-error/30 bg-error/10 p-4 text-sm text-error">{error}</div>
        ) : null}
        {mode !== "network" && !isLoading && !error && points.length ? (
          mode === "spiral" ? (
            <SpiralGlyphView points={points} />
          ) : (
            <TransitionStateView points={points} />
          )
        ) : null}
      </DiagnosticsModal>
    </>
  );
}
