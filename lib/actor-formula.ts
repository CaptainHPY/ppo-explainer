"use client";

export type ActorFormulaStageId =
  | "obs"
  | "fc1_linear"
  | "fc1_activation"
  | "fc2_linear"
  | "fc2_activation"
  | "logits"
  | "policy_sample";

export type ActorFormulaLayerTarget = "obs" | "actor_fc1" | "actor_fc2" | "actor_logits";

export type ActorFormulaRouteId = "shared_actor" | "actor_fc1_fc2" | "actor_fc2_logits";

export type ActorHighlightTargets = {
  layers?: ActorFormulaLayerTarget[];
  routes?: ActorFormulaRouteId[];
};

export type TensorKind = "vector" | "matrix" | "bias" | "probabilities" | "action";

export type TensorTileSpec = {
  id: string;
  kind: TensorKind;
  label: string;
  shape: string;
  values?: number[] | number[][];
  highlightTargets: ActorHighlightTargets;
  selectedIndex?: number;
  actionLabels?: string[];
};

export type ActorFormulaExpressionToken =
  | {
      type: "tile";
      tile: TensorTileSpec;
    }
  | {
      type: "operator";
      label: string;
      tone?: "default" | "soft";
    };

export type ActorFormulaStage = {
  id: ActorFormulaStageId;
  title: string;
  shortLabel: string;
  formulaTex: string;
  narrative: string;
  highlightTargets: ActorHighlightTargets;
  expression: ActorFormulaExpressionToken[];
};

function makeVector(length: number, seed: number, amplitude = 1) {
  return Array.from({ length }, (_, index) => {
    const angle = seed * 0.73 + index * 0.91;
    const wave = Math.sin(angle) * 0.65 + Math.cos(angle * 0.63) * 0.35;
    return Number((wave * amplitude).toFixed(3));
  });
}

function makeProbabilities(length: number, seed: number) {
  const raw = Array.from({ length }, (_, index) => {
    const angle = seed * 0.41 + index * 0.87;
    return Math.max(0.08, 0.8 + Math.sin(angle) * 0.35 + Math.cos(angle * 1.2) * 0.2);
  });
  const sum = raw.reduce((total, value) => total + value, 0);
  return raw.map((value) => Number((value / sum).toFixed(4)));
}

function makeMatrix(rows: number, cols: number, seed: number) {
  return Array.from({ length: rows }, (_, rowIndex) =>
    Array.from({ length: cols }, (_, colIndex) => {
      const angle = seed * 0.37 + rowIndex * 0.59 + colIndex * 0.23;
      const wave = Math.sin(angle) * 0.72 + Math.cos(angle * 1.31) * 0.28;
      return Number(wave.toFixed(3));
    }),
  );
}

const obsTile: TensorTileSpec = {
  id: "obs",
  kind: "vector",
  label: "输入观测 s",
  shape: "(16)",
  values: makeVector(16, 1.2, 0.95),
  highlightTargets: {
    layers: ["obs"],
    routes: ["shared_actor"],
  },
};

const w1Tile: TensorTileSpec = {
  id: "w1",
  kind: "matrix",
  label: "Actor fc1 权重",
  shape: "(64, 16)",
  values: makeMatrix(12, 16, 2.4),
  highlightTargets: {
    layers: ["actor_fc1"],
    routes: ["shared_actor"],
  },
};

const b1Tile: TensorTileSpec = {
  id: "b1",
  kind: "bias",
  label: "Actor fc1 bias",
  shape: "(64)",
  values: makeVector(16, 3.6, 0.55),
  highlightTargets: {
    layers: ["actor_fc1"],
    routes: ["shared_actor"],
  },
};

const u1Tile: TensorTileSpec = {
  id: "u1",
  kind: "vector",
  label: "预激活 u^(1)",
  shape: "(64)",
  values: makeVector(16, 4.8, 1),
  highlightTargets: {
    layers: ["actor_fc1"],
    routes: ["shared_actor"],
  },
};

const h1Tile: TensorTileSpec = {
  id: "h1",
  kind: "vector",
  label: "隐藏表示 h^(1)",
  shape: "(64)",
  values: makeVector(16, 5.7, 0.85),
  highlightTargets: {
    layers: ["actor_fc1"],
    routes: ["shared_actor"],
  },
};

