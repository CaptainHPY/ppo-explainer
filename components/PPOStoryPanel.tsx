"use client";

export type NarrativeSectionId = "overview" | "phases" | "mapping";

type PhaseCard = {
  id: string;
  title: string;
  stepRange: string;
  summary: string;
  evidence: string;
};

type ModuleMapping = {
  title: string;
  detail: string;
};

type PPOStoryPanelProps = {
  activeSectionId?: NarrativeSectionId;
};

const ppoOverview = [
  "PPO 是一种在策略梯度基础上加入裁剪约束的强化学习方法。它通过限制新旧策略比值的变化范围，让策略更新既能继续前进，又不至于一步跨得太猛，因此在训练速度和稳定性之间取得了更舒服的平衡。",
  "在这个项目里，Actor 负责根据当前状态输出动作分布，Critic 负责估计状态价值 V(s)。采样得到的状态、动作和奖励会被送入 PPO Buffer，再结合裁剪约束完成多轮更新。",
];

const phaseCards: PhaseCard[] = [
  {
    id: "early",
    title: "前期",
    stepRange: "Step 51 - 1028",
    summary:
      "策略仍在积极试探，更新幅度相对更大；critic 对回报结构的拟合还比较弱，训练主要处在摸索有效更新方向的阶段。",
    evidence:
      "approx_kl 均值约 0.000713，为三段中最高；clipfrac 仍有可见波动；value_loss 均值约 69.20 最高；explained_variance 均值仅约 0.059，接近 0。",
  },
  {
    id: "middle",
    title: "中期",
    stepRange: "Step 1039 - 1638",
    summary:
      "PPO 更新进入更稳的裁剪区间，策略步长明显收敛；critic 开始学到更有用的价值结构，训练节奏趋于平稳。",
    evidence:
      "approx_kl 均值降到约 0.000194；clipfrac 基本为 0；value_loss 均值回落到约 59.83；explained_variance 升至约 0.219。",
  },
  {
    id: "late",
    title: "后期",
    stepRange: "Step 1649 - 2197",
    summary:
      "训练进入相对成熟阶段，策略更新保持保守且稳定；critic 的价值估计更可靠，整体优化已经不再依赖大幅策略摆动。",
    evidence:
      "approx_kl 维持低位，均值约 0.000281；clipfrac 仍接近 0；value_loss 进一步降到约 48.32；explained_variance 提升到约 0.324，为三段中最高。",
  },
];

const moduleMappings: ModuleMapping[] = [
  {
    title: "Agent",
    detail: "展示 actor 和 critic 的网络结构，让读者看到动作分布与状态价值分别从哪里产生。",
  },
  {
    title: "Action",
    detail: "把 actor 输出的 logits 转成动作概率分布，并展示最终被采样执行的动作。",
  },
  {
    title: "Environment",
    detail: "对应 CartPole 的状态转移与奖励反馈，是整条训练信号链条的外部来源。",
  },
  {
    title: "PPO Buffer",
    detail: "承接采样轨迹、观察 clip 约束，并把训练稳定性的关键指标组织成可检查的证据。",
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

export default function PPOStoryPanel({ activeSectionId = "overview" }: PPOStoryPanelProps) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-16">
      <article
        data-story-section="overview"
        className={sectionShellClass(activeSectionId === "overview")}
      >
        <div className="space-y-4">
          <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/80">
            PPO Narrative
          </div>
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold text-base-content sm:text-3xl">PPO 简介</h2>
            <div className="space-y-3 text-sm leading-7 text-base-content/75 sm:text-[15px]">
              {ppoOverview.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </div>
        </div>
      </article>

      <article
        data-story-section="phases"
        className={sectionShellClass(activeSectionId === "phases")}
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-2xl font-semibold text-base-content sm:text-3xl">CartPole 训练三阶段</h3>
              <p className="mt-2 text-sm leading-6 text-base-content/65">
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
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    {phase.title}
                  </span>
                  <span className="text-[11px] font-medium text-base-content/45">{phase.stepRange}</span>
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

      <article
        data-story-section="mapping"
        className={sectionShellClass(activeSectionId === "mapping")}
      >
        <div className="space-y-4">
          <div>
            <h3 className="text-2xl font-semibold text-base-content sm:text-3xl">这套可视化在讲什么</h3>
            <p className="mt-2 text-sm leading-6 text-base-content/65">
              主界面负责把 PPO 的一次策略更新拆成可阅读的流程：先理解网络结构，再看动作与环境交互，最后回到 Buffer 观察训练稳定性的证据。
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {moduleMappings.map((item) => (
              <article
                key={item.title}
                className="rounded-2xl border border-base-300/80 bg-base-200/45 px-4 py-4"
              >
                <h4 className="text-sm font-semibold text-base-content">{item.title}</h4>
                <p className="mt-2 text-sm leading-6 text-base-content/72">{item.detail}</p>
              </article>
            ))}
          </div>

          <div className="rounded-2xl border border-primary/15 bg-primary/7 px-4 py-4 text-sm leading-6 text-base-content/72">
            <span className="font-semibold text-base-content">阅读顺序建议：</span>
            先看顶部原始可视化里的 Agent、Action、Environment 和 Buffer，把 PPO 的基本流程串起来；再继续向下阅读，把训练阶段、指标证据和界面模块之间的对应关系补齐。
          </div>
        </div>
      </article>
    </div>
  );
}
