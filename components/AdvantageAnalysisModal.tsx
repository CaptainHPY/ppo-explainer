"use client";

import { useEffect, useMemo, useState } from "react";

import DiagnosticsModal from "@/components/metrics/DiagnosticsModal";
import {
  ADVANTAGE_VIEWS,
  getAdvantagePhaseLabel,
  loadAdvantageDataset,
  type AdvantagePhaseId,
  type AdvantageSample,
  type AdvantageViewKey,
} from "@/lib/advantageAnalysis";

type AdvantageAnalysisModalProps = {
  open: boolean;
  initialPhaseId?: AdvantagePhaseId;
  onClose: () => void;
};

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function formatNumber(value: number | null, digits = 3) {
  if (value === null || Number.isNaN(value)) {
    return "--";
  }
  return value.toFixed(digits);
}

function predictionErrorColor(value: number, maxAbsError: number) {
  const normalized = maxAbsError <= 0 ? 0 : clamp(value / maxAbsError, -1, 1);
  const lightness = 94 - Math.abs(normalized) * 42;
  if (normalized > 0.08) {
    return `hsl(10 80% ${lightness}%)`;
  }
  if (normalized < -0.08) {
    return `hsl(216 70% ${lightness}%)`;
  }
  return "hsl(220 12% 62%)";
}

function predictionErrorLabel(value: number) {
  if (value > 1) return "Critic 低估";
  if (value < -1) return "Critic 高估";
  return "基本对齐";
}

function SegmentedControl<TValue extends string>({
  items,
  value,
  onChange,
}: {
  items: Array<{ value: TValue; label: string }>;
  value: TValue;
  onChange: (value: TValue) => void;
}) {
  return (
    <div className="inline-flex rounded-full border border-base-300 bg-base-100 p-1">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onChange(item.value)}
          className={[
            "rounded-full px-3 py-1.5 text-xs font-semibold transition",
            value === item.value ? "bg-primary text-primary-content" : "text-base-content/65 hover:text-base-content",
          ].join(" ")}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function buildHistogram(samples: AdvantageSample[], binCount = 24) {
  if (!samples.length) {
    return { bins: [], min: -1, max: 1, maxCount: 0 };
  }

  const values = samples.map((sample) => sample.advantage);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 1;
    max += 1;
  }

  const width = (max - min) / binCount;
  const counts = new Array(binCount).fill(0);

  for (const value of values) {
    const rawIndex = Math.floor((value - min) / width);
    const index = Math.min(binCount - 1, Math.max(0, rawIndex));
    counts[index] += 1;
  }

  return {
    min,
    max,
    maxCount: Math.max(...counts, 0),
    bins: counts.map((count, index) => ({
      index,
      count,
    })),
  };
}

