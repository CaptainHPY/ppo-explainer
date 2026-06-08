"use client";

import { useEffect, useMemo, useRef } from "react";
import katex from "katex";

import {
  actorFormulaStages,
  getActorFormulaStage,
  type ActorFormulaExpressionToken,
  type ActorFormulaStageId,
  type TensorTileSpec,
} from "@/lib/actor-formula";

type ActorFormulaExplorerProps = {
  open: boolean;
  stageId: ActorFormulaStageId;
  onStageChange: (stageId: ActorFormulaStageId) => void;
  onClose: () => void;
  onTileHover?: (targets: TensorTileSpec["highlightTargets"] | null) => void;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getValueColor(value: number) {
  const magnitude = clamp(Math.abs(value), 0, 1);
  const alpha = 0.18 + magnitude * 0.72;
  if (value >= 0) {
    return `rgba(77, 163, 255, ${alpha.toFixed(3)})`;
  }
  return `rgba(255, 124, 122, ${alpha.toFixed(3)})`;
}

function getProbabilityColor(index: number, total: number, isSelected: boolean) {
  if (isSelected) {
    return "rgba(72, 187, 120, 0.95)";
  }

  const hue = 210 + (index / Math.max(1, total - 1)) * 70;
  return `hsla(${hue}, 78%, 66%, 0.82)`;
}

function renderTensorTileContent(tile: TensorTileSpec) {
  if (tile.kind === "matrix") {
    const rows = (tile.values as number[][]) ?? [];
    return (
      <div className="grid h-[124px] w-full gap-[3px]" style={{ gridTemplateColumns: `repeat(${rows[0]?.length ?? 1}, minmax(0, 1fr))` }}>
        {rows.flatMap((row, rowIndex) =>
          row.map((value, colIndex) => (
            <span
              key={`${tile.id}-${rowIndex}-${colIndex}`}
              className="rounded-[2px]"
              style={{ background: getValueColor(value), minHeight: "8px" }}
            />
          )),
        )}
      </div>
    );
  }

  if (tile.kind === "probabilities") {
    const values = (tile.values as number[]) ?? [];
    const labels = tile.actionLabels ?? values.map((_, index) => `${index}`);

    return (
      <div className="flex h-[124px] items-end justify-between gap-2 px-2">
        {values.map((value, index) => {
          const selected = tile.selectedIndex === index;
          return (
            <div key={`${tile.id}-${index}`} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <span className="text-[10px] font-medium text-base-content/70">{Math.round(value * 100)}%</span>
              <span
                className="w-full rounded-t-md"
                style={{
                  height: `${30 + value * 76}px`,
                  background: getProbabilityColor(index, values.length, selected),
                }}
              />
              <span className={`text-[10px] ${selected ? "font-semibold text-success" : "text-base-content/65"}`}>
                a{labels[index]}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  if (tile.kind === "action") {
    const labels = tile.actionLabels ?? ["0"];
    const selected = tile.selectedIndex ?? 0;
    return (
      <div className="flex h-[124px] items-center justify-center">
        <div className="flex h-22 w-22 items-center justify-center rounded-full border border-success/25 bg-success/12 text-3xl font-semibold text-success shadow-sm">
          a{labels[selected]}
        </div>
      </div>
    );
  }

  const values = (tile.values as number[]) ?? [];
  return (
    <div className="flex h-[124px] items-end gap-[4px] overflow-hidden px-1">
      {values.map((value, index) => (
        <span
          key={`${tile.id}-${index}`}
          className="min-w-0 flex-1 rounded-t-[4px]"
          style={{
            height: `${18 + Math.abs(value) * 86}px`,
            background: getValueColor(value),
          }}
        />
      ))}
    </div>
  );
}

function TensorTile({
  tile,
  onHoverChange,
}: {
  tile: TensorTileSpec;
  onHoverChange?: (targets: TensorTileSpec["highlightTargets"] | null) => void;
}) {
  return (
    <div
      className="flex min-h-[212px] min-w-[128px] flex-1 flex-col rounded-2xl border border-base-300 bg-base-100/96 px-3 py-3 shadow-sm transition-shadow duration-150 hover:shadow-md"
      onMouseEnter={() => onHoverChange?.(tile.highlightTargets)}
      onMouseLeave={() => onHoverChange?.(null)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] font-semibold text-base-content/80">{tile.label}</div>
        <div className="rounded-full bg-base-200 px-2 py-0.5 text-[10px] font-medium text-base-content/55">{tile.shape}</div>
      </div>

      <div className="mt-3 flex-1">{renderTensorTileContent(tile)}</div>
    </div>
  );
}

function FormulaExpression({
  tokens,
  onTileHover,
}: {
  tokens: ActorFormulaExpressionToken[];
  onTileHover?: (targets: TensorTileSpec["highlightTargets"] | null) => void;
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch lg:justify-between">
      {tokens.map((token, index) =>
        token.type === "tile" ? (
          <div key={`${token.tile.id}-${index}`} className="flex min-w-0 flex-1">
            <TensorTile tile={token.tile} onHoverChange={onTileHover} />
          </div>
        ) : (
          <div
            key={`${token.label}-${index}`}
            className={`flex h-auto items-center justify-center px-1 text-2xl font-semibold lg:min-w-[28px] ${
              token.tone === "soft" ? "text-primary/65" : "text-base-content/60"
            }`}
          >
            {token.label}
          </div>
        ),
      )}
    </div>
  );
}

export default function ActorFormulaExplorer({
  open,
  stageId,
  onStageChange,
  onClose,
  onTileHover,
}: ActorFormulaExplorerProps) {
  const formulaRef = useRef<HTMLDivElement | null>(null);
  const activeStage = useMemo(() => getActorFormulaStage(stageId), [stageId]);

  useEffect(() => {
    if (!open || !formulaRef.current) {
      return;
    }

    formulaRef.current.innerHTML = katex.renderToString(activeStage.formulaTex, {
      throwOnError: false,
      displayMode: true,
    });
  }, [activeStage, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    if (!open) {
      onTileHover?.(null);
    }
  }, [onTileHover, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center rounded-[inherit]">
      <button
        type="button"
        aria-label="Close actor formula explorer"
        className="absolute inset-0 rounded-[inherit] bg-primary/6 backdrop-blur-[1px]"
        onClick={onClose}
      />

      <div className="relative z-10 flex max-h-[88%] w-[min(92%,760px)] flex-col overflow-hidden rounded-3xl border border-base-300 bg-base-100/98 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-base-300/70 px-5 py-4">
          <div>
            <div className="text-sm font-semibold text-primary">Actor Formula Explorer</div>
            <div className="mt-1 text-xs text-base-content/60">
              Teaching view · 16 → 64 → 64 → 4 · 点击 stage 查看 actor 前向过程
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-base-300 bg-base-100 px-3 py-1 text-xs font-semibold text-base-content/70 transition hover:bg-base-200"
          >
            Close
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          <div className="flex flex-wrap gap-2">
            {actorFormulaStages.map((stage, index) => {
              const active = stage.id === activeStage.id;
              return (
                <button
                  key={stage.id}
                  type="button"
                  onClick={() => onStageChange(stage.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    active
                      ? "border-primary bg-primary text-primary-content shadow-sm"
                      : "border-base-300 bg-base-100 text-base-content/75 hover:border-primary/30 hover:bg-primary/5"
                  }`}
                >
                  <span className="mr-1 text-[10px] opacity-75">{index + 1}.</span>
                  {stage.shortLabel}
                </button>
              );
            })}
          </div>

          <div className="mt-4 rounded-2xl border border-primary/15 bg-primary/6 px-4 py-3">
            <div className="text-sm font-semibold text-base-content">{activeStage.title}</div>
            <div className="mt-1 text-sm leading-6 text-base-content/72">{activeStage.narrative}</div>
          </div>

          <div className="mt-4">
            <FormulaExpression tokens={activeStage.expression} onTileHover={onTileHover} />
          </div>

          <div className="mt-4 rounded-2xl border border-base-300 bg-base-100 px-4 py-4">
            <div ref={formulaRef} className="overflow-x-auto text-sm text-base-content/78" />
          </div>
        </div>
      </div>
    </div>
  );
}
