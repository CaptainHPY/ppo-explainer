"use client";

import { MouseEvent, useMemo, useRef } from "react";
import { extent, ticks } from "d3-array";
import { scaleLinear } from "d3-scale";
import { line as d3Line } from "d3-shape";

import { findClosestMetricPoint, MetricPoint } from "@/lib/metrics";

type MetricHoverState = {
  metricId: string;
  step: number;
};

type MetricMiniChartProps = {
  metricId: string;
  title: string;
  color: string;
  data: MetricPoint[];
  hoverState: MetricHoverState | null;
  onHoverChange: (hoverState: MetricHoverState | null) => void;
  valueFormatter: (value: number) => string;
  referenceValue?: number;
  referenceLabel?: string;
  isEmphasized?: boolean;
};

const chartWidth = 330;
const chartHeight = 126;
const margin = { top: 14, right: 12, bottom: 24, left: 38 };

export default function MetricMiniChart({
  metricId,
  title,
  color,
  data,
  hoverState,
  onHoverChange,
  valueFormatter,
  referenceValue,
  referenceLabel,
  isEmphasized = false,
}: MetricMiniChartProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const innerWidth = chartWidth - margin.left - margin.right;
  const innerHeight = chartHeight - margin.top - margin.bottom;

  const xDomain = useMemo(() => {
    const domain = extent(data, (point: MetricPoint) => point.step) as [number | undefined, number | undefined];
    return [domain[0] ?? 0, domain[1] ?? 1] as [number, number];
  }, [data]);

  const yDomain = useMemo(() => {
    const values = data.map((point) => point.value);
    if (!values.length) {
      return [0, 1] as [number, number];
    }

    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);

    if (minValue === maxValue) {
      return [Math.min(0, minValue * 0.9), maxValue * 1.1 || 1] as [number, number];
    }

    const padding = (maxValue - minValue) * 0.12;
    return [minValue - padding, maxValue + padding] as [number, number];
  }, [data]);

  const xScale = useMemo(
    () => scaleLinear().domain(xDomain).range([margin.left, margin.left + innerWidth]),
    [innerWidth, xDomain],
  );
  const yScale = useMemo(
    () => scaleLinear().domain(yDomain).range([margin.top + innerHeight, margin.top]),
    [innerHeight, yDomain],
  );

  const linePath = useMemo(() => {
    const generator = d3Line<MetricPoint>()
      .x((point: MetricPoint) => xScale(point.step))
      .y((point: MetricPoint) => yScale(point.value));

    return generator(data) ?? "";
  }, [data, xScale, yScale]);

  const highlightedPoint = useMemo(() => {
    return findClosestMetricPoint(data, hoverState?.step ?? null);
  }, [data, hoverState]);

  const xTicks = useMemo(() => ticks(xDomain[0], xDomain[1], 4), [xDomain]);
  const yTicks = useMemo(() => ticks(yDomain[0], yDomain[1], 3), [yDomain]);
  const latestPoint = data[data.length - 1] ?? null;
  const active = hoverState?.metricId === metricId || isEmphasized;

  function handlePointerMove(event: MouseEvent<SVGRectElement>) {
    if (!data.length) {
      return;
    }

    const svg = svgRef.current;
    if (!svg) {
      return;
    }

    const svgPoint = svg.createSVGPoint();
    svgPoint.x = event.clientX;
    svgPoint.y = event.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) {
      return;
    }

    const localPoint = svgPoint.matrixTransform(ctm.inverse());
    const clampedX = Math.max(margin.left, Math.min(margin.left + innerWidth, localPoint.x));
    const inferredStep = xScale.invert(clampedX);
    const nearestPoint = findClosestMetricPoint(data, inferredStep);

    if (nearestPoint) {
      onHoverChange({
        metricId,
        step: nearestPoint.step,
      });
    }
  }

  return (
    <div className="rounded-xl border border-base-300/70 bg-base-100/80 p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-base-content/50">
            {title}
          </div>
          <div className="text-sm font-medium text-base-content">
            {latestPoint ? valueFormatter(latestPoint.value) : "--"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {referenceLabel ? (
            <div
              className="rounded-full px-2 py-1 text-[11px] font-medium"
              style={{
                backgroundColor: `${color}12`,
                color,
                opacity: 0.75,
              }}
            >
              {referenceLabel}
            </div>
          ) : null}
          <div
            className="rounded-full px-2 py-1 text-[11px] font-medium"
            style={{
              backgroundColor: `${color}20`,
              color,
            }}
          >
            {active ? "active" : "series"}
          </div>
        </div>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="h-32 w-full overflow-visible"
      >
        {yTicks.map((tick: number) => (
          <g key={tick}>
            <line
              x1={margin.left}
              x2={margin.left + innerWidth}
              y1={yScale(tick)}
              y2={yScale(tick)}
              stroke="var(--color-base-300)"
              strokeDasharray="3 4"
              strokeOpacity="0.5"
            />
            <text
              x={margin.left - 8}
              y={yScale(tick) + 4}
              textAnchor="end"
              fontSize="10"
              fill="var(--color-base-content)"
              fillOpacity="0.55"
            >
              {valueFormatter(tick)}
            </text>
          </g>
        ))}

        {referenceValue !== undefined ? (
          <g>
            <line
              x1={margin.left}
              x2={margin.left + innerWidth}
              y1={yScale(referenceValue)}
              y2={yScale(referenceValue)}
              stroke={color}
              strokeDasharray="3 8"
              strokeOpacity="0.18"
              strokeWidth={1}
            />
            <line
              x1={margin.left}
              x2={margin.left + innerWidth}
              y1={yScale(referenceValue)}
              y2={yScale(referenceValue)}
              stroke={color}
              strokeDasharray="3 8"
              strokeOpacity="0.18"
              strokeWidth={1}
            >
              <animate
                attributeName="stroke-dashoffset"
                values="0;-22"
                dur="1.6s"
                repeatCount="indefinite"
              />
            </line>
          </g>
        ) : null}

        {xTicks.map((tick: number) => (
          <text
            key={tick}
            x={xScale(tick)}
            y={margin.top + innerHeight + 18}
            textAnchor="middle"
            fontSize="10"
            fill="var(--color-base-content)"
            fillOpacity="0.55"
          >
            {tick}
          </text>
        ))}

        {linePath ? (
          <path
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth={active ? 2.5 : 2}
            strokeOpacity={active ? 1 : 0.82}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}

        {highlightedPoint ? (
          <g pointerEvents="none">
            <line
              x1={xScale(highlightedPoint.step)}
              x2={xScale(highlightedPoint.step)}
              y1={margin.top}
              y2={margin.top + innerHeight}
              stroke={color}
              strokeDasharray="2 3"
              strokeOpacity="0.55"
            />
            <circle
              cx={xScale(highlightedPoint.step)}
              cy={yScale(highlightedPoint.value)}
              r={4}
              fill={color}
              stroke="white"
              strokeWidth={1.5}
            />
          </g>
        ) : null}

        <rect
          x={margin.left}
          y={margin.top}
          width={innerWidth}
          height={innerHeight}
          fill="transparent"
          onMouseMove={handlePointerMove}
          onMouseLeave={() => onHoverChange(null)}
        />
      </svg>
    </div>
  );
}
