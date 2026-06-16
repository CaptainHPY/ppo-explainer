import frontendWeightData from "@/public/data/ppo_weights_frontend.json";
import summaryWeightData from "@/public/data/ppo_weights_summary.json";

export type TrainingPhaseId = "early" | "middle" | "late";
export type TrainingStep = 51 | 1039 | 2197;
export type WeightCheckpointStep = 20000 | 40000 | 100000;
export type NetworkKind = "actor" | "critic";
export type WeightLayerKey =
  | "obs_fc1"
  | "fc1_bias"
  | "fc1_fc2"
  | "fc2_bias"
  | "fc2_out"
  | "out_bias";

type LayerRecord = {
  name: string;
  shape: number[];
  dtype: string;
  mean: number;
  std: number;
  min: number;
  max: number;
  l1_norm: number;
  l2_norm: number;
  numel: number;
  values: number[] | number[][];
};

type SummaryLayerRecord = Omit<LayerRecord, "values">;

type NetworkSnapshot<TLayer> = {
  source_file?: string;
  file_size_bytes?: number;
  param_count: number;
  raw_param_bytes?: number;
  layers: TLayer[];
};

type StepSnapshot<TLayer> = {
  step: number;
  networks: Record<NetworkKind, NetworkSnapshot<TLayer>>;
};

type FrontendWeightsFile = {
  schema_version: number;
  generated_at: string;
  source_checkpoint_dir: string;
  description: string;
  steps: StepSnapshot<LayerRecord>[];
};

type SummaryWeightsFile = {
  schema_version: number;
  generated_at: string;
  source_checkpoint_dir: string;
  description: string;
  steps: StepSnapshot<SummaryLayerRecord>[];
};

export type MatrixWaveModalState = {
  phaseId: TrainingPhaseId;
  networkKind: NetworkKind;
} | null;

export type MatrixWaveStats = {
  label: string;
  shape: number[];
  shapeLabel: string;
  mean: number;
  std: number;
  min: number;
  max: number;
  l1Norm: number;
  l2Norm: number;
  numel: number;
};

export type MatrixWaveSegmentData = MatrixWaveStats & {
  key: Extract<WeightLayerKey, "obs_fc1" | "fc1_fc2" | "fc2_out">;
  values: number[][];
  visualSourceWidth: number;
  visualTargetWidth: number;
};

export type MatrixWaveBiasStripData = MatrixWaveStats & {
  key: Extract<WeightLayerKey, "fc1_bias" | "fc2_bias" | "out_bias">;
  values: number[][];
  visualWidth: number;
};

export type NetworkMatrixWaveData = {
  networkKind: NetworkKind;
  networkTitle: string;
  phaseId: TrainingPhaseId;
  phaseLabel: string;
  step: TrainingStep;
  checkpointStep: WeightCheckpointStep;
  structureLabel: string;
  description: string;
  paramCount: number;
  strongestLayerLabel: string;
  strongestLayerL2: number;
  strongestLayerStd: number;
  colorDomain: number;
  segments: MatrixWaveSegmentData[];
  biases: MatrixWaveBiasStripData[];
};

const PHASE_TO_STEP: Record<TrainingPhaseId, TrainingStep> = {
  early: 51,
  middle: 1039,
  late: 2197,
};

const PHASE_TO_CHECKPOINT_STEP: Record<TrainingPhaseId, WeightCheckpointStep> = {
  early: 20000,
  middle: 40000,
  late: 100000,
};

const PHASE_LABEL: Record<TrainingPhaseId, string> = {
  early: "前期",
  middle: "中期",
  late: "后期",
};

const NETWORK_TITLE: Record<NetworkKind, string> = {
  actor: "Actor",
  critic: "Critic",
};

const NETWORK_STRUCTURE: Record<NetworkKind, string> = {
  actor: "4 -> 64 -> 64 -> 2",
  critic: "4 -> 64 -> 64 -> 1",
};

const VISUAL_MIN_BAND_WIDTH = 14;

function normalizeMatrix(values: number[] | number[][]): number[][] {
  if (Array.isArray(values[0])) {
    return values as number[][];
  }
  return [values as number[]];
}

function findStep<TLayer>(steps: StepSnapshot<TLayer>[], step: number) {
  const found = steps.find((entry) => entry.step === step);
  if (!found) {
    throw new Error(`Missing step ${step} in weight data.`);
  }
  return found;
}

function layerShapeLabel(shape: number[]) {
  return shape.join(" x ");
}

function matrixAbsMax(values: number[][]) {
  let current = 0;
  for (const row of values) {
    for (const value of row) {
      current = Math.max(current, Math.abs(value));
    }
  }
  return current;
}

function visualBandWidth(dimension: number) {
  return Math.max(dimension, VISUAL_MIN_BAND_WIDTH);
}

function findLayer<TLayer extends { name: string }>(layers: TLayer[], name: string) {
  const found = layers.find((layer) => layer.name === name);
  if (!found) {
    throw new Error(`Missing layer ${name} in weight data.`);
  }
  return found;
}

