import advantageAnalysisData from "@/public/data/ppo_advantage_analysis.json";

export type AdvantagePhaseId = "early" | "middle" | "late";
export type AdvantageViewKey = "histogram" | "scatter";

type SummaryStats = {
  count: number;
  mean: number | null;
  std: number | null;
  min: number | null;
  max: number | null;
};

type AdvantageSampleJson = {
  step: number;
  update_idx: number;
  advantage: number;
  return: number;
  value: number;
  prediction_error: number;
};

type MinibatchSummaryJson = {
  update_idx: number;
  epoch_idx: number;
  minibatch_idx: number;
  sample_count: number;
  advantage_mean: number;
  advantage_std: number;
  return_mean: number;
  value_mean: number;
  prediction_error_mean: number;
  prediction_error_std: number;
};

type AdvantagePhaseJson = {
  phase_id: AdvantagePhaseId;
  label?: string;
  step_start: number;
  step_end: number;
  sample_count: number;
  samples: AdvantageSampleJson[];
  summary: {
    advantage: SummaryStats;
    return: SummaryStats;
    value: SummaryStats;
    prediction_error: SummaryStats;
  };
  minibatches: MinibatchSummaryJson[];
};

type AdvantageAnalysisJson = {
  schema_version: number;
  env_id: string;
  run_name: string;
  total_timesteps: number;
  network_architecture: {
    actor: string;
    critic: string;
  };
  phase_steps: number[];
  phases: AdvantagePhaseJson[];
};

export type AdvantageSample = {
  step: number;
  updateIdx: number;
  advantage: number;
  returnValue: number;
  value: number;
  predictionError: number;
};

export type MinibatchSummary = {
  updateIdx: number;
  epochIdx: number;
  minibatchIdx: number;
  sampleCount: number;
  advantageMean: number;
  advantageStd: number;
  returnMean: number;
  valueMean: number;
  predictionErrorMean: number;
  predictionErrorStd: number;
};

export type AdvantagePhaseData = {
  phaseId: AdvantagePhaseId;
  label: string;
  stepStart: number;
  stepEnd: number;
  sampleCount: number;
  samples: AdvantageSample[];
  summary: {
    advantage: SummaryStats;
    return: SummaryStats;
    value: SummaryStats;
    predictionError: SummaryStats;
  };
  minibatches: MinibatchSummary[];
};

export type AdvantageDataset = {
  envId: string;
  runName: string;
  totalTimesteps: number;
  networkArchitecture: {
    actor: string;
    critic: string;
  };
  phaseSteps: number[];
  phases: Record<AdvantagePhaseId, AdvantagePhaseData>;
};

const PHASE_LABELS: Record<AdvantagePhaseId, string> = {
  early: "前期",
  middle: "中期",
  late: "后期",
};

export const ADVANTAGE_VIEWS: Array<{ value: AdvantageViewKey; label: string }> = [
  { value: "histogram", label: "Advantage 分布" },
  { value: "scatter", label: "Return vs Value" },
];

function mapPhase(phase: AdvantagePhaseJson): AdvantagePhaseData {
  return {
    phaseId: phase.phase_id,
    label: PHASE_LABELS[phase.phase_id],
    stepStart: phase.step_start,
    stepEnd: phase.step_end,
    sampleCount: phase.sample_count,
    samples: phase.samples.map((sample) => ({
      step: sample.step,
      updateIdx: sample.update_idx,
      advantage: sample.advantage,
      returnValue: sample.return,
      value: sample.value,
      predictionError: sample.prediction_error,
    })),
    summary: {
      advantage: phase.summary.advantage,
      return: phase.summary.return,
      value: phase.summary.value,
      predictionError: phase.summary.prediction_error,
    },
    minibatches: phase.minibatches.map((item) => ({
      updateIdx: item.update_idx,
      epochIdx: item.epoch_idx,
      minibatchIdx: item.minibatch_idx,
      sampleCount: item.sample_count,
      advantageMean: item.advantage_mean,
      advantageStd: item.advantage_std,
      returnMean: item.return_mean,
      valueMean: item.value_mean,
      predictionErrorMean: item.prediction_error_mean,
      predictionErrorStd: item.prediction_error_std,
    })),
  };
}

export function loadAdvantageDataset(): AdvantageDataset {
  const json = advantageAnalysisData as AdvantageAnalysisJson;
  const phases = Object.fromEntries(json.phases.map((phase) => [phase.phase_id, mapPhase(phase)])) as Record<
    AdvantagePhaseId,
    AdvantagePhaseData
  >;

  return {
    envId: json.env_id,
    runName: json.run_name,
    totalTimesteps: json.total_timesteps,
    networkArchitecture: json.network_architecture,
    phaseSteps: json.phase_steps,
    phases,
  };
}

export function getAdvantagePhaseLabel(phaseId: AdvantagePhaseId) {
  return PHASE_LABELS[phaseId];
}
