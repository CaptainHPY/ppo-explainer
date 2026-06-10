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

type BiasPlacement = SegmentPlacement & {
  paddingX: number;
  paddingY: number;
};

const VIEWBOX = { width: 1420, height: 860 };
const CENTER_SIDE = 320;
const SQRT2 = Math.sqrt(2);

function formatNumber(value: number, digits = 2) {
  return value.toFixed(digits);
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
      <svg viewBox="0 0 78 320" className="h-[420px] w-[78px]">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor={valueToColor(-domain, domain)} />
            <stop offset="50%" stopColor={valueToColor(0, domain)} />
            <stop offset="100%" stopColor={valueToColor(domain, domain)} />
          </linearGradient>
        </defs>
        <rect x="20" y="16" width="18" height="268" rx="9" fill={`url(#${gradientId})`} stroke="rgba(15,23,42,0.10)" />
        <text x="48" y="24" fontSize="11" fill="currentColor">
          +{formatNumber(domain)}
        </text>
        <text x="48" y="154" fontSize="11" fill="currentColor">
          0
        </text>
        <text x="48" y="286" fontSize="11" fill="currentColor">
          -{formatNumber(domain)}
        </text>
      </svg>
    </div>
  );
}

function MatrixSegment({
  segment,
  placement,
  attachSide,
  domain,
}: {
  segment: MatrixWaveSegmentData;
  placement: SegmentPlacement;
  attachSide: "left" | "right";
  domain: number;
}) {
  const transform =
    attachSide === "right"
      ? `translate(${placement.x} ${placement.y}) rotate(${placement.rotation}) translate(${-placement.width} ${-placement.height / 2})`
      : `translate(${placement.x} ${placement.y}) rotate(${placement.rotation}) translate(0 ${-placement.height / 2})`;

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
      <g transform="translate(14 14)">
        {drawMatrixCells({
          values: segment.values,
          width: placement.width - 28,
          height: placement.height - 28,
          domain,
        })}
      </g>
    </g>
  );
}

