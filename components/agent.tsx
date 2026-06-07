"use client";

import { useEffect, useMemo, useState, type MouseEvent, type Ref } from "react";
import { scaleLinear } from "d3-scale";

import ActorFormulaExplorer from "@/components/agent/ActorFormulaExplorer";
import DiagnosticsModal from "@/components/metrics/DiagnosticsModal";
import MetricMiniChart from "@/components/metrics/MetricMiniChart";
import { useMetricSeries } from "@/hooks/useMetricSeries";
import {
  getActorFormulaStage,
  type ActorFormulaRouteId,
  type ActorFormulaStageId,
  type ActorHighlightTargets,
} from "@/lib/actor-formula";
import {
  explainMetricValue,
  findClosestMetricPoint,
  formatMetricValue,
  summarizeCriticFit,
} from "@/lib/metrics";

type LayerId =
  | "obs"
  | "actor_fc1"
  | "actor_fc2"
  | "actor_logits"
  | "critic_fc1"
  | "critic_fc2"
  | "critic_value";

type LaneId = "shared" | "actor" | "critic";

type Layer = {
  id: LayerId;
  lane: LaneId;
  label: string;
  dim: number;
  x: number;
};

type Segment = {
  layerId: LayerId;
  segIndex: number;
  label: string;
  size: number;
  lane: LaneId;
};

type RibbonLink = {
  source: Segment;
  target: Segment;
  value: number;
  kind: "shared" | "actor" | "critic";
};

type AgentProps = {
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  anchorRef?: Ref<HTMLElement>;
  criticOutputAnchorRef?: Ref<SVGRectElement>;
};

const COLORS = "var(--color-primary)";
const OBS_DIM = 16;
const HIDDEN_DIM = 64;
const ACTION_DIM = 4;
const HIDDEN_GROUPS = 16;
const COLUMN_WIDTH = 26;

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function buildSegments(layer: Layer): Segment[] {
  if (layer.id === "obs") {
    return Array.from({ length: layer.dim }, (_, i) => ({
      layerId: layer.id,
      segIndex: i,
      label: `s[${i}]`,
      size: 1,
      lane: layer.lane,
    }));
  }

  if (layer.dim === HIDDEN_DIM) {
    const groups = HIDDEN_GROUPS;
    const groupSize = Math.floor(layer.dim / groups);
    return Array.from({ length: groups }, (_, g) => ({
      layerId: layer.id,
      segIndex: g,
      label: `g${g} (${groupSize} dims)`,
      size: groupSize,
      lane: layer.lane,
    }));
  }

  return Array.from({ length: layer.dim }, (_, i) => ({
    layerId: layer.id,
    segIndex: i,
    label: `${layer.label}[${i}]`,
    size: 1,
    lane: layer.lane,
  }));
}

function ribbonPath(opts: {
  x0: number;
  x1: number;
  y0a: number;
  y0b: number;
  y1a: number;
  y1b: number;
  curvature?: number;
}) {
  const { x0, x1, y0a, y0b, y1a, y1b } = opts;
  const c = clamp(opts.curvature ?? 0.55, 0, 0.95);
  const dx = x1 - x0;
  const cx0 = x0 + dx * c;
  const cx1 = x1 - dx * c;

  return [
    `M ${x0} ${y0a}`,
    `C ${cx0} ${y0a}, ${cx1} ${y1a}, ${x1} ${y1a}`,
    `L ${x1} ${y1b}`,
    `C ${cx1} ${y1b}, ${cx0} ${y0b}, ${x0} ${y0b}`,
    "Z",
  ].join(" ");
}

function badgeWidth(label: string) {
  return clamp(label.length * 9 + 30, 86, 170);
}

function setRefValue<T>(ref: Ref<T> | undefined, value: T | null) {
  if (!ref) {
    return;
  }

  if (typeof ref === "function") {
    ref(value);
    return;
  }

  ref.current = value;
}

