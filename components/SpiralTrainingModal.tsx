"use client";

import { useMemo, useState } from "react";

import DiagnosticsModal from "@/components/metrics/DiagnosticsModal";
import { useMetricSeries } from "@/hooks/useMetricSeries";
import type { MetricPoint } from "@/lib/metrics";

type TrainingState = "stable" | "policyBoost" | "clipActive" | "criticImproving" | "criticLagging";

type TrainingPoint = {
  index: number;
  step: number;
  approxKl: number;
  clipfrac: number;
  valueLoss: number;
  explainedVariance: number;
  state: TrainingState;
};

type SpiralTrainingModalProps = {
  open: boolean;
  onClose: () => void;
};

const stateLabels: Record<TrainingState, string> = {
  stable: "稳定更新",
  policyBoost: "策略提升",
  clipActive: "发生裁剪",
  criticImproving: "Critic 改善",
  criticLagging: "Critic 滞后",
};

const stateColors: Record<TrainingState, string> = {
  stable: "#45b7a8",
  policyBoost: "#4c78d8",
  clipActive: "#e85d75",
  criticImproving: "#7c60d4",
  criticLagging: "#f2a93b",
};

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function normalize(value: number, min: number, max: number) {
  if (max <= min) return 0;
  return clamp((value - min) / (max - min));
}

function metricExtent(points: TrainingPoint[], read: (point: TrainingPoint) => number) {
  const values = points.map(read);
  return { min: Math.min(...values), max: Math.max(...values) };
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
  if (point.approxKl >= 0.0015) return "policyBoost";
  if (point.explainedVariance >= 0.28 && point.valueLoss < 55) return "criticImproving";
  if (point.explainedVariance < 0.05 || point.valueLoss >= 65) return "criticLagging";
  return "stable";
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
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="rounded-xl border border-base-300 bg-base-200/60 p-3">
        <svg viewBox="0 0 720 570" className="h-[56vh] min-h-[420px] w-full" role="img">
          <title>螺旋训练状态图</title>
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
        <div className="text-sm font-semibold text-base-content">当前选中更新</div>
        <div className="mt-3 rounded-lg border border-base-300 bg-base-200/60 p-3">
          <div className="text-xs font-semibold text-base-content/55">状态</div>
          <div className="mt-1 text-sm font-semibold text-base-content">
            {activePoint ? stateLabels[activePoint.state] : "未选中"}
          </div>
          <div className="mt-2 text-xs leading-5 text-base-content/65">
            {activePoint
              ? `step ${activePoint.step} / KL ${activePoint.approxKl.toFixed(4)} / clip ${(
                  activePoint.clipfrac * 100
                ).toFixed(1)}% / value loss ${activePoint.valueLoss.toFixed(1)} / EV ${activePoint.explainedVariance.toFixed(3)}`
              : "将鼠标移动到螺旋节点上，可以查看某次 PPO 更新的详细状态。"}
          </div>
        </div>
        <p className="mt-4 text-xs leading-5 text-base-content/60">
          螺旋从中心向外编码时间。描边粗细表示 KL 变化，虚线环表示 clip 压力，节点大小表示 value
          loss，亮度表示 explained variance。
        </p>
        <div className="mt-4 grid gap-2">
          {(Object.keys(stateLabels) as TrainingState[]).map((state) => (
            <div key={state} className="flex items-center gap-2 text-xs text-base-content/70">
              <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: stateColors[state] }} />
              {stateLabels[state]}
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

export default function SpiralTrainingModal({ open, onClose }: SpiralTrainingModalProps) {
  const approxKl = useMetricSeries("/data/approx_kl.csv");
  const clipfrac = useMetricSeries("/data/clipfrac.csv");
  const valueLoss = useMetricSeries("/data/value_loss.csv");
  const explainedVariance = useMetricSeries("/data/explained_variance.csv");

  const isLoading = approxKl.isLoading || clipfrac.isLoading || valueLoss.isLoading || explainedVariance.isLoading;
  const error = approxKl.error ?? clipfrac.error ?? valueLoss.error ?? explainedVariance.error;

  const points = useMemo(
    () => buildTrainingPoints(approxKl.data, clipfrac.data, valueLoss.data, explainedVariance.data),
    [approxKl.data, clipfrac.data, valueLoss.data, explainedVariance.data],
  );

  return (
    <DiagnosticsModal
      open={open}
      onClose={onClose}
      title="螺旋训练状态图"
      subtitle="用四项训练指标把每次 PPO 更新编码成一个时序螺旋节点。"
    >
      {isLoading ? (
        <div className="flex min-h-[360px] items-center justify-center rounded-xl border border-base-300 bg-base-200/60 text-sm text-base-content/60">
          正在加载 PPO 训练指标...
        </div>
      ) : error ? (
        <div className="rounded-xl border border-error/30 bg-error/10 p-4 text-sm text-error">{error}</div>
      ) : points.length ? (
        <SpiralGlyphView points={points} />
      ) : (
        <div className="rounded-xl border border-base-300 bg-base-200/60 p-4 text-sm text-base-content/60">
          当前没有可用的训练点数据。
        </div>
      )}
    </DiagnosticsModal>
  );
}
