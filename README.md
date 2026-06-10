This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

1. Install bun: [https://bun.sh/](https://bun.sh/)

2. Install dependencies:

```bash
bun i
```

3. Run the development server:

```bash
bun dev
```

4. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## TODOS

- [x] 交互式可视化训练指标曲线(用d3库，单击联动模块展开)：

    第一优先级——策略更新是否过猛：approx_kl, clipfrac

    这两条是 PPO 稳定性的核心。
    
    approx_kl 持续偏高：说明每次策略更新太大，容易不稳定。
    
    clipfrac 长期很高：很多样本都被裁剪，说明更新幅度常常越界。
    
    联动模块：PPO Buffer
    
    第二优先级——价值网络是否跟上：value_loss, explained_variance
    
    这对组合反映 critic 学得好不好。
    
    value_loss 降不下去、explained_variance 接近 0 或为负：value head 拟合差，优势估计会噪声大，进而拖累 policy。
    
    联动模块：展开状态下 Agent 的 critic 分支
    
    (可视化所需训练指标均在public\data目录下)

- [x] 交互式可视化Agent中actor分支的前向过程 (单击actor分支展开，公式用katex库，仿照[transformer-explainer](https://poloclub.github.io/transformer-explainer/)的MLP Expansion)

- [ ] 在page.tsx的第199行开始新引入一个组件，以文字形式简介PPO、用PPO训练cartpole在各个阶段的效果（分为前、中、后三个阶段，以每个阶段的训练指标作为依据）和我们的可视化工作，并加入高级可视化图表
