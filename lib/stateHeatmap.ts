import heatmapData from "@/public/data/ppo_state_heatmaps.json";

export type HeatmapPhaseId = "early" | "middle" | "late";
export type HeatmapMetricKey =
  | "visit_count"
  | "value_mean"
  | "policy_right_prob_mean"
  | "action_right_rate"
  | "failure_rate";

type HeatmapAxis = { dim: number; label: string };

type HeatmapAxes = {
  x: HeatmapAxis;
  y: HeatmapAxis;
};

type HeatmapBinning = {
  bins_x: number;
  bins_y: number;
  x_min: number;
  x_max: number;
  y_min: number;
  y_max: number;
};

type HeatmapPhaseJson = {
  phase_id: HeatmapPhaseId;
  label?: string;
  step_start: number;
  step_end: number;
  sample_count: number;
  grids: Record<HeatmapMetricKey, Array<Array<number | null>>>;
};

type HeatmapJson = {
  schema_version: number;
  env_id: string;
  run_name: string;
  total_timesteps: number;
  network_architecture: {
    actor: string;
    critic: string;
  };
  axes: HeatmapAxes;
  binning: HeatmapBinning;
  phase_steps: number[];
  phases: HeatmapPhaseJson[];
};

export type HeatmapMetricDefinition = {
  key: HeatmapMetricKey;
  label: string;
  description: string;
  palette: "sequential" | "diverging";
  fixedDomain?: [number, number];
};

export type HeatmapPhaseData = {
  phaseId: HeatmapPhaseId;
  label: string;
  stepStart: number;
  stepEnd: number;
  sampleCount: number;
  grids: Record<HeatmapMetricKey, Array<Array<number | null>>>;
};

export type HeatmapDataset = {
  envId: string;
  runName: string;
  totalTimesteps: number;
  axes: HeatmapAxes;
  binning: HeatmapBinning;
  phaseSteps: number[];
  phases: Record<HeatmapPhaseId, HeatmapPhaseData>;
};

const PHASE_LABELS: Record<HeatmapPhaseId, string> = {
  early: "前期",
  middle: "中期",
  late: "后期",
};

export const HEATMAP_METRICS: HeatmapMetricDefinition[] = [
  {
    key: "visit_count",
    label: "访问次数",
    description: "状态落入该网格的访问密度。",
    palette: "sequential",
  },
  {
    key: "value_mean",
    label: "Value 均值",
    description: "Critic 对该网格状态的平均价值估计。",
    palette: "diverging",
  },
  {
    key: "policy_right_prob_mean",
    label: "策略右移概率",
    description: "Actor 在该网格下给出 right 动作的平均概率。",
    palette: "sequential",
    fixedDomain: [0, 1],
  },
  {
    key: "action_right_rate",
    label: "实际右移动作率",
    description: "训练采样中实际执行 right 动作的频率。",
    palette: "sequential",
    fixedDomain: [0, 1],
  },
  {
    key: "failure_rate",
    label: "失败率",
    description: "从该网格出发一步后终止的比例。",
    palette: "sequential",
    fixedDomain: [0, 1],
  },
];

function buildPhaseMap(phases: HeatmapPhaseJson[]) {
  const map = {} as Record<HeatmapPhaseId, HeatmapPhaseData>;
  for (const phase of phases) {
    map[phase.phase_id] = {
      phaseId: phase.phase_id,
      label: PHASE_LABELS[phase.phase_id],
      stepStart: phase.step_start,
      stepEnd: phase.step_end,
      sampleCount: phase.sample_count,
      grids: phase.grids,
    };
  }
  return map;
}

export function loadStateHeatmapDataset(): HeatmapDataset {
  const json = heatmapData as HeatmapJson;
  return {
    envId: json.env_id,
    runName: json.run_name,
    totalTimesteps: json.total_timesteps,
    axes: json.axes,
    binning: json.binning,
    phaseSteps: json.phase_steps,
    phases: buildPhaseMap(json.phases),
  };
}

export function getHeatmapMetricDefinition(metricKey: HeatmapMetricKey) {
  const metric = HEATMAP_METRICS.find((item) => item.key === metricKey);
  if (!metric) {
    throw new Error(`Unknown heatmap metric: ${metricKey}`);
  }
  return metric;
}

export function getHeatmapMetricDomain(
  dataset: HeatmapDataset,
  metricKey: HeatmapMetricKey,
): [number, number] {
  const metric = getHeatmapMetricDefinition(metricKey);
  if (metric.fixedDomain) {
    return metric.fixedDomain;
  }

  if (metricKey === "value_mean") {
    let maxAbs = 0;
    for (const phaseId of Object.keys(dataset.phases) as HeatmapPhaseId[]) {
      for (const row of dataset.phases[phaseId].grids.value_mean) {
        for (const value of row) {
          if (value === null) continue;
          maxAbs = Math.max(maxAbs, Math.abs(value));
        }
      }
    }
    return [-maxAbs, maxAbs];
  }

  let maxValue = 0;
  for (const phaseId of Object.keys(dataset.phases) as HeatmapPhaseId[]) {
    for (const row of dataset.phases[phaseId].grids[metricKey]) {
      for (const value of row) {
        if (value === null) continue;
        maxValue = Math.max(maxValue, value);
      }
    }
  }
  return [0, maxValue];
}
