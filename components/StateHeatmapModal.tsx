"use client";

import { useEffect, useMemo, useState } from "react";

import DiagnosticsModal from "@/components/metrics/DiagnosticsModal";
import {
  HEATMAP_METRICS,
  getHeatmapMetricDefinition,
  getHeatmapMetricDomain,
  loadStateHeatmapDataset,
  type HeatmapMetricKey,
  type HeatmapPhaseId,
} from "@/lib/stateHeatmap";

type StateHeatmapModalProps = {
  phaseId: HeatmapPhaseId | null;
  onClose: () => void;
};

type ActiveCell = {
  row: number;
  col: number;
  value: number | null;
};

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function formatMetricValue(value: number, metricKey: HeatmapMetricKey) {
  if (metricKey === "visit_count") {
    return value.toFixed(0);
  }
  return value.toFixed(3);
}

function formatObservationValue(value: number) {
  return value.toFixed(3);
}

function heatmapColor(value: number | null, domain: [number, number], palette: "sequential" | "diverging") {
  if (value === null) {
    return "rgba(148, 163, 184, 0.12)";
  }

  if (palette === "sequential") {
    const [minValue, maxValue] = domain;
    const normalized = maxValue <= minValue ? 0 : clamp((value - minValue) / (maxValue - minValue));
    const lightness = 97 - normalized * 54;
    return `hsl(220 74% ${lightness}%)`;
  }

  const maxAbs = Math.max(Math.abs(domain[0]), Math.abs(domain[1]), 1e-6);
  const normalized = clamp(value / maxAbs, -1, 1);
  const lightness = 96 - Math.abs(normalized) * 48;
  if (normalized >= 0) {
    return `hsl(20 88% ${lightness}%)`;
  }
  return `hsl(224 68% ${lightness}%)`;
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

function StateHeatmapLegend({
  domain,
  palette,
}: {
  domain: [number, number];
  palette: "sequential" | "diverging";
}) {
  const gradientId = `state-heatmap-legend-${palette}`;
  const [minValue, maxValue] = domain;
  const midValue = palette === "diverging" ? 0 : (minValue + maxValue) / 2;

  return (
    <div className="flex h-full flex-col items-center justify-start gap-3" data-testid="state-heatmap-legend">
      <span className="text-xs font-semibold tracking-[0.16em] text-base-content/58 [writing-mode:vertical-rl]">
        色度标尺
      </span>
      <svg viewBox="0 0 92 340" className="h-[360px] w-[92px]">
        <defs>
          {palette === "sequential" ? (
            <linearGradient id={gradientId} x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor={heatmapColor(minValue, domain, palette)} />
              <stop offset="100%" stopColor={heatmapColor(maxValue, domain, palette)} />
            </linearGradient>
          ) : (
            <linearGradient id={gradientId} x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor={heatmapColor(minValue, domain, palette)} />
              <stop offset="50%" stopColor={heatmapColor(0, domain, palette)} />
              <stop offset="100%" stopColor={heatmapColor(maxValue, domain, palette)} />
            </linearGradient>
          )}
        </defs>
        <rect x="24" y="20" width="20" height="288" rx="10" fill={`url(#${gradientId})`} stroke="rgba(15,23,42,0.10)" />
        <text x="54" y="28" fontSize="11" fill="currentColor">
          {maxValue.toFixed(palette === "sequential" && maxValue >= 10 ? 0 : 2)}
        </text>
        <text x="54" y="170" fontSize="11" fill="currentColor">
          {palette === "diverging" ? "0" : midValue.toFixed(2)}
        </text>
        <text x="54" y="312" fontSize="11" fill="currentColor">
          {minValue.toFixed(palette === "sequential" && maxValue >= 10 ? 0 : 2)}
        </text>
      </svg>
    </div>
  );
}

function StateHeatmapGrid({
  grid,
  metricKey,
  domain,
  palette,
  xLabel,
  yLabel,
  xMin,
  xMax,
  yMin,
  yMax,
}: {
  grid: Array<Array<number | null>>;
  metricKey: HeatmapMetricKey;
  domain: [number, number];
  palette: "sequential" | "diverging";
  xLabel: string;
  yLabel: string;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}) {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const plotWidth = 720;
  const plotHeight = 540;
  const margin = { top: 18, right: 12, bottom: 52, left: 92 };
  const totalWidth = margin.left + plotWidth + margin.right;
  const totalHeight = margin.top + plotHeight + margin.bottom;
  const cellWidth = plotWidth / Math.max(cols, 1);
  const cellHeight = plotHeight / Math.max(rows, 1);
  const [activeCell, setActiveCell] = useState<ActiveCell | null>(null);

  function getObservationBounds(cell: ActiveCell) {
    const xStep = (xMax - xMin) / Math.max(cols, 1);
    const yStep = (yMax - yMin) / Math.max(rows, 1);

    const x0 = xMin + cell.col * xStep;
    const x1 = x0 + xStep;
    const y0 = yMin + cell.row * yStep;
    const y1 = y0 + yStep;

    return {
      xRange: [x0, x1] as const,
      yRange: [y0, y1] as const,
      xCenter: (x0 + x1) / 2,
      yCenter: (y0 + y1) / 2,
    };
  }

  const observationBounds = activeCell ? getObservationBounds(activeCell) : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_112px]">
      <div className="rounded-2xl border border-base-300 bg-base-200/55 p-4">
        <svg viewBox={`0 0 ${totalWidth} ${totalHeight}`} className="h-[62vh] min-h-[480px] w-full" data-testid="state-heatmap-grid">
          <text
            x={margin.left + plotWidth / 2}
            y={totalHeight - 8}
            textAnchor="middle"
            fontSize="13"
            fill="rgba(15,23,42,0.68)"
          >
            {xLabel}
          </text>
          <text
            x={24}
            y={margin.top + plotHeight / 2}
            textAnchor="middle"
            fontSize="13"
            fill="rgba(15,23,42,0.68)"
            transform={`rotate(-90 24 ${margin.top + plotHeight / 2})`}
          >
            {yLabel}
          </text>

          {grid.flatMap((row, rowIndex) =>
            row.map((value, colIndex) => (
              <rect
                key={`${rowIndex}-${colIndex}`}
                x={margin.left + colIndex * cellWidth}
                y={margin.top + rowIndex * cellHeight}
                width={Math.max(1, cellWidth - 0.4)}
                height={Math.max(1, cellHeight - 0.4)}
                fill={heatmapColor(value, domain, palette)}
                stroke="rgba(255,255,255,0.18)"
                strokeWidth="0.35"
                onMouseEnter={() => setActiveCell({ row: rowIndex, col: colIndex, value })}
              />
            )),
          )}

          {activeCell ? (
            <rect
              x={margin.left + activeCell.col * cellWidth}
              y={margin.top + activeCell.row * cellHeight}
              width={Math.max(1, cellWidth - 0.4)}
              height={Math.max(1, cellHeight - 0.4)}
              fill="none"
              stroke="#111827"
              strokeWidth="1.2"
            />
          ) : null}
        </svg>
      </div>

      <aside className="rounded-2xl border border-base-300 bg-base-100 px-3 py-4">
        <StateHeatmapLegend domain={domain} palette={palette} />
      </aside>

      <div className="rounded-xl border border-base-300 bg-base-100 px-4 py-3 text-xs leading-5 text-base-content/65 lg:col-span-2">
        {activeCell && observationBounds ? (
          <div className="space-y-1">
            <div>
              网格 ({activeCell.col + 1}, {activeCell.row + 1})：{activeCell.value === null ? "无样本" : formatMetricValue(activeCell.value, metricKey)}
            </div>
            <div>
              {xLabel} ∈ [{formatObservationValue(observationBounds.xRange[0])}, {formatObservationValue(observationBounds.xRange[1])}]，中心 {formatObservationValue(observationBounds.xCenter)}
            </div>
            <div>
              {yLabel} ∈ [{formatObservationValue(observationBounds.yRange[0])}, {formatObservationValue(observationBounds.yRange[1])}]，中心 {formatObservationValue(observationBounds.yCenter)}
            </div>
          </div>
        ) : (
          "将鼠标移动到热力图网格上，可以查看网格坐标、统计值和对应的真实观测区间。"
        )}
      </div>
    </div>
  );
}

