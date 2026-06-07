"use client";

import { useEffect, useRef, useState } from "react";
import katex from "katex";

import { useMetricSeries } from "@/hooks/useMetricSeries";
import {
  explainMetricValue,
  findClosestMetricPoint,
  formatMetricValue,
  summarizePolicyStability,
} from "@/lib/metrics";
import DiagnosticsModal from "@/components/metrics/DiagnosticsModal";
import MetricMiniChart from "@/components/metrics/MetricMiniChart";

type MetricHoverState = {
  metricId: string;
  step: number;
} | null;

export default function Buffer({ expanded }: { expanded: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [hoverState, setHoverState] = useState<MetricHoverState>(null);

  const approxKl = useMetricSeries("/data/approx_kl.csv");
  const clipfrac = useMetricSeries("/data/clipfrac.csv");

  useEffect(() => {
    if (!ref.current) return;
    try {
      const tex = String.raw`r_t(\theta)=\frac{\pi_{\theta}(a\mid s)}{\pi_{\theta_{\mathrm{old}}}(a\mid s)}`;
      ref.current.innerHTML = katex.renderToString(tex, { throwOnError: false });
    } catch {
      ref.current.textContent = "r_t(theta) = pi_theta(a|s) / pi_old(a|s)";
    }
  }, []);

  const selectedStep = hoverState?.step ?? null;
  const activeApproxKlPoint = findClosestMetricPoint(
    approxKl.data,
    selectedStep ?? approxKl.data[approxKl.data.length - 1]?.step ?? null,
  );
  const activeClipfracPoint = findClosestMetricPoint(
    clipfrac.data,
    selectedStep ?? clipfrac.data[clipfrac.data.length - 1]?.step ?? null,
  );
  const diagnosticsLoading = approxKl.isLoading || clipfrac.isLoading;
  const diagnosticsError = approxKl.error ?? clipfrac.error;
  const stabilitySummary = summarizePolicyStability(activeApproxKlPoint, activeClipfracPoint);
  const summaryToneClass =
    stabilitySummary.tone === "stable"
      ? "bg-success/15 text-success"
      : stabilitySummary.tone === "watch"
        ? "bg-warning/15 text-warning"
        : "bg-error/15 text-error";

  function closeDiagnostics() {
    setShowDiagnostics(false);
    setHoverState(null);
  }

  const interpretation =
    hoverState?.metricId === "approx_kl" && activeApproxKlPoint
      ? explainMetricValue("approx_kl", activeApproxKlPoint.value)
      : hoverState?.metricId === "clipfrac" && activeClipfracPoint
        ? explainMetricValue("clipfrac", activeClipfracPoint.value)
        : stabilitySummary.detail;

  return (
    <>
      <div
        className="-ml-196 mt-4 rounded-2xl border-2 border-secondary bg-secondary/10 px-6 py-5 shadow-md"
        style={{ width: expanded ? 840 : 860, height: expanded ? 540 : 318 }}
      >
        <div className={`flex h-full flex-col gap-3 ${expanded ? "pt-16" : "pt-1"}`}>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowDiagnostics(true)}
              className="absolute right-0 top-0 rounded-full border border-secondary/30 bg-secondary/10 px-3 py-1 text-xs font-semibold text-secondary transition hover:bg-secondary/15"
            >
              Click to inspect
            </button>

            <div className="mx-auto flex max-w-[540px] flex-col items-center gap-2 px-4 text-center">
              <h3 className="text-sm font-semibold text-secondary">PPO Buffer</h3>
              <p className="text-xs text-base-content/60">存储若干条（状态、动作、奖励、下一状态）元组</p>
              <p className="text-xs text-base-content/60">使用 PPO 裁剪约束策略更新幅度，保持训练稳定</p>
            </div>
          </div>

          <div className="rounded-xl border border-secondary/25 bg-base-100/70 px-4 py-4 shadow-sm">
            <div className="mb-2 flex items-start justify-between gap-4 text-[11px] font-medium">
              <span className="pt-1 text-secondary">PPO Clip</span>
              <div
                ref={ref}
                className="shrink-0 text-xs text-base-content/70 [&_.katex]:text-[0.95rem]"
                aria-hidden="false"
              />
            </div>

            <svg viewBox="0 0 360 120" className="h-28 w-full" aria-hidden="true">
              <line
                x1="24"
                y1="58"
                x2="336"
                y2="58"
                stroke="var(--color-secondary)"
                strokeOpacity="0.35"
                strokeWidth="2"
              />

              <rect
                x="120"
                y="44"
                width="120"
                height="28"
                rx="14"
                fill="var(--color-secondary)"
                fillOpacity="0.12"
                stroke="var(--color-secondary)"
                strokeDasharray="4 4"
                strokeOpacity="0.55"
              />

              <line
                x1="120"
                y1="34"
                x2="120"
                y2="82"
                stroke="var(--color-secondary)"
                strokeOpacity="0.45"
                strokeWidth="2"
              />
              <line
                x1="240"
                y1="34"
                x2="240"
                y2="82"
                stroke="var(--color-secondary)"
                strokeOpacity="0.45"
                strokeWidth="2"
              />

              <circle cx="164" cy="58" r="8" fill="var(--color-secondary)" fillOpacity="0.9" />
              <circle cx="286" cy="58" r="8" fill="var(--color-accent)" fillOpacity="0.95" />

              <line
                x1="164"
                y1="58"
                x2="286"
                y2="58"
                stroke="var(--color-accent)"
                strokeWidth="3"
                strokeDasharray="6 5"
              />

              <text x="113" y="26" fill="var(--color-base-content)" fillOpacity="0.7" fontSize="11">
                1-e
              </text>
              <text x="173" y="26" fill="var(--color-base-content)" fillOpacity="0.7" fontSize="11">
                1.0
              </text>
              <text x="232" y="26" fill="var(--color-base-content)" fillOpacity="0.7" fontSize="11">
                1+e
              </text>
              <text x="150" y="96" fill="var(--color-base-content)" fillOpacity="0.72" fontSize="11">
                old policy
              </text>
              <text x="264" y="96" fill="var(--color-base-content)" fillOpacity="0.72" fontSize="11">
                new policy
              </text>
              <text x="250" y="52" fill="var(--color-accent)" fillOpacity="0.95" fontSize="11">
                clip
              </text>
            </svg>
          </div>
        </div>
      </div>

      <DiagnosticsModal
        open={showDiagnostics}
        onClose={closeDiagnostics}
        title="Buffer diagnostics"
        subtitle={hoverState ? `Step ${hoverState.step}` : "Inspect how PPO clipping keeps policy updates stable."}
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1 text-xs text-base-content/70">
              <div>
                <span className="font-semibold text-secondary">approx_kl:</span>{" "}
                {activeApproxKlPoint ? formatMetricValue("approx_kl", activeApproxKlPoint.value) : "--"}
              </div>
              <div>
                <span className="font-semibold text-accent">clipfrac:</span>{" "}
                {activeClipfracPoint ? formatMetricValue("clipfrac", activeClipfracPoint.value) : "--"}
              </div>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${summaryToneClass}`}>
              {stabilitySummary.label}
            </span>
          </div>

          {diagnosticsLoading ? (
            <div className="rounded-xl border border-dashed border-secondary/25 bg-secondary/5 px-4 py-8 text-sm text-base-content/65">
              Loading buffer diagnostics...
            </div>
          ) : diagnosticsError ? (
            <div className="rounded-xl border border-dashed border-error/25 bg-error/5 px-4 py-8 text-sm text-error">
              Failed to load buffer diagnostics: {diagnosticsError}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3">
                <MetricMiniChart
                  metricId="approx_kl"
                  title="approx_kl"
                  color="var(--color-secondary)"
                  data={approxKl.data}
                  hoverState={hoverState}
                  onHoverChange={setHoverState}
                  valueFormatter={(value) => formatMetricValue("approx_kl", value)}
                  referenceValue={0.01}
                  referenceLabel="large step"
                  isEmphasized={hoverState?.metricId === "approx_kl"}
                />
                <MetricMiniChart
                  metricId="clipfrac"
                  title="clipfrac"
                  color="var(--color-accent)"
                  data={clipfrac.data}
                  hoverState={hoverState}
                  onHoverChange={setHoverState}
                  valueFormatter={(value) => formatMetricValue("clipfrac", value)}
                  referenceValue={0.1}
                  referenceLabel="heavy clip"
                  isEmphasized={hoverState?.metricId === "clipfrac"}
                />
              </div>

              <div className="rounded-xl border border-secondary/15 bg-secondary/8 px-4 py-3 text-sm text-base-content/75">
                {interpretation}
              </div>
            </div>
          )}
        </div>
      </DiagnosticsModal>
    </>
  );
}
