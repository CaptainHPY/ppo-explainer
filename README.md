<div align="center">

# PPO-Explainer

</div>

<div align="center">
    <a href="https://ppo-explainer.vercel.app/">
        <img src="https://img.shields.io/badge/Website-Homepage-blue" alt="Homepage">
    </a>
    <a href="https://github.com/CaptainHPY/ppo-explainer/blob/main/LICENSE">
        <img src="https://img.shields.io/badge/License-MIT-yellow" alt="License">
    </a>
</div>

## ✨ Features

- 🗺️ **Overall flow diagram**: Visualizes the complete PPO training loop (Agent, Environment, Buffer, and PPO Clip).

- 🎛️ **Step-based playback**: Time-synced play, pause, and step controls for navigating the training process.

- 🧠 **Actor Formula Explorer**: Layer-by-layer breakdown of how state inputs transform into action probabilities.

- 📦 **Diagnostic panels**: Plots Buffer (`approx_kl`, `clipfrac`) and Critic (`value_loss`, `explained_variance`) metrics.

- 🌊 **MatrixWave**: Visualizes Actor/Critic network weight structures across different training stages.

- 🔥 **State heatmap**: Maps CartPole state space to show visit density, policy performance, and failure rates.

- 🌀 **Spiral training chart**: Encodes PPO update states (stable, clipping, lagging) along a time trajectory.

## 🛠️ Tech Stack

- ⚛️ **Next.js** — Full-stack React framework for the web presentation and routing.

- 📊 **D3.js** — Visualization library for building flow diagrams, charts, and custom graphics.

- 🌼 **daisyUI** — UI component library for clean and consistent interface elements.

- 🥟 **Bun** — Runtime and package manager for a fast development experience.

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

## Reference

- [Transformer-explainer](https://github.com/poloclub/transformer-explainer)