const w2Tile: TensorTileSpec = {
  id: "w2",
  kind: "matrix",
  label: "Actor fc2 权重",
  shape: "(64, 64)",
  values: makeMatrix(12, 16, 6.3),
  highlightTargets: {
    layers: ["actor_fc2"],
    routes: ["actor_fc1_fc2"],
  },
};

const b2Tile: TensorTileSpec = {
  id: "b2",
  kind: "bias",
  label: "Actor fc2 bias",
  shape: "(64)",
  values: makeVector(16, 7.1, 0.45),
  highlightTargets: {
    layers: ["actor_fc2"],
    routes: ["actor_fc1_fc2"],
  },
};

const u2Tile: TensorTileSpec = {
  id: "u2",
  kind: "vector",
  label: "预激活 u^(2)",
  shape: "(64)",
  values: makeVector(16, 8.2, 1.1),
  highlightTargets: {
    layers: ["actor_fc2"],
    routes: ["actor_fc1_fc2"],
  },
};

const h2Tile: TensorTileSpec = {
  id: "h2",
  kind: "vector",
  label: "隐藏表示 h^(2)",
  shape: "(64)",
  values: makeVector(16, 9.4, 0.88),
  highlightTargets: {
    layers: ["actor_fc2"],
    routes: ["actor_fc1_fc2"],
  },
};

const wpTile: TensorTileSpec = {
  id: "wp",
  kind: "matrix",
  label: "策略头权重 W^(pi)",
  shape: "(4, 64)",
  values: makeMatrix(4, 16, 10.1),
  highlightTargets: {
    layers: ["actor_logits"],
    routes: ["actor_fc2_logits"],
  },
};

const bpTile: TensorTileSpec = {
  id: "bp",
  kind: "bias",
  label: "策略头 bias",
  shape: "(4)",
  values: makeVector(4, 11.4, 0.42),
  highlightTargets: {
    layers: ["actor_logits"],
    routes: ["actor_fc2_logits"],
  },
};

const logitsTile: TensorTileSpec = {
  id: "logits",
  kind: "vector",
  label: "logits z",
  shape: "(4)",
  values: makeVector(4, 12.8, 1.15),
  highlightTargets: {
    layers: ["actor_logits"],
    routes: ["actor_fc2_logits"],
  },
};

const policyTile: TensorTileSpec = {
  id: "policy",
  kind: "probabilities",
  label: "策略分布 pi(a|s)",
  shape: "(4)",
  values: makeProbabilities(4, 13.2),
  highlightTargets: {
    layers: ["actor_logits"],
    routes: ["actor_fc2_logits"],
  },
  selectedIndex: 1,
  actionLabels: ["0", "1", "2", "3"],
};

const actionTile: TensorTileSpec = {
  id: "action",
  kind: "action",
  label: "采样动作 a",
  shape: "(1)",
  highlightTargets: {
    layers: ["actor_logits"],
    routes: ["actor_fc2_logits"],
  },
  selectedIndex: 1,
  actionLabels: ["0", "1", "2", "3"],
};

