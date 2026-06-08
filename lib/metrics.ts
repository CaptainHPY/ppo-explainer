export type MetricPoint = {
  step: number;
  value: number;
};

export type MetricSummary = {
  tone: "stable" | "watch" | "risk";
  label: string;
  detail: string;
};

export function parseMetricCsv(csvText: string): MetricPoint[] {
  const lines = csvText
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines
    .map((line) => {
      const [stepText, valueText] = line.split(",");
      return {
        step: Number(stepText),
        value: Number(valueText),
      };
    })
    .filter((point) => Number.isFinite(point.step) && Number.isFinite(point.value))
    .sort((left, right) => left.step - right.step);
}

export function findClosestMetricPoint(data: MetricPoint[], step: number | null): MetricPoint | null {
  if (!data.length || step === null) {
    return null;
  }

  let bestPoint = data[0];
  let bestDistance = Math.abs(data[0].step - step);

  for (let index = 1; index < data.length; index += 1) {
    const distance = Math.abs(data[index].step - step);
    if (distance < bestDistance) {
      bestPoint = data[index];
      bestDistance = distance;
    }
  }

  return bestPoint;
}

export function formatMetricValue(metricId: string, value: number): string {
  switch (metricId) {
    case "clipfrac":
      return `${(value * 100).toFixed(1)}%`;
    case "approx_kl":
      return value.toFixed(4);
    case "explained_variance":
      return value.toFixed(3);
    case "value_loss":
      return value.toFixed(1);
    default:
      return value.toFixed(3);
  }
}

export function explainMetricValue(metricId: string, value: number): string {
  switch (metricId) {
    case "approx_kl":
      if (value < 0.005) return "策略步子比较克制，更新幅度偏稳。";
      if (value < 0.01) return "更新开始变大，值得继续观察。";
      return "策略更新偏猛，PPO 稳定性会开始吃紧。";
    case "clipfrac":
      if (value < 0.02) return "大多数样本没有触发 clip，裁剪压力很低。";
      if (value < 0.1) return "已经有一部分样本被裁剪，更新略激进。";
      return "大量样本触发裁剪，更新常常越过安全区。";
    case "value_loss":
      if (value < 45) return "critic 拟合损失较低，回报拟合相对顺。";
      if (value < 65) return "critic 还能跟上，但拟合质量不算轻松。";
      return "value loss 偏高，critic 对 returns 的拟合比较吃力。";
    case "explained_variance":
      if (value >= 0.3) return "critic 已经解释了相当一部分回报波动。";
      if (value >= 0.05) return "critic 在起作用，但拟合还不够强。";
      return "critic 几乎没解释回报波动，优势估计会更噪。";
    default:
      return "";
  }
}

export function summarizePolicyStability(
  approxPoint: MetricPoint | null,
  clipPoint: MetricPoint | null,
): MetricSummary {
  const approxValue = approxPoint?.value ?? 0;
  const clipValue = clipPoint?.value ?? 0;

  if (approxValue >= 0.01 || clipValue >= 0.1) {
    return {
      tone: "risk",
      label: "aggressive update",
      detail: "当前策略更新偏猛，很多样本更容易顶到 PPO 的裁剪边界。",
    };
  }

  if (approxValue >= 0.005 || clipValue >= 0.02) {
    return {
      tone: "watch",
      label: "watch the step",
      detail: "更新还算可控，但已经能看出策略步长在抬头。",
    };
  }

  return {
    tone: "stable",
    label: "stable",
    detail: "这组样例里的策略更新总体比较克制，clip 压力也很低。",
  };
}

export function summarizeCriticFit(
  valueLossPoint: MetricPoint | null,
  explainedVariancePoint: MetricPoint | null,
): MetricSummary {
  const valueLoss = valueLossPoint?.value ?? 0;
  const explainedVariance = explainedVariancePoint?.value ?? 0;

  if (explainedVariance < 0.05 || valueLoss >= 65) {
    return {
      tone: "risk",
      label: "critic lagging",
      detail: "critic 还没明显跟上，value head 对 returns 的解释力偏弱。",
    };
  }

  if (explainedVariance < 0.3 || valueLoss >= 45) {
    return {
      tone: "watch",
      label: "partial fit",
      detail: "critic 在工作，但拟合质量还只是一般，值得继续观察。",
    };
  }

  return {
    tone: "stable",
    label: "critic aligned",
    detail: "critic 已经能较稳定地跟上回报结构。",
  };
}
