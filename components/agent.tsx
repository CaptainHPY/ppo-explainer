"use client";

import React, { useEffect, useMemo, useState } from "react";
import { scaleLinear } from "d3-scale";

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
};

const COLORS = "var(--color-primary)"

const OBS_DIM = 16;
const HIDDEN_DIM = 64;
const ACTION_DIM = 4;
const HIDDEN_GROUPS = 16;

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
      label: `g${g}（${groupSize}维）`,
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

export default function Agent({ expanded, onExpandedChange }: AgentProps) {
  const [dims, setDims] = useState({ width: 1100, height: 640 });
  const [hoverText, setHoverText] = useState<string | null>(null);
  const layerHeights = useMemo(
    () => ({
      actor_logits: 110,
      critic_value: 72,
    }),
    [],
  );
  const obsYOffset = 300;

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

  const { layers, segmentsByLayer, links } = useMemo(() => {
    const x = {
      obs: 70,
      fc1: 260,
      fc2: 470,
      out: 690,
    } as const;

    const builtLayers: Layer[] = [
      { id: "obs", lane: "shared", label: "观测 s", dim: OBS_DIM, x: x.obs },
      { id: "actor_fc1", lane: "actor", label: "Actor fc1", dim: HIDDEN_DIM, x: x.fc1 },
      { id: "actor_fc2", lane: "actor", label: "Actor fc2", dim: HIDDEN_DIM, x: x.fc2 },
      { id: "actor_logits", lane: "actor", label: "logits", dim: ACTION_DIM, x: x.out },
      { id: "critic_fc1", lane: "critic", label: "Critic fc1", dim: HIDDEN_DIM, x: x.fc1 },
      { id: "critic_fc2", lane: "critic", label: "Critic fc2", dim: HIDDEN_DIM, x: x.fc2 },
      { id: "critic_value", lane: "critic", label: "状态价值 V(s)", dim: 1, x: x.out },
    ];

    const segs = new Map<LayerId, Segment[]>();
    builtLayers.forEach((l) => segs.set(l.id, buildSegments(l)));

    const builtLinks: RibbonLink[] = [];

    const obsSegs = segs.get("obs")!;
    const a1 = segs.get("actor_fc1")!;
    const c1 = segs.get("critic_fc1")!;
    obsSegs.forEach((os) => {
      const g = os.segIndex % a1.length;
      builtLinks.push({ source: os, target: a1[g], value: 1, kind: "shared" });
      builtLinks.push({ source: os, target: c1[g], value: 1, kind: "shared" });
    });

    const a2 = segs.get("actor_fc2")!;
    a1.forEach((s) => {
      builtLinks.push({ source: s, target: a2[s.segIndex], value: s.size, kind: "actor" });
    });

    const c2 = segs.get("critic_fc2")!;
    c1.forEach((s) => {
      builtLinks.push({ source: s, target: c2[s.segIndex], value: s.size, kind: "critic" });
    });

    const logits = segs.get("actor_logits")!;
    a2.forEach((s) => {
      const actionIdx = s.segIndex % logits.length;
      builtLinks.push({ source: s, target: logits[actionIdx], value: s.size, kind: "actor" });
    });

    const value = segs.get("critic_value")![0];
    c2.forEach((s) => {
      builtLinks.push({ source: s, target: value, value: s.size, kind: "critic" });
    });

    return { layers: builtLayers, segmentsByLayer: segs, links: builtLinks };
  }, []);

  const margin = { top: 40, left: -60, right: 0, bottom: 150 };
  const width = dims.width;
  const height = dims.height;
  const innerH = height - margin.top - margin.bottom;
  const expandedWidth = Math.min(width, 730);
  const expandedHeight = Math.min(height, 630);
  const networkShiftY = -100;

  const laneLayout = useMemo(() => {
    const sharedH = Math.max(70, innerH * 0.18);
    const actorH = Math.max(180, innerH * 0.41);
    const criticH = Math.max(180, innerH * 0.41);
    const total = sharedH + actorH + criticH;
    const scale = innerH / total;
    const sH = sharedH * scale;
    const aH = actorH * scale;
    const cH = criticH * scale;
    return {
      shared: { y0: margin.top, y1: margin.top + sH },
      actor: { y0: margin.top + sH, y1: margin.top + sH + aH },
      critic: { y0: margin.top + sH + aH, y1: margin.top + sH + aH + cH },
    } as const;
  }, [innerH, margin.top]);

  const layerLayout = useMemo(() => {
    const layouts = new Map<LayerId, { y0: number; y1: number }>();

    layers.forEach((layer) => {
      const lane = laneLayout[layer.lane];
      const availableH = lane.y1 - lane.y0;
      const defaultH = Math.max(availableH - 36, 24);
      const targetH = Math.min(availableH - 20, layerHeights[layer.id as keyof typeof layerHeights] ?? defaultH);
      const baseY0 = lane.y0 + (availableH - targetH) / 2;
      const y0 = layer.id === "obs" ? baseY0 + obsYOffset : baseY0;
      const y1 = y0 + targetH;
      layouts.set(layer.id, { y0, y1 });
    });

    return layouts;
  }, [layers, laneLayout, layerHeights, obsYOffset]);

  const segmentPositions = useMemo(() => {
    const pos = new Map<string, { y0: number; y1: number }>();

    layers.forEach((layer) => {
      const segs = segmentsByLayer.get(layer.id) ?? [];
      const layout = layerLayout.get(layer.id);
      if (!layout) return;
      const yTop = layout.y0;
      const yBot = layout.y1;

      const totalSize = segs.reduce((acc, s) => acc + s.size, 0);
      const yScale = scaleLinear().domain([0, totalSize]).range([yTop, yBot]);

      let cursor = 0;
      segs.forEach((s) => {
        const y0 = yScale(cursor);
        cursor += s.size;
        const y1 = yScale(cursor);
        pos.set(`${s.layerId}:${s.segIndex}`, { y0, y1 });
      });
    });

    return pos;
  }, [layers, segmentsByLayer, layerLayout]);

  const networkMarkup = (
    <div className="card border border-base-300 bg-glass shadow-xl">
      <div className="card-body p-3 sm:p-4">
        <h3 className="text-sm font-semibold text-primary">Agent</h3>
        <svg className="-mt-6" width={expandedWidth} height={expandedHeight} style={{ display: "block" }} transform={`translate(0 ${networkShiftY})`}>
          <g>
            {links.map((lk, idx) => {
              const sp = segmentPositions.get(`${lk.source.layerId}:${lk.source.segIndex}`);
              const tp = segmentPositions.get(`${lk.target.layerId}:${lk.target.segIndex}`);
              if (!sp || !tp) return null;

              const sx0 = margin.left + layers.find((l) => l.id === lk.source.layerId)!.x;
              const tx0 = margin.left + layers.find((l) => l.id === lk.target.layerId)!.x;

              const path = ribbonPath({
                x0: sx0 + 26,
                x1: tx0 - 8,
                y0a: sp.y0,
                y0b: sp.y1,
                y1a: tp.y0,
                y1b: tp.y1,
              });

              // 计算归一化位置用于衰减
              const minX = margin.left + Math.min(...layers.map(l => l.x));
              const maxX = margin.left + Math.max(...layers.map(l => l.x));
              const normProgress = (sx0 - minX) / Math.max(1, (maxX - minX));

              // 衰减参数
              const fadeStrength = 0.4; // 末端透明度比起始低 60%
              const baseOpacity = 1; // 起始不透明度
              const fadedOpacity = baseOpacity * (1 - normProgress * fadeStrength);

              // 统一使用同一色
              const fill = COLORS;

              const tip = `${lk.source.layerId}:${lk.source.label} → ${lk.target.layerId}:${lk.target.label}`;

              return (
                <path
                  key={idx}
                  d={path}
                  fill={fill}
                  stroke="transparent"
                  opacity={fadedOpacity * 0.22}
                  onMouseEnter={() => setHoverText(tip)}
                  onMouseLeave={() => setHoverText(null)}
                />
              );
            })}
          </g>

          <g>
            {layers.map((layer) => {
              const segs = segmentsByLayer.get(layer.id) ?? [];
              const lane = laneLayout[layer.lane];
              const x0 = margin.left + layer.x;
              const colW = 26;
              const layout = layerLayout.get(layer.id);
              if (!layout) return null;

              // 计算归一化位置用于衰减
              const minX = margin.left + Math.min(...layers.map(l => l.x));
              const maxX = margin.left + Math.max(...layers.map(l => l.x));
              const normProgress = (x0 - minX) / Math.max(1, (maxX - minX));

              // 衰减参数（与 ribbon 保持一致）
              const fadeStrength = 0.3;
              const baseOpacity = 1;
              const fadedOpacity = baseOpacity * (1 - normProgress * fadeStrength);

              const titleY =
                layer.lane === "shared" ? layout.y0 - 6 : Math.max(layout.y0 - 6, lane.y0 + 14);
              
              return (
                <g key={layer.id}>
                  <foreignObject x={x0 - 55} y={Math.max(0, titleY - 22)} width={140} height={22}>
                    <div className="badge badge-sm badge-outline border-primary bg-base-100/90 px-2 text-[11px] font-medium text-base-content/80 shadow-sm">
                      {layer.label}
                    </div>
                  </foreignObject>
                  <rect
                    x={x0}
                    y={layout.y0}
                    width={colW}
                    height={layout.y1 - layout.y0}
                    fill="var(--color-base-200)"
                    stroke={COLORS}
                    rx={6}
                    opacity={fadedOpacity}
                  />

                  {segs.map((s) => {
                    const p = segmentPositions.get(`${s.layerId}:${s.segIndex}`);
                    if (!p) return null;
                    const y = p.y0;
                    const h = Math.max(1, p.y1 - p.y0);
                    return (
                      <rect
                        key={`${s.layerId}:${s.segIndex}`}
                        x={x0}
                        y={y}
                        width={colW}
                        height={h}
                        fill={COLORS}
                        opacity={fadedOpacity}
                        onMouseEnter={() => setHoverText(`${layer.label} · ${s.label}`)}
                        onMouseLeave={() => setHoverText(null)}
                      />
                    );
                  })}
                </g>
              );
            })}
          </g>
        </svg>
        <span className="-mt-20 block text-[11px] leading-relaxed text-base-content/70 sm:text-xs">
          输入观测 s 来自环境状态向量（16 维）；随后分别进入 actor 与 critic 分支，隐藏层为 64 维，最终 actor 输出 4 维 logits（对应动作），critic 输出 1 维状态价值 V(s)。
        </span>
      </div>
    </div>
  );

  return (
    <button
      aria-expanded={expanded}
      onClick={() => onExpandedChange(!expanded)}
      style={{
        border: "none",
        background: "transparent",
        padding: 0,
        cursor: "pointer",
        display: expanded ? "block" : "inline-block",
        transition: "transform 180ms ease, width 200ms ease, height 200ms ease",
        transform: expanded ? "scale(1.02)" : "scale(1)",
        width: expanded ? `${expandedWidth}px` : "200px",
        height: expanded ? `${expandedHeight}px` : "300px",
        overflow: "hidden",
      }}
    >
      {expanded ? (
        // Expanded: use primary background and primary text
        <div className="card border border-primary/40 bg-primary/10 shadow-xl">
          {networkMarkup}
        </div>
      ) : (
        // Collapsed: compact primary-themed block
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
      )}
    </button>
  );
}