function toStats(layer: SummaryLayerRecord, label: string): MatrixWaveStats {
  return {
    label,
    shape: layer.shape,
    shapeLabel: layerShapeLabel(layer.shape),
    mean: layer.mean,
    std: layer.std,
    min: layer.min,
    max: layer.max,
    l1Norm: layer.l1_norm,
    l2Norm: layer.l2_norm,
    numel: layer.numel,
  };
}

function buildSegment(
  key: MatrixWaveSegmentData["key"],
  label: string,
  frontendLayer: LayerRecord,
  summaryLayer: SummaryLayerRecord,
): MatrixWaveSegmentData {
  const values = normalizeMatrix(frontendLayer.values);
  return {
    key,
    values,
    visualSourceWidth: visualBandWidth(values[0]?.length ?? 0),
    visualTargetWidth: visualBandWidth(values.length),
    ...toStats(summaryLayer, label),
  };
}

function buildBias(
  key: MatrixWaveBiasStripData["key"],
  label: string,
  frontendLayer: LayerRecord,
  summaryLayer: SummaryLayerRecord,
): MatrixWaveBiasStripData {
  const values = normalizeMatrix(frontendLayer.values);
  return {
    key,
    values,
    visualWidth: visualBandWidth(values[0]?.length ?? 0),
    ...toStats(summaryLayer, label),
  };
}

export function loadWeightData() {
  return {
    frontend: frontendWeightData as FrontendWeightsFile,
    summary: summaryWeightData as SummaryWeightsFile,
  };
}

export function getPhaseLabel(phaseId: TrainingPhaseId) {
  return PHASE_LABEL[phaseId];
}

export function getPhaseStep(phaseId: TrainingPhaseId) {
  return PHASE_TO_STEP[phaseId];
}

export function buildNetworkMatrixWaveData(
  phaseId: TrainingPhaseId,
  networkKind: NetworkKind,
  frontend: FrontendWeightsFile,
  summary: SummaryWeightsFile,
): NetworkMatrixWaveData {
  const step = PHASE_TO_STEP[phaseId];
  const checkpointStep = PHASE_TO_CHECKPOINT_STEP[phaseId];
  const frontendStep = findStep(frontend.steps, checkpointStep);
  const summaryStep = findStep(summary.steps, checkpointStep);
  const frontendNetwork = frontendStep.networks[networkKind];
  const summaryNetwork = summaryStep.networks[networkKind];

  const frontendFc1Weight = findLayer(frontendNetwork.layers, "0.weight");
  const frontendFc1Bias = findLayer(frontendNetwork.layers, "0.bias");
  const frontendFc2Weight = findLayer(frontendNetwork.layers, "2.weight");
  const frontendFc2Bias = findLayer(frontendNetwork.layers, "2.bias");
  const frontendOutWeight = findLayer(frontendNetwork.layers, "4.weight");
  const frontendOutBias = findLayer(frontendNetwork.layers, "4.bias");

  const summaryFc1Weight = findLayer(summaryNetwork.layers, "0.weight");
  const summaryFc1Bias = findLayer(summaryNetwork.layers, "0.bias");
  const summaryFc2Weight = findLayer(summaryNetwork.layers, "2.weight");
  const summaryFc2Bias = findLayer(summaryNetwork.layers, "2.bias");
  const summaryOutWeight = findLayer(summaryNetwork.layers, "4.weight");
  const summaryOutBias = findLayer(summaryNetwork.layers, "4.bias");

  const segments: MatrixWaveSegmentData[] = [
    buildSegment("obs_fc1", "输入层 × fc1", frontendFc1Weight, summaryFc1Weight),
    buildSegment("fc1_fc2", "fc1 × fc2", frontendFc2Weight, summaryFc2Weight),
    buildSegment("fc2_out", "fc2 × 输出层", frontendOutWeight, summaryOutWeight),
  ];

  const biases: MatrixWaveBiasStripData[] = [
    buildBias("fc1_bias", "fc1 bias", frontendFc1Bias, summaryFc1Bias),
    buildBias("fc2_bias", "fc2 bias", frontendFc2Bias, summaryFc2Bias),
    buildBias("out_bias", "输出层 bias", frontendOutBias, summaryOutBias),
  ];

  const colorDomain = Math.max(
    1,
    ...segments.map((segment) => matrixAbsMax(segment.values)),
    ...biases.map((bias) => matrixAbsMax(bias.values)),
  );

  const strongestLayer = [...segments, ...biases].reduce((best, current) => (current.l2Norm > best.l2Norm ? current : best));

  return {
    networkKind,
    networkTitle: NETWORK_TITLE[networkKind],
    phaseId,
    phaseLabel: PHASE_LABEL[phaseId],
    step,
    checkpointStep,
    structureLabel: NETWORK_STRUCTURE[networkKind],
    description: `${PHASE_LABEL[phaseId]}对应训练 ${step} 步的 ${NETWORK_TITLE[networkKind]} 网络权重状态。`,
    paramCount: frontendNetwork.param_count,
    strongestLayerLabel: strongestLayer.label,
    strongestLayerL2: strongestLayer.l2Norm,
    strongestLayerStd: strongestLayer.std,
    colorDomain,
    segments,
    biases,
  };
}