export default function Agent({ expanded, onExpandedChange, anchorRef, criticOutputAnchorRef }: AgentProps) {
  const [dims, setDims] = useState({ width: 1100, height: 640 });
  const [hoverText, setHoverText] = useState<string | null>(null);
  const [selectedDiagnostics, setSelectedDiagnostics] = useState<"critic" | null>(null);
  const [hoverState, setHoverState] = useState<{ metricId: string; step: number } | null>(null);
  const [selectedActorStage, setSelectedActorStage] = useState<ActorFormulaStageId | null>(null);
  const [hoveredActorTargets, setHoveredActorTargets] = useState<ActorHighlightTargets | null>(null);

  const layerHeights = useMemo(
    () => ({
      actor_logits: 100,
      critic_value: 74,
    }),
    [],
  );
  const valueLoss = useMetricSeries("/data/value_loss.csv");
  const explainedVariance = useMetricSeries("/data/explained_variance.csv");

  useEffect(() => {
    const update = () => {
      setDims({
        width: Math.max(720, window.innerWidth - 32),
        height: Math.max(560, window.innerHeight - 140),
      });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    if (!expanded) {
      setSelectedDiagnostics(null);
      setHoverState(null);
      setHoverText(null);
      setSelectedActorStage(null);
      setHoveredActorTargets(null);
    }
  }, [expanded]);

  const expandedWidth = Math.min(dims.width, 804);
  const expandedHeight = 408;
  const padding = { left: 28, right: 28, top: 16, bottom: 16 };
  const titleY = 26;
  const actorBandY = 46;
  const actorBandHeight = 44;
  const plotTop = 98;
  const plotHeight = 208;
  const plotBottom = plotTop + plotHeight;
  const criticBandY = 318;
  const criticBandHeight = 44;
  const descriptionY = 354;

  const plotCenterX = (expandedWidth - padding.left - padding.right) / 2 + padding.left - 94;
  const plotCenterY = plotTop + plotHeight / 2;

  const geometry = useMemo(() => {
    const obsX = plotCenterX - 232;
    const fc1X = plotCenterX - 18;
    const fc2X = plotCenterX + 186;
    const outX = plotCenterX + 394;

    const actorCenterY = plotCenterY - 62;
    const criticCenterY = plotCenterY + 62;
    const sharedCenterY = plotCenterY;

    return {
      x: { obs: obsX, fc1: fc1X, fc2: fc2X, out: outX },
      y: { shared: sharedCenterY, actor: actorCenterY, critic: criticCenterY },
    };
  }, [plotCenterX, plotCenterY]);

  const { layers, segmentsByLayer, links } = useMemo(() => {
    const builtLayers: Layer[] = [
      { id: "obs", lane: "shared", label: "????", dim: OBS_DIM, x: geometry.x.obs },
      { id: "actor_fc1", lane: "actor", label: "Actor fc1", dim: HIDDEN_DIM, x: geometry.x.fc1 },
      { id: "actor_fc2", lane: "actor", label: "Actor fc2", dim: HIDDEN_DIM, x: geometry.x.fc2 },
      { id: "actor_logits", lane: "actor", label: "logits", dim: ACTION_DIM, x: geometry.x.out },
      { id: "critic_fc1", lane: "critic", label: "Critic fc1", dim: HIDDEN_DIM, x: geometry.x.fc1 },
      { id: "critic_fc2", lane: "critic", label: "Critic fc2", dim: HIDDEN_DIM, x: geometry.x.fc2 },
      { id: "critic_value", lane: "critic", label: "???? V(s)", dim: 1, x: geometry.x.out },
    ];

    const segs = new Map<LayerId, Segment[]>();
    builtLayers.forEach((layer) => segs.set(layer.id, buildSegments(layer)));

    const builtLinks: RibbonLink[] = [];
    const obsSegs = segs.get("obs")!;
    const actorFc1 = segs.get("actor_fc1")!;
    const criticFc1 = segs.get("critic_fc1")!;

    obsSegs.forEach((segment) => {
      const groupIndex = segment.segIndex % actorFc1.length;
      builtLinks.push({ source: segment, target: actorFc1[groupIndex], value: 1, kind: "shared" });
      builtLinks.push({ source: segment, target: criticFc1[groupIndex], value: 1, kind: "shared" });
    });

    const actorFc2 = segs.get("actor_fc2")!;
    actorFc1.forEach((segment) => {
      builtLinks.push({ source: segment, target: actorFc2[segment.segIndex], value: segment.size, kind: "actor" });
    });

    const criticFc2 = segs.get("critic_fc2")!;
    criticFc1.forEach((segment) => {
      builtLinks.push({ source: segment, target: criticFc2[segment.segIndex], value: segment.size, kind: "critic" });
    });

    const logits = segs.get("actor_logits")!;
    actorFc2.forEach((segment) => {
      const actionIndex = segment.segIndex % logits.length;
      builtLinks.push({ source: segment, target: logits[actionIndex], value: segment.size, kind: "actor" });
    });

    const criticValue = segs.get("critic_value")![0];
    criticFc2.forEach((segment) => {
      builtLinks.push({ source: segment, target: criticValue, value: segment.size, kind: "critic" });
    });

    return { layers: builtLayers, segmentsByLayer: segs, links: builtLinks };
  }, [geometry]);

  const laneLayout = useMemo(() => {
    const sharedHeight = 40;
    const actorHeight = 122;
    const criticHeight = 122;

    return {
      shared: {
        y0: geometry.y.shared - sharedHeight / 2,
        y1: geometry.y.shared + sharedHeight / 2,
      },
      actor: {
        y0: geometry.y.actor - actorHeight / 2,
        y1: geometry.y.actor + actorHeight / 2,
      },
      critic: {
        y0: geometry.y.critic - criticHeight / 2,
        y1: geometry.y.critic + criticHeight / 2,
      },
    } as const;
  }, [geometry]);

  const layerLayout = useMemo(() => {
    const layouts = new Map<LayerId, { y0: number; y1: number }>();

    layers.forEach((layer) => {
      const lane = laneLayout[layer.lane];
      const laneHeight = lane.y1 - lane.y0;

      if (layer.id === "obs") {
        const obsHeight = 28;
        const y0 = geometry.y.shared - obsHeight / 2;
        layouts.set(layer.id, { y0, y1: y0 + obsHeight });
        return;
      }

      const defaultHeight = Math.max(laneHeight - 12, 24);
      const targetHeight = Math.min(
        laneHeight - 8,
        layerHeights[layer.id as keyof typeof layerHeights] ?? defaultHeight,
      );
      const y0 = lane.y0 + (laneHeight - targetHeight) / 2;
      layouts.set(layer.id, { y0, y1: y0 + targetHeight });
    });

    return layouts;
  }, [geometry, laneLayout, layerHeights, layers]);

  function handleExpandedShellClick(event: MouseEvent<HTMLDivElement>) {
    if (actorExplorerOpen || diagnosticsOpen) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element)) {
      onExpandedChange(false);
      return;
    }

    if (target.closest('[data-agent-interactive="true"]')) {
      return;
    }

    onExpandedChange(false);
  }

  const segmentPositions = useMemo(() => {
    const positions = new Map<string, { y0: number; y1: number }>();

    layers.forEach((layer) => {
      const segs = segmentsByLayer.get(layer.id) ?? [];
      const layout = layerLayout.get(layer.id);
      if (!layout) return;

      const totalSize = segs.reduce((sum, segment) => sum + segment.size, 0);
      const yScale = scaleLinear().domain([0, totalSize]).range([layout.y0, layout.y1]);

      let cursor = 0;
      segs.forEach((segment) => {
        const y0 = yScale(cursor);
        cursor += segment.size;
        const y1 = yScale(cursor);
        positions.set(`${segment.layerId}:${segment.segIndex}`, { y0, y1 });
      });
    });

    return positions;
  }, [layers, segmentsByLayer, layerLayout]);

  const selectedStep = hoverState?.step ?? null;
  const activeValueLossPoint = findClosestMetricPoint(
    valueLoss.data,
    selectedStep ?? valueLoss.data[valueLoss.data.length - 1]?.step ?? null,
  );
  const activeExplainedVariancePoint = findClosestMetricPoint(
    explainedVariance.data,
    selectedStep ?? explainedVariance.data[explainedVariance.data.length - 1]?.step ?? null,
  );
  const criticSummary = summarizeCriticFit(activeValueLossPoint, activeExplainedVariancePoint);
  const diagnosticsOpen = selectedDiagnostics === "critic";
  const actorExplorerOpen = selectedActorStage !== null;
  const activeActorStage = selectedActorStage ? getActorFormulaStage(selectedActorStage) : null;
  const actorFocusTargets = hoveredActorTargets ?? activeActorStage?.highlightTargets ?? null;
  const criticFocused = !diagnosticsOpen && hoverState !== null;
  const diagnosticsLoading = valueLoss.isLoading || explainedVariance.isLoading;
  const diagnosticsError = valueLoss.error ?? explainedVariance.error;
  const summaryToneClass =
    criticSummary.tone === "stable"
      ? "bg-success/15 text-success"
      : criticSummary.tone === "watch"
        ? "bg-warning/15 text-warning"
        : "bg-error/15 text-error";

  function openCriticDiagnostics() {
    setSelectedActorStage(null);
    setHoveredActorTargets(null);
    setHoverText(null);
    setHoverState(null);
    setSelectedDiagnostics("critic");
  }

  function closeCriticDiagnostics() {
    setSelectedDiagnostics(null);
    setHoverState(null);
    setHoverText(null);
  }

  function closeActorExplorer() {
    setSelectedActorStage(null);
    setHoveredActorTargets(null);
  }

  function openActorExplorer(stageId: ActorFormulaStageId) {
    setSelectedDiagnostics(null);
    setHoverState(null);
    setHoverText(null);
    setHoveredActorTargets(null);
    setSelectedActorStage(stageId);
  }

  function actorStageFromLayer(layerId: LayerId): ActorFormulaStageId | null {
    switch (layerId) {
      case "obs":
        return "obs";
      case "actor_fc1":
        return "fc1_linear";
      case "actor_fc2":
        return "fc2_linear";
      case "actor_logits":
        return "logits";
      default:
        return null;
    }
  }

  function actorStageFromRoute(routeId: ActorFormulaRouteId): ActorFormulaStageId {
    switch (routeId) {
      case "shared_actor":
        return "fc1_linear";
      case "actor_fc1_fc2":
        return "fc2_linear";
      case "actor_fc2_logits":
        return "logits";
    }
  }

  function isActorLayerHighlighted(layerId: LayerId) {
    return actorFocusTargets?.layers?.includes(layerId as never) ?? false;
  }

  function isActorRouteHighlighted(routeId: ActorFormulaRouteId) {
    return actorFocusTargets?.routes?.includes(routeId) ?? false;
  }

  const actorLabels = [
    { key: "actor_fc1", label: "Actor fc1", x: geometry.x.fc1 - 36, width: 138 },
    { key: "actor_fc2", label: "Actor fc2", x: geometry.x.fc2 - 42, width: 144 },
  ] as const;

  const criticLabels = [
    { key: "critic_fc1", label: "Critic fc1", x: geometry.x.fc1 - 36, width: 148 },
    { key: "critic_fc2", label: "Critic fc2", x: geometry.x.fc2 - 40, width: 148 },
    { key: "critic_value", label: "???? V(s)", x: geometry.x.out - 56, width: 138 },
  ] as const;

  const logitsLabel = {
    x: geometry.x.out - 22,
    y: actorBandY,
    width: badgeWidth("logits"),
  };

  const hoverBox = {
    x: padding.left + 2,
    y: criticBandY - 10,
    width: 220,
    height: 56,
  };

  const networkMarkup = (
    <div className="card border border-base-300 bg-glass shadow-xl">
      <div className="card-body relative p-3 sm:p-4">
        <svg width={expandedWidth} height={expandedHeight} style={{ display: "block" }}>
          <text x={padding.left - 4} y={titleY + 4} className="fill-primary text-sm font-semibold">
            Agent
          </text>

          <g>
            {actorLabels.map((item) => (
              <foreignObject key={item.key} x={item.x} y={actorBandY} width={item.width} height={actorBandHeight}>
                <button
                  type="button"
                  data-agent-interactive="true"
                  onClick={() => openActorExplorer(item.key === "actor_fc1" ? "fc1_linear" : "fc2_linear")}
                  className={`badge badge-sm badge-outline flex h-10 w-full cursor-pointer items-center justify-center px-3 text-[11px] font-medium shadow-sm transition ${
                    actorExplorerOpen && isActorLayerHighlighted(item.key as LayerId)
                      ? "border-primary bg-primary/16 text-primary"
                      : "border-primary bg-base-100/95 text-base-content/85 hover:bg-primary/6"
                  }`}
                >
                  {item.label}
                </button>
              </foreignObject>
            ))}

            <foreignObject x={logitsLabel.x} y={logitsLabel.y} width={logitsLabel.width} height={40}>
              <button
                type="button"
                data-agent-interactive="true"
                onClick={() => openActorExplorer("logits")}
                className={`badge badge-sm badge-outline flex h-10 w-full cursor-pointer items-center justify-center px-3 text-[11px] font-medium shadow-sm transition ${
                  actorExplorerOpen && isActorLayerHighlighted("actor_logits")
                    ? "border-primary bg-primary/16 text-primary"
                    : "border-primary bg-base-100/95 text-base-content/85 hover:bg-primary/6"
                }`}
              >
                logits
              </button>
            </foreignObject>
          </g>

          <g>
            {links.map((link, idx) => {
              const sourcePosition = segmentPositions.get(`${link.source.layerId}:${link.source.segIndex}`);
              const targetPosition = segmentPositions.get(`${link.target.layerId}:${link.target.segIndex}`);
              if (!sourcePosition || !targetPosition) return null;

              const sourceX = layers.find((layer) => layer.id === link.source.layerId)!.x;
              const targetX = layers.find((layer) => layer.id === link.target.layerId)!.x;

              const path = ribbonPath({
                x0: sourceX + COLUMN_WIDTH,
                x1: targetX - 10,
                y0a: sourcePosition.y0,
                y0b: sourcePosition.y1,
                y1a: targetPosition.y0,
                y1b: targetPosition.y1,
                curvature: 0.52,
              });

              const minX = Math.min(...layers.map((layer) => layer.x));
              const maxX = Math.max(...layers.map((layer) => layer.x));
              const normProgress = (sourceX - minX) / Math.max(1, maxX - minX);
              const fadedOpacity = 1 - normProgress * 0.35;
              const linkActive = link.kind === "critic" && criticFocused;
              const linkMuted = criticFocused && link.kind !== "critic";
              const tip = `${link.source.layerId}:${link.source.label} -> ${link.target.layerId}:${link.target.label}`;
              const actorRouteId =
                link.kind === "shared" && link.target.layerId === "actor_fc1"
                  ? "shared_actor"
                  : link.kind === "actor" && link.source.layerId === "actor_fc1" && link.target.layerId === "actor_fc2"
                    ? "actor_fc1_fc2"
                    : link.kind === "actor" && link.target.layerId === "actor_logits"
                      ? "actor_fc2_logits"
                      : null;
              const actorRouteFocused = actorRouteId ? isActorRouteHighlighted(actorRouteId) : false;
              const actorLinkMuted =
                actorExplorerOpen &&
                (link.kind === "critic" ||
                  (actorRouteId !== null &&
                    !actorRouteFocused &&
                    (link.kind === "actor" || (link.kind === "shared" && link.target.layerId === "actor_fc1"))));

              return (
                <path
                  key={idx}
                  data-agent-interactive={actorRouteId || link.kind === "critic" ? "true" : undefined}
                  d={path}
                  fill={COLORS}
                  stroke="transparent"
                  opacity={
                    linkMuted
                      ? 0.08
                      : actorRouteFocused
                        ? 0.42
                        : actorLinkMuted
                          ? 0.08
                          : linkActive
                            ? 0.34
                            : fadedOpacity * 0.22
                  }
                  onMouseEnter={() => setHoverText(tip)}
                  onMouseLeave={() => setHoverText(null)}
                  onClick={
                    actorRouteId
                      ? () => openActorExplorer(actorStageFromRoute(actorRouteId))
                      : link.kind === "critic"
                        ? openCriticDiagnostics
                        : undefined
                  }
                  style={actorRouteId || link.kind === "critic" ? { cursor: "pointer" } : undefined}
                />
              );
            })}
          </g>

          <g>
            <foreignObject x={geometry.x.obs - 28} y={geometry.y.shared - 74} width={122} height={44}>
              <button
                type="button"
                data-agent-interactive="true"
                onClick={() => openActorExplorer("obs")}
                className={`badge badge-sm badge-outline flex h-10 w-full cursor-pointer items-center justify-center px-3 text-[11px] font-medium shadow-sm transition ${
                  actorExplorerOpen && isActorLayerHighlighted("obs")
                    ? "border-primary bg-primary/16 text-primary"
                    : "border-primary bg-base-100/95 text-base-content/85 hover:bg-primary/6"
                }`}
              >
                输入观测
              </button>
            </foreignObject>

            {layers.map((layer) => {
              const segs = segmentsByLayer.get(layer.id) ?? [];
              const x0 = layer.x;
              const layout = layerLayout.get(layer.id);
              if (!layout) return null;

              const minX = Math.min(...layers.map((currentLayer) => currentLayer.x));
              const maxX = Math.max(...layers.map((currentLayer) => currentLayer.x));
              const normProgress = (x0 - minX) / Math.max(1, maxX - minX);
              const fadedOpacity = 1 - normProgress * 0.3;
              const layerFocused = layer.lane === "critic" && criticFocused;
              const layerMuted = criticFocused && layer.lane !== "critic";
              const actorLayerFocused = isActorLayerHighlighted(layer.id);
              const actorLayerMuted = actorExplorerOpen && layer.lane === "actor" && !actorLayerFocused;
              const sharedLayerMuted = actorExplorerOpen && layer.id === "obs" && !actorLayerFocused;
              const criticLayerMuted = actorExplorerOpen && layer.lane === "critic";

              return (
                <g key={layer.id}>
                  <rect
                    ref={layer.id === "critic_value" ? criticOutputAnchorRef : undefined}
                    x={x0}
                    y={layout.y0}
                    width={COLUMN_WIDTH}
                    height={layout.y1 - layout.y0}
                    fill="var(--color-base-200)"
                    stroke={COLORS}
                    rx={6}
                    opacity={
                      layerMuted
                        ? 0.24
                        : actorLayerFocused
                          ? 1
                          : actorLayerMuted || sharedLayerMuted || criticLayerMuted
                            ? 0.28
                            : layerFocused
                              ? 1
                              : fadedOpacity
                    }
                    strokeWidth={actorLayerFocused || layerFocused ? 2.2 : 1}
                  />

                  {segs.map((segment) => {
                    const position = segmentPositions.get(`${segment.layerId}:${segment.segIndex}`);
                    if (!position) return null;
                    const actorStage = actorStageFromLayer(layer.id);
                    return (
                      <rect
                        key={`${segment.layerId}:${segment.segIndex}`}
                        data-agent-interactive={actorStage || layer.lane === "critic" ? "true" : undefined}
                        x={x0}
                        y={position.y0}
                        width={COLUMN_WIDTH}
                        height={Math.max(1, position.y1 - position.y0)}
                        fill={COLORS}
                        opacity={
                          layerMuted
                            ? 0.25
                            : actorLayerFocused
                              ? 1
                              : actorLayerMuted || sharedLayerMuted || criticLayerMuted
                                ? 0.24
                                : layerFocused
                                  ? 1
                                  : fadedOpacity
                        }
                        onMouseEnter={() => setHoverText(`${layer.label} layer ${segment.label}`)}
                        onMouseLeave={() => setHoverText(null)}
                        onClick={
                          actorStage
                            ? () => openActorExplorer(actorStage)
                            : layer.lane === "critic"
                              ? openCriticDiagnostics
                              : undefined
                        }
                        style={actorStage || layer.lane === "critic" ? { cursor: "pointer" } : undefined}
                      />
                    );
                  })}
                </g>
              );
            })}
          </g>

          <g>
            {criticLabels.map((item) => (
              <foreignObject key={item.key} x={item.x} y={criticBandY} width={item.width} height={criticBandHeight}>
                <div
                  data-agent-interactive={item.key === "critic_value" ? "true" : undefined}
                  className={`badge badge-sm badge-outline flex h-10 w-full items-center justify-center px-3 text-[11px] font-medium shadow-sm ${
                    item.key === "critic_value"
                      ? "cursor-pointer border-primary bg-base-100/95 text-base-content/90"
                      : "border-primary bg-base-100/95 text-base-content/85"
                  }`}
                  onClick={item.key === "critic_value" ? openCriticDiagnostics : undefined}
                >
                  {item.label}
                </div>
              </foreignObject>
            ))}
          </g>

          {!actorExplorerOpen && !diagnosticsOpen ? (
            <foreignObject x={hoverBox.x} y={hoverBox.y} width={hoverBox.width} height={hoverBox.height}>
              <div
                className={`rounded-2xl bg-primary/10 px-3 py-2 text-[11px] leading-snug text-primary transition-opacity ${
                  hoverText ? "opacity-100" : "opacity-0"
                }`}
              >
                <span className="line-clamp-2">{hoverText ?? " "}</span>
              </div>
            </foreignObject>
          ) : null}

          <foreignObject x={padding.left} y={descriptionY} width={expandedWidth - padding.left - padding.right} height={40}>
            <div className="text-[11px] leading-relaxed text-base-content/70 sm:text-xs">
              ???? s ?????????16 ????????? actor ? critic ??????? 64 ???? actor ?? 4 ? logits???????critic ?? 1 ????? V(s)?
            </div>
          </foreignObject>
        </svg>

        <ActorFormulaExplorer
          open={actorExplorerOpen}
          stageId={selectedActorStage ?? "obs"}
          onStageChange={setSelectedActorStage}
          onClose={closeActorExplorer}
          onTileHover={setHoveredActorTargets}
        />
      </div>
    </div>
  );

  if (!expanded) {
    return (
      <button
        type="button"
        ref={(node) => setRefValue(anchorRef, node)}
        aria-expanded={false}
        onClick={() => onExpandedChange(true)}
        className="border-none bg-transparent p-0 text-left"
        style={{
          cursor: "pointer",
          display: "inline-block",
          transition: "transform 180ms ease, width 200ms ease, height 200ms ease",
          transform: "scale(1)",
          width: "200px",
          height: "300px",
          overflow: "hidden",
        }}
      >
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-primary bg-primary/10 px-3 py-3 shadow-sm">
          <span className="text-sm font-semibold text-primary">Agent</span>
          <div className="flex items-center gap-2 rounded-xl border border-primary/50 bg-primary/30 px-15 py-8 ring-1 ring-primary/10">
            <span className="h-2 w-2 rounded-full bg-primary shadow-sm" />
            <span className="text-s font-semibold tracking-wide text-primary">actor</span>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-primary/50 bg-primary/30 px-15 py-8 ring-1 ring-primary/10">
            <span className="h-2 w-2 rounded-full bg-primary shadow-sm" />
            <span className="text-s font-semibold tracking-wide text-primary">critic</span>
          </div>
        </div>
      </button>
    );
  }

  return (
    <>
      <div
        ref={(node) => setRefValue(anchorRef, node)}
        aria-expanded
        onClick={handleExpandedShellClick}
        className="rounded-2xl border border-primary/40 bg-primary/10 shadow-xl"
        style={{
          transition: "transform 180ms ease, width 200ms ease, height 200ms ease",
          transform: "scale(1.02)",
          width: `${expandedWidth}px`,
          height: `${expandedHeight}px`,
          overflow: "visible",
        }}
      >
        {networkMarkup}
      </div>

      <DiagnosticsModal
        open={diagnosticsOpen}
        onClose={closeCriticDiagnostics}
        title="Critic diagnostics"
        subtitle={hoverState ? `Step ${hoverState.step}` : "Hover the curves to inspect the critic branch."}
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1 text-xs text-base-content/70">
              <div>
                <span className="font-semibold text-primary">value_loss:</span>{" "}
                {activeValueLossPoint ? formatMetricValue("value_loss", activeValueLossPoint.value) : "--"}
              </div>
              <div>
                <span className="font-semibold text-info">explained_variance:</span>{" "}
                {activeExplainedVariancePoint
                  ? formatMetricValue("explained_variance", activeExplainedVariancePoint.value)
                  : "--"}
              </div>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${summaryToneClass}`}>
              {criticSummary.label}
            </span>
          </div>

          {diagnosticsLoading ? (
            <div className="rounded-xl border border-dashed border-primary/25 bg-primary/5 px-4 py-8 text-sm text-base-content/65">
              Loading critic diagnostics...
            </div>
          ) : diagnosticsError ? (
            <div className="rounded-xl border border-dashed border-error/25 bg-error/5 px-4 py-8 text-sm text-error">
              Failed to load critic diagnostics: {diagnosticsError}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3">
                <MetricMiniChart
                  metricId="value_loss"
                  title="value_loss"
                  color="var(--color-primary)"
                  data={valueLoss.data}
                  hoverState={hoverState}
                  onHoverChange={setHoverState}
                  valueFormatter={(value) => formatMetricValue("value_loss", value)}
                  isEmphasized={hoverState?.metricId === "value_loss"}
                />
                <MetricMiniChart
                  metricId="explained_variance"
                  title="explained_variance"
                  color="var(--color-info)"
                  data={explainedVariance.data}
                  hoverState={hoverState}
                  onHoverChange={setHoverState}
                  valueFormatter={(value) => formatMetricValue("explained_variance", value)}
                  referenceValue={0.3}
                  referenceLabel="healthy fit"
                  isEmphasized={hoverState?.metricId === "explained_variance"}
                />
              </div>

              <div className="rounded-xl border border-primary/15 bg-primary/8 px-4 py-3 text-sm text-base-content/75">
                {hoverState?.metricId === "explained_variance" && activeExplainedVariancePoint
                  ? explainMetricValue("explained_variance", activeExplainedVariancePoint.value)
                  : hoverState?.metricId === "value_loss" && activeValueLossPoint
                    ? explainMetricValue("value_loss", activeValueLossPoint.value)
                    : "?????? critic ???????explained_variance ???? 0?value_loss ?????????"}
              </div>
            </div>
          )}
        </div>
      </DiagnosticsModal>
    </>
  );
}
