"use client";

import { useMemo } from "react";

import DiagnosticsModal from "@/components/metrics/DiagnosticsModal";
import {
  buildNetworkMatrixWaveData,
  type MatrixWaveBiasStripData,
  type MatrixWaveModalState,
  type MatrixWaveSegmentData,
  loadWeightData,
} from "@/lib/weightMatrix";

type NetworkMatrixWaveModalProps = {
  state: MatrixWaveModalState;
  onClose: () => void;
};

type SegmentPlacement = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};

const VIEWBOX = { width: 1540, height: 920 };
const CENTER_SIDE = 360;
const SQRT2 = Math.sqrt(2);

function formatNumber(value: number, digits = 2) {
  return value.toFixed(digits);
}

function transposeMatrix(values: number[][]) {
  const rows = values.length;
  const cols = values[0]?.length ?? 0;
  return Array.from({ length: cols }, (_, colIndex) =>
    Array.from({ length: rows }, (_, rowIndex) => values[rowIndex]?.[colIndex] ?? 0),
  );
}

function valueToColor(value: number, domain: number) {
  const safeDomain = domain || 1;
  const normalized = Math.max(-1, Math.min(1, value / safeDomain));
  if (normalized >= 0) {
    const intensity = Math.abs(normalized);
    const lightness = 96 - intensity * 46;
    return `hsl(20 88% ${lightness}%)`;
  }
  const intensity = Math.abs(normalized);
  const lightness = 96 - intensity * 44;
  return `hsl(224 68% ${lightness}%)`;
}

function drawMatrixCells({
  values,
  width,
  height,
  domain,
  inset = 0,
}: {
  values: number[][];
  width: number;
  height: number;
  domain: number;
  inset?: number;
}) {
  const rows = values.length;
  const cols = values[0]?.length ?? 0;
  const cellWidth = (width - inset * 2) / Math.max(cols, 1);
  const cellHeight = (height - inset * 2) / Math.max(rows, 1);

  return values.flatMap((row, rowIndex) =>
    row.map((value, colIndex) => (
      <rect
        key={`${rowIndex}-${colIndex}`}
        x={inset + colIndex * cellWidth}
        y={inset + rowIndex * cellHeight}
        width={Math.max(0.9, cellWidth - 0.35)}
        height={Math.max(0.9, cellHeight - 0.35)}
        fill={valueToColor(value, domain)}
        rx={Math.min(1.4, cellWidth * 0.18)}
      />
    )),
  );
}

function MatrixWaveColorLegend({ domain }: { domain: number }) {
  const gradientId = "matrixwave-gradient-vertical";

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3" data-testid="matrixwave-legend">
      <span className="text-xs font-semibold tracking-[0.16em] text-base-content/58 [writing-mode:vertical-rl]">
        色度标尺
      </span>
      <svg viewBox="0 0 78 340" className="h-[470px] w-[82px]">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor={valueToColor(-domain, domain)} />
            <stop offset="50%" stopColor={valueToColor(0, domain)} />
            <stop offset="100%" stopColor={valueToColor(domain, domain)} />
          </linearGradient>
        </defs>
        <rect x="20" y="18" width="18" height="288" rx="9" fill={`url(#${gradientId})`} stroke="rgba(15,23,42,0.10)" />
        <text x="48" y="26" fontSize="11" fill="currentColor">
          +{formatNumber(domain)}
        </text>
        <text x="48" y="166" fontSize="11" fill="currentColor">
          0
        </text>
        <text x="48" y="308" fontSize="11" fill="currentColor">
          -{formatNumber(domain)}
        </text>
      </svg>
    </div>
  );
}

