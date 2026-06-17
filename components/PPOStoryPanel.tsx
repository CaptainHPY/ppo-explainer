"use client";

import { type ReactNode } from "react";

import { type HeatmapPhaseId } from "@/lib/stateHeatmap";
import { type NetworkKind, type TrainingPhaseId } from "@/lib/weightMatrix";

export type NarrativeSectionId = "overview" | "phases" | "mapping";

type PhaseCard = {
  id: TrainingPhaseId;
  title: string;
  stepRange: string;
  summary: string;
  evidence: string;
};

type PPOStoryPanelProps = {
  activeSectionId?: NarrativeSectionId;
  onOpenSpiral?: () => void;
  onOpenMatrixWave?: (phaseId: TrainingPhaseId, networkKind: NetworkKind) => void;
  onOpenStateHeatmap?: (phaseId: HeatmapPhaseId) => void;
};

const ppoOverview =
  "PPO 是一种在策略梯度基础上加入裁剪约束的强化学习方法。它通过限制新旧策略比值的变化范围，让策略更新既能继续前进，又不至于一步跨得太猛，因此能在训练速度和稳定性之间取得更舒服的平衡。在这个项目里，Agent 负责展示 actor 和 critic 的网络结构，让读者看到动作分布与状态价值分别从哪里产生；动作采样与环境模块对应一步交互与反馈；PPO Buffer 承接采样轨迹、观察 clip 约束，并把训练稳定性的关键指标组织成可检查的证据。";

const phaseCards: PhaseCard[] = [
  {
    id: "early",
    title: "前期",
    stepRange: "训练 1 - 20000 步",
    summary:
      "策略仍在积极试探，更新幅度相对更大；critic 对回报结构的拟合还比较弱，训练主要处在摸索有效更新方向的阶段。",
    evidence:
      "approx_kl 均值约 0.000713，为三段中最高；clipfrac 仍有可见波动；value_loss 均值约 69.20 最高；explained_variance 均值仅约 0.059，接近 0。",
  },
  {
    id: "middle",
    title: "中期",
    stepRange: "训练 20001 - 40000 步",
    summary:
      "PPO 更新进入更稳的裁剪区间，策略步长明显收敛，critic 开始学到更有用的价值结构，训练节奏趋于平稳。",
    evidence:
      "approx_kl 均值降到约 0.000194；clipfrac 基本为 0；value_loss 均值回落到约 59.83；explained_variance 升至约 0.219。",
  },
  {
    id: "late",
    title: "后期",
    stepRange: "训练 40001 - 100000 步",
    summary:
      "训练进入相对成熟阶段，策略更新保持保守且稳定，critic 的价值估计更可靠，整体优化已经不再依赖大幅策略摆动。",
    evidence:
      "approx_kl 维持低位，均值约 0.000281；clipfrac 仍接近 0；value_loss 进一步降到约 48.32；explained_variance 提升到约 0.324，为三段中最高。",
  },
];

function sectionShellClass(isActive: boolean) {
  return [
    "rounded-[28px] border px-6 py-6 shadow-xl backdrop-blur transition-all duration-500 sm:px-8 sm:py-8",
    isActive
      ? "border-primary/30 bg-base-100/92 shadow-primary/10"
      : "border-base-300/75 bg-base-100/78 shadow-base-content/5",
  ].join(" ");
}

function MatrixWaveTrigger({
  phaseId,
  networkKind,
  onOpen,
}: {
  phaseId: TrainingPhaseId;
  networkKind: NetworkKind;
  onOpen?: (phaseId: TrainingPhaseId, networkKind: NetworkKind) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen?.(phaseId, networkKind)}
      className="rounded-full border border-base-300 bg-base-100 px-3 py-1 text-[11px] font-semibold text-base-content/70 transition hover:border-primary/30 hover:text-primary"
    >
      {networkKind === "actor" ? "Actor" : "Critic"}
    </button>
  );
}

function TopActionButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-base-300 bg-base-100 px-4 py-2 text-sm font-medium text-base-content/75 transition hover:border-primary/30 hover:text-primary"
    >
      {children}
    </button>
  );
}

export default function PPOStoryPanel({
  activeSectionId = "overview",
  onOpenSpiral,
  onOpenMatrixWave,
  onOpenStateHeatmap,
}: PPOStoryPanelProps) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-16">
      <article data-story-section="overview" className={sectionShellClass(activeSectionId === "overview")}>
        <div className="space-y-4">
          <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/80">
            PPO Narrative
          </div>
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold text-base-content sm:text-3xl">PPO 简介</h2>
            <p className="text-sm leading-7 text-base-content/75 sm:text-[15px]">{ppoOverview}</p>
          </div>
        </div>
      </article>

      <article data-story-section="phases" className={sectionShellClass(activeSectionId === "phases")}>
        <div className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-2xl font-semibold text-base-content sm:text-3xl">CartPole 训练三阶段</h3>
                <TopActionButton onClick={() => onOpenStateHeatmap?.("early")}>状态热力图</TopActionButton>
                <TopActionButton onClick={onOpenSpiral}>查看螺旋训练曲线</TopActionButton>
              </div>
              <p className="text-sm leading-6 text-base-content/65">
                这里按当前训练记录里的四个指标做教学分段：approx_kl、clipfrac、value_loss、explained_variance。
              </p>
            </div>

            <span className="rounded-full border border-secondary/20 bg-secondary/10 px-3 py-1 text-xs font-medium text-secondary">
              training view
            </span>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {phaseCards.map((phase) => (
              <article
                key={phase.id}
                className="flex h-full flex-col gap-3 rounded-2xl border border-base-300/80 bg-base-200/55 px-4 py-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                      {phase.title}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <MatrixWaveTrigger phaseId={phase.id} networkKind="actor" onOpen={onOpenMatrixWave} />
                      <MatrixWaveTrigger phaseId={phase.id} networkKind="critic" onOpen={onOpenMatrixWave} />
                    </div>
                  </div>

                  <span className="pt-1 text-[11px] font-medium text-base-content/45">{phase.stepRange}</span>
                </div>

                <p className="text-sm leading-6 text-base-content/78">{phase.summary}</p>

                <div className="rounded-xl border border-base-300/70 bg-base-100/70 px-3 py-3 text-xs leading-5 text-base-content/65">
                  <span className="font-semibold text-base-content/78">指标证据：</span>
                  {phase.evidence}
                </div>
              </article>
            ))}
          </div>
        </div>
      </article>

      <article data-story-section="mapping" className={sectionShellClass(activeSectionId === "mapping")}>
        <div className="space-y-4">
          <div>
            <h3 className="text-2xl font-semibold text-base-content sm:text-3xl">当前可视化怎么读</h3>
            <p className="mt-2 text-sm leading-6 text-base-content/65">
              主界面负责把 PPO 的一次策略更新拆成可阅读的流程：先理解网络结构，再看动作与环境交互，最后回到 Buffer 观察训练稳定性的证据。
            </p>
          </div>

          <div className="rounded-2xl border border-primary/15 bg-primary/7 px-4 py-4 text-sm leading-6 text-base-content/72">
            <span className="font-semibold text-base-content">阅读顺序建议：</span>
            先看顶部原始可视化里的 Agent、动作采样、Environment 和 Buffer，把 PPO 的基本流程串起来；再继续向下阅读，把训练阶段、指标证据和界面模块之间的对应关系补齐。
          </div>
        </div>
      </article>
    </div>
  );
}