export default function StateHeatmapModal({ phaseId, onClose }: StateHeatmapModalProps) {
  const dataset = useMemo(() => loadStateHeatmapDataset(), []);
  const [activePhaseId, setActivePhaseId] = useState<HeatmapPhaseId>(phaseId ?? "early");
  const [activeMetricKey, setActiveMetricKey] = useState<HeatmapMetricKey>("visit_count");

  useEffect(() => {
    if (phaseId) {
      setActivePhaseId(phaseId);
    }
  }, [phaseId]);

  if (!phaseId) {
    return null;
  }

  const phase = dataset.phases[activePhaseId];
  const metric = getHeatmapMetricDefinition(activeMetricKey);
  const domain = getHeatmapMetricDomain(dataset, activeMetricKey);
  const xLabel = dataset.axes.x.label.replaceAll("_", " ");
  const yLabel = dataset.axes.y.label.replaceAll("_", " ");

  return (
    <DiagnosticsModal
      open={Boolean(phaseId)}
      onClose={onClose}
      title={`${phase.label}状态热力图`}
      subtitle={`${phase.stepStart} - ${phase.stepEnd} 步，样本数 ${phase.sampleCount.toLocaleString()}`}
      maxWidthClass="max-w-[1280px]"
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

          <SegmentedControl
            items={HEATMAP_METRICS.map((item) => ({ value: item.key, label: item.label }))}
            value={activeMetricKey}
            onChange={setActiveMetricKey}
          />
        </div>

        <div className="rounded-xl border border-base-300 bg-base-200/45 px-4 py-3 text-sm leading-6 text-base-content/68">
          {metric.description}
        </div>

        <StateHeatmapGrid
          grid={phase.grids[activeMetricKey]}
          metricKey={activeMetricKey}
          domain={domain}
          palette={metric.palette}
          xLabel={xLabel}
          yLabel={yLabel}
          xMin={dataset.binning.x_min}
          xMax={dataset.binning.x_max}
          yMin={dataset.binning.y_min}
          yMax={dataset.binning.y_max}
        />
      </div>
    </DiagnosticsModal>
  );
}