function EdgeTickMarks({
  count,
  width,
  label,
}: {
  count: number;
  width: number;
  label: string;
}) {
  const safeCount = Math.max(1, count);
  const left = 24;
  const right = width - 24;
  const span = right - left;

  return (
    <g>
      <line x1={left} y1={10} x2={right} y2={10} stroke="rgba(15,23,42,0.18)" strokeWidth="1.2" />
      {Array.from({ length: safeCount }, (_, index) => {
        const x = safeCount === 1 ? (left + right) / 2 : left + (span * index) / (safeCount - 1);
        return <line key={index} x1={x} y1={6} x2={x} y2={14} stroke="rgba(15,23,42,0.28)" strokeWidth="1.2" />;
      })}
      <text x={width / 2} y={-6} textAnchor="middle" fontSize="11" fill="rgba(15,23,42,0.64)">
        {label}
      </text>
    </g>
  );
}

function MatrixSegment({
  segment,
  placement,
  attachSide,
  domain,
  displayValues,
  edgeTickLabel,
  edgeTickCount,
}: {
  segment: MatrixWaveSegmentData;
  placement: SegmentPlacement;
  attachSide: "left" | "right";
  domain: number;
  displayValues?: number[][];
  edgeTickLabel?: string;
  edgeTickCount?: number;
}) {
  const transform =
    attachSide === "right"
      ? `translate(${placement.x} ${placement.y}) rotate(${placement.rotation}) translate(${-placement.width} ${-placement.height / 2})`
      : `translate(${placement.x} ${placement.y}) rotate(${placement.rotation}) translate(0 ${-placement.height / 2})`;

  const values = displayValues ?? segment.values;

  return (
    <g transform={transform}>
      <rect
        x={0}
        y={0}
        width={placement.width}
        height={placement.height}
        rx={26}
        fill="rgba(255,255,255,0.92)"
        stroke="rgba(76,120,216,0.24)"
        strokeWidth="2.4"
      />
      {edgeTickLabel && edgeTickCount ? <EdgeTickMarks count={edgeTickCount} width={placement.width} label={edgeTickLabel} /> : null}
      <g transform="translate(14 22)">
        {drawMatrixCells({
          values,
          width: placement.width - 28,
          height: placement.height - 36,
          domain,
        })}
      </g>
    </g>
  );
}

function BiasStrip({
  bias,
  x,
  y,
  width,
  height,
  domain,
}: {
  bias: MatrixWaveBiasStripData;
  x: number;
  y: number;
  width: number;
  height: number;
  domain: number;
}) {
  return (
    <g opacity="0.92">
      <rect
        x={x - width / 2}
        y={y - height / 2}
        width={width}
        height={height}
        rx={height / 2}
        fill="rgba(255,255,255,0.88)"
        stroke="rgba(15,23,42,0.12)"
      />
      <g transform={`translate(${x - width / 2 + 5} ${y - height / 2 + 4})`}>
        {drawMatrixCells({
          values: bias.values,
          width: width - 10,
          height: height - 8,
          domain,
        })}
      </g>
    </g>
  );
}