function BiasStrip({
  bias,
  placement,
  attachSide,
  domain,
}: {
  bias: MatrixWaveBiasStripData;
  placement: BiasPlacement;
  attachSide: "left" | "right";
  domain: number;
}) {
  const transform =
    attachSide === "right"
      ? `translate(${placement.x} ${placement.y}) rotate(${placement.rotation}) translate(${-placement.width} ${-placement.height / 2})`
      : `translate(${placement.x} ${placement.y}) rotate(${placement.rotation}) translate(0 ${-placement.height / 2})`;

  return (
    <g transform={transform} opacity="0.92">
      <rect
        x={0}
        y={0}
        width={placement.width}
        height={placement.height}
        rx={placement.height / 2}
        fill="rgba(255,255,255,0.88)"
        stroke="rgba(15,23,42,0.12)"
      />
      <g transform={`translate(${placement.paddingX} ${placement.paddingY})`}>
        {drawMatrixCells({
          values: bias.values,
          width: placement.width - placement.paddingX * 2,
          height: placement.height - placement.paddingY * 2,
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
  const [leftBias, centerBias, rightBias] = biases;

  const centerX = 710;
  const centerY = 530;
  const diamondHalf = (CENTER_SIDE * SQRT2) / 2;
  const top = { x: centerX, y: centerY - diamondHalf };
  const right = { x: centerX + diamondHalf, y: centerY };
  const left = { x: centerX - diamondHalf, y: centerY };
  const topLeftMid = { x: (top.x + left.x) / 2, y: (top.y + left.y) / 2 };
  const topRightMid = { x: (top.x + right.x) / 2, y: (top.y + right.y) / 2 };

  const leftPlacement: SegmentPlacement = {
    x: topLeftMid.x,
    y: topLeftMid.y,
    width: 176,
    height: CENTER_SIDE,
    rotation: 45,
  };
  const rightPlacement: SegmentPlacement = {
    x: topRightMid.x,
    y: topRightMid.y,
    width: 160,
    height: CENTER_SIDE,
    rotation: -45,
  };

  const leftBiasPlacement: BiasPlacement = {
    x: topLeftMid.x - 46,
    y: topLeftMid.y - 44,
    width: 122,
    height: 22,
    rotation: 45,
    paddingX: 5,
    paddingY: 4,
  };
  const centerBiasPlacement: BiasPlacement = {
    x: centerX,
    y: centerY + diamondHalf + 54,
    width: 168,
    height: 22,
    rotation: 0,
    paddingX: 5,
    paddingY: 4,
  };
  const rightBiasPlacement: BiasPlacement = {
    x: topRightMid.x + 46,
    y: topRightMid.y - 44,
    width: 112,
    height: 22,
    rotation: -45,
    paddingX: 5,
    paddingY: 4,
  };

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
      className="h-[72vh] min-h-[620px] w-full"
      role="img"
      aria-label="V 形 MatrixWave 权重图"
      data-testid="matrixwave-canvas"
    >
      <title>V 形 MatrixWave 权重图</title>

      <path
        d={`M ${left.x - 242} ${left.y - 248} L ${topLeftMid.x} ${topLeftMid.y} L ${topRightMid.x} ${topRightMid.y} L ${right.x + 242} ${right.y - 248}`}
        fill="none"
        stroke="rgba(76,120,216,0.12)"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <MatrixSegment segment={leftSegment} placement={leftPlacement} attachSide="right" domain={domain} />

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
        <g transform="translate(16 16)">
          {drawMatrixCells({
            values: centerSegment.values,
            width: CENTER_SIDE - 32,
            height: CENTER_SIDE - 32,
            domain,
          })}
        </g>
      </g>

      <MatrixSegment segment={rightSegment} placement={rightPlacement} attachSide="left" domain={domain} />

      <BiasStrip bias={leftBias} placement={leftBiasPlacement} attachSide="right" domain={domain} />
      <BiasStrip bias={centerBias} placement={centerBiasPlacement} attachSide="left" domain={domain} />
      <BiasStrip bias={rightBias} placement={rightBiasPlacement} attachSide="left" domain={domain} />

      <text x={topLeftMid.x - 2} y={topLeftMid.y - 138} textAnchor="middle" fontSize="13" fill="rgba(15,23,42,0.72)">
        {leftSegment.label}
      </text>
      <text x={centerX} y={centerY - diamondHalf - 22} textAnchor="middle" fontSize="13" fill="rgba(15,23,42,0.72)">
        {centerSegment.label}
      </text>
      <text x={topRightMid.x + 2} y={topRightMid.y - 138} textAnchor="middle" fontSize="13" fill="rgba(15,23,42,0.72)">
        {rightSegment.label}
      </text>

      <text x="112" y="242" fontSize="20" fontWeight="600" fill="rgba(15,23,42,0.82)">
        input
      </text>
      <text x="154" y="270" fontSize="13" fill="rgba(15,23,42,0.62)">
        obs
      </text>

      <text x="1262" y="242" textAnchor="end" fontSize="20" fontWeight="600" fill="rgba(15,23,42,0.82)">
        output
      </text>
      <text x="1214" y="270" textAnchor="end" fontSize="13" fill="rgba(15,23,42,0.62)">
        out
      </text>

      <text x={topLeftMid.x - 22} y={topLeftMid.y - 118} textAnchor="middle" fontSize="13" fill="rgba(15,23,42,0.62)">
        fc1
      </text>
      <text x={topRightMid.x + 22} y={topRightMid.y - 118} textAnchor="middle" fontSize="13" fill="rgba(15,23,42,0.62)">
        fc2
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
      maxWidthClass="max-w-[1280px]"
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_92px]">
        <div className="rounded-2xl border border-base-300 bg-base-200/55 p-5">
          <VShapeMatrixWave segments={modalData.segments} biases={modalData.biases} domain={modalData.colorDomain} />
        </div>

        <aside className="rounded-2xl border border-base-300 bg-base-100 px-2 py-4">
          <MatrixWaveColorLegend domain={modalData.colorDomain} />
        </aside>
      </div>
    </DiagnosticsModal>
  );
}