export const actorFormulaStages: ActorFormulaStage[] = [
  {
    id: "obs",
    title: "输入观测",
    shortLabel: "obs",
    formulaTex: String.raw`s \in \mathbb{R}^{16}`,
    narrative: "先把环境状态向量整理成教学视图中的 16 维观测 s；它是 actor 和 critic 的共同输入。",
    highlightTargets: {
      layers: ["obs"],
      routes: ["shared_actor"],
    },
    expression: [{ type: "tile", tile: obsTile }],
  },
  {
    id: "fc1_linear",
    title: "Actor fc1 线性变换",
    shortLabel: "fc1",
    formulaTex: String.raw`u^{(1)} = W^{(1)} s + b^{(1)}`,
    narrative: "第一层全连接先把输入观测投影到 64 维隐藏空间；这一步还没有经过非线性激活。",
    highlightTargets: {
      layers: ["actor_fc1"],
      routes: ["shared_actor"],
    },
    expression: [
      { type: "tile", tile: obsTile },
      { type: "operator", label: "×" },
      { type: "tile", tile: w1Tile },
      { type: "operator", label: "+" },
      { type: "tile", tile: b1Tile },
      { type: "operator", label: "=" },
      { type: "tile", tile: u1Tile },
    ],
  },
  {
    id: "fc1_activation",
    title: "Actor fc1 激活",
    shortLabel: "tanh1",
    formulaTex: String.raw`h^{(1)} = \tanh\!\left(u^{(1)}\right)`,
    narrative: "PPO 这里用 tanh 把预激活压进稳定范围，得到第一层隐藏表示 h^(1)。",
    highlightTargets: {
      layers: ["actor_fc1"],
      routes: ["shared_actor"],
    },
    expression: [
      { type: "tile", tile: u1Tile },
      { type: "operator", label: "tanh(·)", tone: "soft" },
      { type: "tile", tile: h1Tile },
    ],
  },
  {
    id: "fc2_linear",
    title: "Actor fc2 线性变换",
    shortLabel: "fc2",
    formulaTex: String.raw`u^{(2)} = W^{(2)} h^{(1)} + b^{(2)}`,
    narrative: "第二层全连接继续重组第一层特征，把与动作决策相关的模式压缩进更成熟的表示里。",
    highlightTargets: {
      layers: ["actor_fc2"],
      routes: ["actor_fc1_fc2"],
    },
    expression: [
      { type: "tile", tile: h1Tile },
      { type: "operator", label: "×" },
      { type: "tile", tile: w2Tile },
      { type: "operator", label: "+" },
      { type: "tile", tile: b2Tile },
      { type: "operator", label: "=" },
      { type: "tile", tile: u2Tile },
    ],
  },
  {
    id: "fc2_activation",
    title: "Actor fc2 激活",
    shortLabel: "tanh2",
    formulaTex: String.raw`h^{(2)} = \tanh\!\left(u^{(2)}\right)`,
    narrative: "再经过一次 tanh 之后，actor 就得到了送进策略头的最终隐藏表示 h^(2)。",
    highlightTargets: {
      layers: ["actor_fc2"],
      routes: ["actor_fc1_fc2"],
    },
    expression: [
      { type: "tile", tile: u2Tile },
      { type: "operator", label: "tanh(·)", tone: "soft" },
      { type: "tile", tile: h2Tile },
    ],
  },
  {
    id: "logits",
    title: "策略头输出 logits",
    shortLabel: "logits",
    formulaTex: String.raw`z = W^{(\pi)} h^{(2)} + b^{(\pi)}`,
    narrative: "策略头把隐藏表示映射到 4 个动作 logits；它们还不是概率，而是 softmax 之前的未归一化分数。",
    highlightTargets: {
      layers: ["actor_logits"],
      routes: ["actor_fc2_logits"],
    },
    expression: [
      { type: "tile", tile: h2Tile },
      { type: "operator", label: "×" },
      { type: "tile", tile: wpTile },
      { type: "operator", label: "+" },
      { type: "tile", tile: bpTile },
      { type: "operator", label: "=" },
      { type: "tile", tile: logitsTile },
    ],
  },
  {
    id: "policy_sample",
    title: "Softmax 与动作采样",
    shortLabel: "sample",
    formulaTex: String.raw`\begin{aligned}
\pi_\theta(a \mid s) &= \operatorname{Softmax}(z) \\
a &\sim \operatorname{Categorical}(\pi_\theta(\cdot \mid s))
\end{aligned}`,
    narrative: "把 logits 归一化成策略分布之后，agent 再从分类分布里采样动作 a；这一步正对应 ppo.py 里的 Categorical(logits=logits)。",
    highlightTargets: {
      layers: ["actor_logits"],
      routes: ["actor_fc2_logits"],
    },
    expression: [
      { type: "tile", tile: logitsTile },
      { type: "operator", label: "softmax", tone: "soft" },
      { type: "tile", tile: policyTile },
      { type: "operator", label: "sample", tone: "soft" },
      { type: "tile", tile: actionTile },
    ],
  },
];

export function getActorFormulaStage(stageId: ActorFormulaStageId) {
  return actorFormulaStages.find((stage) => stage.id === stageId) ?? actorFormulaStages[0];
}