function VShapeMatrixWave({
  segments,
  biases,
  domain,
}: {
  segments: MatrixWaveSegmentData[];
  biases: MatrixWaveBiasStripData[];
  domain: number;
}) {
  const [leftSegment, centerSegment, rightSegment] = segments;
  const [, centerBias] = biases;
  const rightDisplayValues = transposeMatrix(rightSegment.values);

  const centerX = 770;
  const centerY = 565;
  const diamondHalf = (CENTER_SIDE * SQRT2) / 2;
  const top = { x: centerX, y: centerY - diamondHalf };
  const right = { x: centerX + diamondHalf, y: centerY };
  const left = { x: centerX - diamondHalf, y: centerY };
  const topLeftMid = { x: (top.x + left.x) / 2, y: (top.y + left.y) / 2 };
  const topRightMid = { x: (top.x + right.x) / 2, y: (top.y + right.y) / 2 };

  const leftPlacement: SegmentPlacement = {
    x: topLeftMid.x,
    y: topLeftMid.y,
    width: 198,
    height: CENTER_SIDE,
    rotation: 45,
  };
  const rightPlacement: SegmentPlacement = {
    x: topRightMid.x,
    y: topRightMid.y,
    width: 188,
    height: CENTER_SIDE,
    rotation: -45,
  };

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
      className="h-[78vh] min-h-[700px] w-full"
      role="img"
      aria-label="V 形 MatrixWave 权重图"
      data-testid="matrixwave-canvas"
    >
      <title>V 形 MatrixWave 权重图</title>

      <MatrixSegment
        segment={leftSegment}
        placement={leftPlacement}
        attachSide="right"
        domain={domain}
        edgeTickCount={leftSegment.shape[1] ?? 4}
        edgeTickLabel={`obs · ${leftSegment.shape[1] ?? 4}`}
      />

      <g transform={`translate(${centerX} ${centerY}) rotate(45) translate(${-CENTER_SIDE / 2} ${-CENTER_SIDE / 2})`}>
        <rect
          x={0}
          y={0}
          width={CENTER_SIDE}
          height={CENTER_SIDE}
          rx={28}
          fill="rgba(255,255,255,0.95)"
          stroke="rgba(76,120,216,0.24)"
          strokeWidth="2.8"
        />
        <g transform="translate(18 18)">
          {drawMatrixCells({
            values: centerSegment.values,
            width: CENTER_SIDE - 36,
            height: CENTER_SIDE - 36,
            domain,
          })}
        </g>
      </g>

      <MatrixSegment
        segment={rightSegment}
        placement={rightPlacement}
        attachSide="left"
        domain={domain}
        displayValues={rightDisplayValues}
        edgeTickCount={rightSegment.shape[0] ?? 2}
        edgeTickLabel={`out · ${rightSegment.shape[0] ?? 2}`}
      />

      <BiasStrip
        bias={centerBias}
        x={centerX}
        y={centerY + diamondHalf + 60}
        width={184}
        height={24}
        domain={domain}
      />

      <text x={314} y={472} textAnchor="middle" fontSize="13" fill="rgba(15,23,42,0.72)">
        {leftSegment.label}
      </text>
      <text x={526} y={654} textAnchor="middle" fontSize="13" fill="rgba(15,23,42,0.72)">
        fc1
      </text>

      <text x={centerX} y={836} textAnchor="middle" fontSize="13" fill="rgba(15,23,42,0.72)">
        {centerSegment.label}
      </text>

      <text x={1028} y={658} textAnchor="middle" fontSize="13" fill="rgba(15,23,42,0.72)">
        fc2
      </text>
      <text x={1186} y={474} textAnchor="middle" fontSize="13" fill="rgba(15,23,42,0.72)">
        {rightSegment.label}
      </text>
    </svg>
  );
}

export default function NetworkMatrixWaveModal({ state, onClose }: NetworkMatrixWaveModalProps) {
  const { frontend, summary } = useMemo(() => loadWeightData(), []);

  const modalData = useMemo(() => {
    if (!state) return null;
    return buildNetworkMatrixWaveData(state.phaseId, state.networkKind, frontend, summary);
  }, [state, frontend, summary]);

  if (!state || !modalData) {
    return null;
  }

  return (
    <DiagnosticsModal
      open={Boolean(state)}
      onClose={onClose}
      title={`${modalData.phaseLabel} · ${modalData.networkTitle} MatrixWave`}
      subtitle={modalData.description}
      maxWidthClass="max-w-[1380px]"
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_88px]">
        <div className="rounded-2xl border border-base-300 bg-base-200/55 p-4">
          <VShapeMatrixWave segments={modalData.segments} biases={modalData.biases} domain={modalData.colorDomain} />
        </div>

        <aside className="rounded-2xl border border-base-300 bg-base-100 px-1 py-3">
          <MatrixWaveColorLegend domain={modalData.colorDomain} />
        </aside>
      </div>
    </DiagnosticsModal>
  );
}
