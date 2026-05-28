"use client";

import { useEffect, useRef } from "react";
import { scaleBand, scaleLinear } from "d3-scale";
import { max } from "d3-array";
import katex from "katex";

type Props = {
  probs?: number[];
  sampledIndex?: number;
};

export default function Action({ probs = [0.15, 0.4, 0.2, 0.25], sampledIndex = 1 }: Props) {
  const formulaRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!formulaRef.current) return;

    const latex = String.raw`\begin{aligned} \text{logits: }\mathbf{z}=[z_1, z_2, \ldots, z_n] \\ \pi=\operatorname{Softmax}(\mathbf{z}) \end{aligned}`;
    formulaRef.current.innerHTML = katex.renderToString(latex, {
      throwOnError: false,
      displayMode: true,
    });
  }, []);

  const dataRaw = probs.slice();
  const sum = dataRaw.reduce((a, b) => a + b, 0) || 1;
  const data = dataRaw.map((d) => d / sum);

  const width = 140;
  const height = 70;
  const margin = { left: 8, right: 8, top: 10, bottom: 18 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const x = scaleBand<string>().domain(data.map((_, i) => String(i))).range([0, innerW]).padding(0.2);
  const y = scaleLinear().domain([0, Math.max(0.001, max(data) ?? 1)]).range([innerH, 0]);

  return (
    <div
      className="-ml-16 rounded-2xl border-2 border-accent bg-accent/10 px-4 py-3 shadow-md tooltip tooltip-open tooltip-accent"
      data-tip={`π：\n整个动作的概率分布`}
    >
      <div className="items-center gap-3 flex flex-col">
        <h3 className="text-sm font-semibold text-accent">采样动作 a</h3>
        <svg width={width} height={height}>
          {/* left ellipsis */}
          <text x={0} y={margin.top + innerH / 2 + 4} fill="var(--color-base-content)" fillOpacity={0.36} fontSize={18}>
            …
          </text>

          {/* right ellipsis */}
          <text x={width} y={margin.top + innerH / 2 + 4} textAnchor="end" fill="var(--color-base-content)" fillOpacity={0.36} fontSize={18}>
            …
          </text>

          <g transform={`translate(${margin.left},${margin.top})`}>
            {data.map((d, i) => {
              const xPos = x(String(i)) ?? 0;
              const barH = innerH - y(d);
              return (
                <g key={i}>
                  <rect
                    x={xPos}
                    y={y(d)}
                    width={x.bandwidth()}
                    height={barH}
                    rx={3}
                    fill="var(--color-accent)"
                    fillOpacity={i === sampledIndex ? 0.95 : 0.24}
                  />
                  <text x={xPos + x.bandwidth() / 2} y={y(d) - 2} textAnchor="middle" fill="var(--color-base-content)" fontSize={10}>
                    {Math.round(d * 100)}%
                  </text>
                  <text x={xPos + x.bandwidth() / 2} y={innerH + 12} textAnchor="middle" fill="var(--color-base-content)" fontSize={10}>
                    {i}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
        <div ref={formulaRef} className="max-w-[132px] text-center text-[10px] leading-tight text-base-content/70" />
      </div>
    </div>
  );
}