function AdvantageHistogram({ samples }: { samples: AdvantageSample[] }) {
  const histogram = useMemo(() => buildHistogram(samples), [samples]);
  const width = 760;
  const height = 420;
  const margin = { top: 20, right: 24, bottom: 56, left: 56 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  return (
    <div className="rounded-2xl border border-base-300 bg-base-200/55 p-4">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[420px] w-full">
        <text x={width / 2} y={height - 12} textAnchor="middle" fontSize="13" fill="rgba(15,23,42,0.72)">
          advantage
        </text>
        <text
          x={18}
          y={height / 2}
          textAnchor="middle"
          fontSize="13"
          fill="rgba(15,23,42,0.72)"
          transform={`rotate(-90 18 ${height / 2})`}
        >
          count
        </text>

        {histogram.bins.map((bin) => {
          const barWidth = plotWidth / Math.max(histogram.bins.length, 1) - 2;
          const x = margin.left + (plotWidth / Math.max(histogram.bins.length, 1)) * bin.index + 1;
          const barHeight = histogram.maxCount === 0 ? 0 : (bin.count / histogram.maxCount) * plotHeight;
          const y = margin.top + plotHeight - barHeight;
          return (
            <rect
              key={bin.index}
              x={x}
              y={y}
              width={Math.max(barWidth, 1)}
              height={Math.max(barHeight, 1)}
              rx="4"
              fill="rgba(76,120,216,0.82)"
            />
          );
        })}

        <line
          x1={margin.left}
          y1={margin.top + plotHeight}
          x2={width - margin.right}
          y2={margin.top + plotHeight}
          stroke="rgba(15,23,42,0.35)"
        />
        <line x1={margin.left} y1={margin.top} x2={margin.left} y2={margin.top + plotHeight} stroke="rgba(15,23,42,0.35)" />

        <text x={margin.left} y={height - 28} fontSize="11" fill="rgba(15,23,42,0.6)">
          {formatNumber(histogram.min)}
        </text>
        <text x={width - margin.right} y={height - 28} textAnchor="end" fontSize="11" fill="rgba(15,23,42,0.6)">
          {formatNumber(histogram.max)}
        </text>
        <text x={margin.left - 8} y={margin.top + 12} textAnchor="end" fontSize="11" fill="rgba(15,23,42,0.6)">
          {histogram.maxCount.toLocaleString()}
        </text>
        <text x={margin.left - 8} y={margin.top + plotHeight} textAnchor="end" fontSize="11" fill="rgba(15,23,42,0.6)">
          0
        </text>
      </svg>
    </div>
  );
}

function buildScatterSample(samples: AdvantageSample[], maxPoints = 1400) {
  if (samples.length <= maxPoints) {
    return samples;
  }

  const stride = Math.ceil(samples.length / maxPoints);
  return samples.filter((_, index) => index % stride === 0);
}

function ReturnValueScatter({ samples }: { samples: AdvantageSample[] }) {
  const points = useMemo(() => buildScatterSample(samples), [samples]);
  const [activePoint, setActivePoint] = useState<AdvantageSample | null>(null);
  const width = 760;
  const height = 420;
  const margin = { top: 20, right: 24, bottom: 56, left: 64 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  const valueExtent = useMemo(() => {
    if (!points.length) return { min: -1, max: 1 };
    return {
      min: Math.min(...points.map((point) => point.value)),
      max: Math.max(...points.map((point) => point.value)),
    };
  }, [points]);

  const returnExtent = useMemo(() => {
    if (!points.length) return { min: -1, max: 1 };
    return {
      min: Math.min(...points.map((point) => point.returnValue)),
      max: Math.max(...points.map((point) => point.returnValue)),
    };
  }, [points]);

  const sharedExtent = useMemo(() => {
    const min = Math.min(valueExtent.min, returnExtent.min);
    const max = Math.max(valueExtent.max, returnExtent.max);
    if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
      return { min: -1, max: 1 };
    }
    return { min, max };
  }, [returnExtent.max, returnExtent.min, valueExtent.max, valueExtent.min]);

  const maxAbsError = useMemo(() => {
    if (!points.length) return 1;
    return Math.max(...points.map((point) => Math.abs(point.predictionError)), 1);
  }, [points]);

  function scaleX(value: number) {
    const { min, max } = valueExtent;
    if (max <= min) return margin.left + plotWidth / 2;
    return margin.left + clamp((value - min) / (max - min)) * plotWidth;
  }

  function scaleY(value: number) {
    const { min, max } = returnExtent;
    if (max <= min) return margin.top + plotHeight / 2;
    return margin.top + plotHeight - clamp((value - min) / (max - min)) * plotHeight;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
      <div className="rounded-2xl border border-base-300 bg-base-200/55 p-4">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-[420px] w-full">
          <text x={width / 2} y={height - 12} textAnchor="middle" fontSize="13" fill="rgba(15,23,42,0.72)">
            value
          </text>
          <text
            x={18}
            y={height / 2}
            textAnchor="middle"
            fontSize="13"
            fill="rgba(15,23,42,0.72)"
            transform={`rotate(-90 18 ${height / 2})`}
          >
            return
          </text>

          <line
            x1={margin.left}
            y1={margin.top + plotHeight}
            x2={width - margin.right}
            y2={margin.top + plotHeight}
            stroke="rgba(15,23,42,0.35)"
          />
          <line x1={margin.left} y1={margin.top} x2={margin.left} y2={margin.top + plotHeight} stroke="rgba(15,23,42,0.35)" />

          <line
            x1={scaleX(sharedExtent.min)}
            y1={scaleY(sharedExtent.min)}
            x2={scaleX(sharedExtent.max)}
            y2={scaleY(sharedExtent.max)}
            stroke="rgba(15,23,42,0.42)"
            strokeDasharray="7 6"
            strokeWidth="1.5"
          />
          <text
            x={scaleX(sharedExtent.max) - 6}
            y={scaleY(sharedExtent.max) - 8}
            textAnchor="end"
            fontSize="11"
            fill="rgba(15,23,42,0.62)"
          >
            y = x
          </text>

          {points.map((point, index) => (
            <circle
              key={`${point.step}-${index}`}
              cx={scaleX(point.value)}
              cy={scaleY(point.returnValue)}
              r="3.2"
              fill={predictionErrorColor(point.predictionError, maxAbsError)}
              fillOpacity="0.82"
              onMouseEnter={() => setActivePoint(point)}
            />
          ))}

          {activePoint ? (
            <circle
              cx={scaleX(activePoint.value)}
              cy={scaleY(activePoint.returnValue)}
              r="6.6"
              fill="none"
              stroke="#111827"
              strokeWidth="1.5"
            />
          ) : null}
        </svg>
      </div>

      <aside className="rounded-2xl border border-base-300 bg-base-100 px-4 py-4 text-sm">
        <div className="font-semibold text-base-content">当前点</div>
        <div className="mt-3 rounded-xl border border-base-300 bg-base-200/55 px-3 py-3 text-xs leading-5 text-base-content/68">
          红色表示 <code>return &gt; value</code>，说明 Critic 偏低估；蓝色表示 <code>return &lt; value</code>，说明 Critic 偏高估；靠近灰色表示预测和回报更接近。
        </div>
        {activePoint ? (
          <div className="mt-3 space-y-2 text-base-content/72">
            <div className="font-medium text-base-content">{predictionErrorLabel(activePoint.predictionError)}</div>
            <div>step: {activePoint.step}</div>
            <div>update: {activePoint.updateIdx}</div>
            <div>value: {formatNumber(activePoint.value)}</div>
            <div>return: {formatNumber(activePoint.returnValue)}</div>
            <div>advantage: {formatNumber(activePoint.advantage)}</div>
            <div>return - value: {formatNumber(activePoint.predictionError)}</div>
          </div>
        ) : (
          <div className="mt-3 text-base-content/62">把鼠标移到散点上，可以查看这一条样本是低估、高估，还是已经接近 y=x。</div>
        )}
      </aside>
    </div>
  );
}

export default function AdvantageAnalysisModal({
  open,
  initialPhaseId = "early",
  onClose,
}: AdvantageAnalysisModalProps) {
  const dataset = useMemo(() => loadAdvantageDataset(), []);
  const [activePhaseId, setActivePhaseId] = useState<AdvantagePhaseId>(initialPhaseId);
  const [activeView, setActiveView] = useState<AdvantageViewKey>("histogram");

  useEffect(() => {
    setActivePhaseId(initialPhaseId);
  }, [initialPhaseId]);

  const phase = dataset.phases[activePhaseId];

  return (
    <DiagnosticsModal
      open={open}
      onClose={onClose}
      title={`${getAdvantagePhaseLabel(activePhaseId)} Advantage 分析`}
      subtitle={`${phase.stepStart} - ${phase.stepEnd} 步，样本数 ${phase.sampleCount.toLocaleString()}`}
      maxWidthClass="max-w-[1260px]"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SegmentedControl
            items={[
              { value: "early", label: "前期" },
              { value: "middle", label: "中期" },
              { value: "late", label: "后期" },
            ]}
            value={activePhaseId}
            onChange={setActivePhaseId}
          />

          <SegmentedControl items={ADVANTAGE_VIEWS} value={activeView} onChange={setActiveView} />
        </div>

        <div className="grid gap-3 rounded-xl border border-base-300 bg-base-200/45 px-4 py-3 text-sm text-base-content/68 sm:grid-cols-4">
          <div>
            <div className="text-xs text-base-content/50">advantage mean / std</div>
            <div className="mt-1 font-medium">
              {formatNumber(phase.summary.advantage.mean)} / {formatNumber(phase.summary.advantage.std)}
            </div>
          </div>
          <div>
            <div className="text-xs text-base-content/50">return mean</div>
            <div className="mt-1 font-medium">{formatNumber(phase.summary.return.mean)}</div>
          </div>
          <div>
            <div className="text-xs text-base-content/50">value mean</div>
            <div className="mt-1 font-medium">{formatNumber(phase.summary.value.mean)}</div>
          </div>
          <div>
            <div className="text-xs text-base-content/50">prediction error mean</div>
            <div className="mt-1 font-medium">{formatNumber(phase.summary.predictionError.mean)}</div>
          </div>
        </div>

        {activeView === "histogram" ? (
          <AdvantageHistogram samples={phase.samples} />
        ) : (
          <ReturnValueScatter samples={phase.samples} />
        )}
      </div>
    </DiagnosticsModal>
  );
}
