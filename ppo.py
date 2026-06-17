# docs and experiment results can be found at https://docs.cleanrl.dev/rl-algorithms/ppo/#ppopy
import argparse
import json
import os
import random
import time
from distutils.util import strtobool

import gym
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.distributions.categorical import Categorical
from torch.utils.tensorboard import SummaryWriter


def parse_args():
    # fmt: off
    parser = argparse.ArgumentParser()
    parser.add_argument("--exp-name", type=str, default=os.path.basename(__file__).rstrip(".py"),
        help="the name of this experiment")
    parser.add_argument("--seed", type=int, default=1,
        help="seed of the experiment")
    parser.add_argument("--torch-deterministic", type=lambda x: bool(strtobool(x)), default=True, nargs="?", const=True,
        help="if toggled, `torch.backends.cudnn.deterministic=False`")
    parser.add_argument("--cuda", type=lambda x: bool(strtobool(x)), default=True, nargs="?", const=True,
        help="if toggled, cuda will be enabled by default")
    parser.add_argument("--track", type=lambda x: bool(strtobool(x)), default=False, nargs="?", const=True,
        help="if toggled, this experiment will be tracked with Weights and Biases")
    parser.add_argument("--wandb-project-name", type=str, default="cleanRL",
        help="the wandb's project name")
    parser.add_argument("--wandb-entity", type=str, default=None,
        help="the entity (team) of wandb's project")
    parser.add_argument("--capture-video", type=lambda x: bool(strtobool(x)), default=False, nargs="?", const=True,
        help="whether to capture videos of the agent performances (check out `videos` folder)")
    parser.add_argument("--save-model-interval", type=int, default=0,
        help="save actor and critic weights every N global steps; disabled when set to 0")
    parser.add_argument("--save-model-dir", type=str, default="checkpoints",
        help="directory to save actor and critic checkpoints")
    parser.add_argument("--save-state-heatmap", type=lambda x: bool(strtobool(x)), default=False, nargs="?", const=True,
        help="if toggled, save phase-based state heatmap statistics as JSON")
    parser.add_argument("--state-heatmap-dir", type=str, default="state_heatmaps",
        help="directory to save state heatmap outputs")
    parser.add_argument("--state-heatmap-steps", type=str, default="20000,40000,100000",
        help="comma-separated phase boundary steps for early,middle,late heatmaps")
    parser.add_argument("--state-heatmap-bins-x", type=int, default=36,
        help="number of bins for the heatmap x-axis")
    parser.add_argument("--state-heatmap-bins-y", type=int, default=36,
        help="number of bins for the heatmap y-axis")
    parser.add_argument("--state-heatmap-x-dim", type=int, default=2,
        help="observation dimension used for the heatmap x-axis")
    parser.add_argument("--state-heatmap-y-dim", type=int, default=3,
        help="observation dimension used for the heatmap y-axis")
    parser.add_argument("--state-heatmap-x-min", type=float, default=-0.2095,
        help="minimum value for the heatmap x-axis binning range")
    parser.add_argument("--state-heatmap-x-max", type=float, default=0.2095,
        help="maximum value for the heatmap x-axis binning range")
    parser.add_argument("--state-heatmap-y-min", type=float, default=-3.0,
        help="minimum value for the heatmap y-axis binning range")
    parser.add_argument("--state-heatmap-y-max", type=float, default=3.0,
        help="maximum value for the heatmap y-axis binning range")

    # Algorithm specific arguments
    parser.add_argument("--env-id", type=str, default="CartPole-v1",
        help="the id of the environment")
    parser.add_argument("--total-timesteps", type=int, default=100000,
        help="total timesteps of the experiments")
    parser.add_argument("--learning-rate", type=float, default=2.5e-4,
        help="the learning rate of the optimizer")
    parser.add_argument("--num-envs", type=int, default=4,
        help="the number of parallel game environments")
    parser.add_argument("--num-steps", type=int, default=128,
        help="the number of steps to run in each environment per policy rollout")
    parser.add_argument("--anneal-lr", type=lambda x: bool(strtobool(x)), default=True, nargs="?", const=True,
        help="Toggle learning rate annealing for policy and value networks")
    parser.add_argument("--gamma", type=float, default=0.99,
        help="the discount factor gamma")
    parser.add_argument("--gae-lambda", type=float, default=0.95,
        help="the lambda for the general advantage estimation")
    parser.add_argument("--num-minibatches", type=int, default=4,
        help="the number of mini-batches")
    parser.add_argument("--update-epochs", type=int, default=4,
        help="the K epochs to update the policy")
    parser.add_argument("--norm-adv", type=lambda x: bool(strtobool(x)), default=True, nargs="?", const=True,
        help="Toggles advantages normalization")
    parser.add_argument("--clip-coef", type=float, default=0.2,
        help="the surrogate clipping coefficient")
    parser.add_argument("--clip-vloss", type=lambda x: bool(strtobool(x)), default=True, nargs="?", const=True,
        help="Toggles whether or not to use a clipped loss for the value function, as per the paper.")
    parser.add_argument("--ent-coef", type=float, default=0.01,
        help="coefficient of the entropy")
    parser.add_argument("--vf-coef", type=float, default=0.5,
        help="coefficient of the value function")
    parser.add_argument("--max-grad-norm", type=float, default=0.5,
        help="the maximum norm for the gradient clipping")
    parser.add_argument("--target-kl", type=float, default=None,
        help="the target KL divergence threshold")
    args = parser.parse_args()
    args.batch_size = int(args.num_envs * args.num_steps)
    args.minibatch_size = int(args.batch_size // args.num_minibatches)
    args.state_heatmap_steps = sorted({int(step.strip()) for step in args.state_heatmap_steps.split(",") if step.strip()})
    if len(args.state_heatmap_steps) != 3:
        raise ValueError("--state-heatmap-steps must contain exactly three increasing step values.")
    if args.state_heatmap_x_dim < 0 or args.state_heatmap_y_dim < 0:
        raise ValueError("state heatmap observation dimensions must be non-negative.")
    if args.state_heatmap_x_min >= args.state_heatmap_x_max or args.state_heatmap_y_min >= args.state_heatmap_y_max:
        raise ValueError("state heatmap axis min must be smaller than max.")
    # fmt: on
    return args


def make_env(env_id, seed, idx, capture_video, run_name):
    def thunk():
        env = gym.make(env_id)
        env = gym.wrappers.RecordEpisodeStatistics(env)
        if capture_video:
            if idx == 0:
                env = gym.wrappers.RecordVideo(env, f"videos/{run_name}")
        env.seed(seed)
        env.action_space.seed(seed)
        env.observation_space.seed(seed)
        return env

    return thunk


def layer_init(layer, std=np.sqrt(2), bias_const=0.0):
    torch.nn.init.orthogonal_(layer.weight, std)
    torch.nn.init.constant_(layer.bias, bias_const)
    return layer


def save_actor_critic(agent, save_dir, run_name, global_step):
    checkpoint_dir = os.path.join(save_dir, run_name)
    os.makedirs(checkpoint_dir, exist_ok=True)
    actor_path = os.path.join(checkpoint_dir, f"actor_step_{global_step}.pt")
    critic_path = os.path.join(checkpoint_dir, f"critic_step_{global_step}.pt")
    torch.save(agent.actor.state_dict(), actor_path)
    torch.save(agent.critic.state_dict(), critic_path)
    print(f"saved actor checkpoint to {actor_path}")
    print(f"saved critic checkpoint to {critic_path}")


def build_state_heatmap_phase_configs(phase_steps):
    labels = [("early", "前期"), ("middle", "中期"), ("late", "后期")]
    ranges = [
        (1, phase_steps[0]),
        (phase_steps[0] + 1, phase_steps[1]),
        (phase_steps[1] + 1, phase_steps[2]),
    ]
    phase_configs = []
    for (phase_id, label), (step_start, step_end) in zip(labels, ranges):
        phase_configs.append(
            {
                "phase_id": phase_id,
                "label": label,
                "step_start": step_start,
                "step_end": step_end,
            }
        )
    return phase_configs


def create_state_heatmap_accumulator(args):
    bins_y = args.state_heatmap_bins_y
    bins_x = args.state_heatmap_bins_x
    accumulator = {}
    for phase in build_state_heatmap_phase_configs(args.state_heatmap_steps):
        accumulator[phase["phase_id"]] = {
            "label": phase["label"],
            "step_start": phase["step_start"],
            "step_end": phase["step_end"],
            "sample_count": 0,
            "visit_count": np.zeros((bins_y, bins_x), dtype=np.int64),
            "value_sum": np.zeros((bins_y, bins_x), dtype=np.float64),
            "policy_right_prob_sum": np.zeros((bins_y, bins_x), dtype=np.float64),
            "action_right_count": np.zeros((bins_y, bins_x), dtype=np.int64),
            "failure_count": np.zeros((bins_y, bins_x), dtype=np.int64),
        }
    return accumulator


def resolve_phase_id(sample_step, phase_accumulator):
    for phase_id, phase in phase_accumulator.items():
        if phase["step_start"] <= sample_step <= phase["step_end"]:
            return phase_id
    return None


def compute_heatmap_bin(value, value_min, value_max, num_bins):
    normalized = (value - value_min) / (value_max - value_min)
    normalized = min(max(normalized, 0.0), 0.999999)
    return int(normalized * num_bins)


def record_state_heatmap_samples(args, phase_accumulator, observations, values, probs, actions, dones, sample_steps):
    right_action_index = 1 if probs.shape[1] > 1 else 0
    x_values = observations[:, args.state_heatmap_x_dim]
    y_values = observations[:, args.state_heatmap_y_dim]
    right_probs = probs[:, right_action_index]

    for sample_index, sample_step in enumerate(sample_steps):
        phase_id = resolve_phase_id(int(sample_step), phase_accumulator)
        if phase_id is None:
            continue

        phase = phase_accumulator[phase_id]
        x_bin = compute_heatmap_bin(
            float(x_values[sample_index]),
            args.state_heatmap_x_min,
            args.state_heatmap_x_max,
            args.state_heatmap_bins_x,
        )
        y_bin = compute_heatmap_bin(
            float(y_values[sample_index]),
            args.state_heatmap_y_min,
            args.state_heatmap_y_max,
            args.state_heatmap_bins_y,
        )

        phase["sample_count"] += 1
        phase["visit_count"][y_bin, x_bin] += 1
        phase["value_sum"][y_bin, x_bin] += float(values[sample_index])
        phase["policy_right_prob_sum"][y_bin, x_bin] += float(right_probs[sample_index])
        phase["action_right_count"][y_bin, x_bin] += int(actions[sample_index] == right_action_index)
        phase["failure_count"][y_bin, x_bin] += int(dones[sample_index])


def finalize_heatmap_mean_grid(sum_grid, count_grid):
    mean_grid = np.full(sum_grid.shape, None, dtype=object)
    nonzero_mask = count_grid > 0
    mean_grid[nonzero_mask] = sum_grid[nonzero_mask] / count_grid[nonzero_mask]
    return mean_grid.tolist()


def finalize_heatmap_rate_grid(numerator_grid, count_grid):
    rate_grid = np.full(count_grid.shape, None, dtype=object)
    nonzero_mask = count_grid > 0
    rate_grid[nonzero_mask] = numerator_grid[nonzero_mask] / count_grid[nonzero_mask]
    return rate_grid.tolist()


def export_state_heatmaps(args, run_name, envs, phase_accumulator):
    output_dir = os.path.join(args.state_heatmap_dir, run_name)
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, "ppo_state_heatmaps.json")

    phases = []
    for phase_id in ["early", "middle", "late"]:
        phase = phase_accumulator[phase_id]
        visit_count = phase["visit_count"]
        phases.append(
            {
                "phase_id": phase_id,
                "label": phase["label"],
                "step_start": phase["step_start"],
                "step_end": phase["step_end"],
                "sample_count": phase["sample_count"],
                "grids": {
                    "visit_count": visit_count.tolist(),
                    "value_mean": finalize_heatmap_mean_grid(phase["value_sum"], visit_count),
                    "policy_right_prob_mean": finalize_heatmap_mean_grid(phase["policy_right_prob_sum"], visit_count),
                    "action_right_rate": finalize_heatmap_rate_grid(phase["action_right_count"], visit_count),
                    "failure_rate": finalize_heatmap_rate_grid(phase["failure_count"], visit_count),
                },
            }
        )

    payload = {
        "schema_version": 1,
        "env_id": args.env_id,
        "run_name": run_name,
        "total_timesteps": args.total_timesteps,
        "network_architecture": {
            "actor": f"{np.array(envs.single_observation_space.shape).prod()}->64->64->{envs.single_action_space.n}",
            "critic": f"{np.array(envs.single_observation_space.shape).prod()}->64->64->1",
        },
        "axes": {
            "x": {
                "dim": args.state_heatmap_x_dim,
                "label": "pole_angle" if args.state_heatmap_x_dim == 2 else f"obs[{args.state_heatmap_x_dim}]",
            },
            "y": {
                "dim": args.state_heatmap_y_dim,
                "label": "pole_angular_velocity" if args.state_heatmap_y_dim == 3 else f"obs[{args.state_heatmap_y_dim}]",
            },
        },
        "binning": {
            "bins_x": args.state_heatmap_bins_x,
            "bins_y": args.state_heatmap_bins_y,
            "x_min": args.state_heatmap_x_min,
            "x_max": args.state_heatmap_x_max,
            "y_min": args.state_heatmap_y_min,
            "y_max": args.state_heatmap_y_max,
        },
        "phase_steps": args.state_heatmap_steps,
        "phases": phases,
    }

    with open(output_path, "w", encoding="utf-8") as fp:
        json.dump(payload, fp, ensure_ascii=False, indent=2)

    print(f"saved state heatmap summary to {output_path}")


class Agent(nn.Module):
    def __init__(self, envs):
        super().__init__()
        self.critic = nn.Sequential(
            layer_init(nn.Linear(np.array(envs.single_observation_space.shape).prod(), 64)),
            nn.Tanh(),
            layer_init(nn.Linear(64, 64)),
            nn.Tanh(),
            layer_init(nn.Linear(64, 1), std=1.0),
        )
        self.actor = nn.Sequential(
            layer_init(nn.Linear(np.array(envs.single_observation_space.shape).prod(), 64)),
            nn.Tanh(),
            layer_init(nn.Linear(64, 64)),
            nn.Tanh(),
            layer_init(nn.Linear(64, envs.single_action_space.n), std=0.01),
        )

    def get_value(self, x):
        return self.critic(x)

    def get_action_and_value(self, x, action=None):
        logits = self.actor(x)
        probs = Categorical(logits=logits)
        if action is None:
            action = probs.sample()
        return action, probs.log_prob(action), probs.entropy(), self.critic(x)

    def get_action_value_and_probs(self, x, action=None):
        logits = self.actor(x)
        dist = Categorical(logits=logits)
        if action is None:
            action = dist.sample()
        return action, dist.log_prob(action), dist.entropy(), self.critic(x), dist.probs


if __name__ == "__main__":
    args = parse_args()
    run_name = f"{args.env_id}__{args.exp_name}__{args.seed}__{int(time.time())}"
    if args.track:
        import wandb

        wandb.init(
            project=args.wandb_project_name,
            entity=args.wandb_entity,
            sync_tensorboard=True,
            config=vars(args),
            name=run_name,
            monitor_gym=True,
            save_code=True,
        )
    writer = SummaryWriter(f"runs/{run_name}")
    writer.add_text(
        "hyperparameters",
        "|param|value|\n|-|-|\n%s" % ("\n".join([f"|{key}|{value}|" for key, value in vars(args).items()])),
    )

    # TRY NOT TO MODIFY: seeding
    random.seed(args.seed)
    np.random.seed(args.seed)
    torch.manual_seed(args.seed)
    torch.backends.cudnn.deterministic = args.torch_deterministic

    device = torch.device("cuda" if torch.cuda.is_available() and args.cuda else "cpu")

    # env setup
    envs = gym.vector.SyncVectorEnv(
        [make_env(args.env_id, args.seed + i, i, args.capture_video, run_name) for i in range(args.num_envs)]
    )
    assert isinstance(envs.single_action_space, gym.spaces.Discrete), "only discrete action space is supported"

    agent = Agent(envs).to(device)
    optimizer = optim.Adam(agent.parameters(), lr=args.learning_rate, eps=1e-5)

    # ALGO Logic: Storage setup
    obs = torch.zeros((args.num_steps, args.num_envs) + envs.single_observation_space.shape).to(device)
    actions = torch.zeros((args.num_steps, args.num_envs) + envs.single_action_space.shape).to(device)
    logprobs = torch.zeros((args.num_steps, args.num_envs)).to(device)
    rewards = torch.zeros((args.num_steps, args.num_envs)).to(device)
    dones = torch.zeros((args.num_steps, args.num_envs)).to(device)
    values = torch.zeros((args.num_steps, args.num_envs)).to(device)

    # TRY NOT TO MODIFY: start the game
    global_step = 0
    last_checkpoint_step = 0
    start_time = time.time()
    next_obs = torch.Tensor(envs.reset()).to(device)
    next_done = torch.zeros(args.num_envs).to(device)
    num_updates = args.total_timesteps // args.batch_size
    phase_heatmaps = create_state_heatmap_accumulator(args) if args.save_state_heatmap else None

    for update in range(1, num_updates + 1):
        # Annealing the rate if instructed to do so.
        if args.anneal_lr:
            frac = 1.0 - (update - 1.0) / num_updates
            lrnow = frac * args.learning_rate
            optimizer.param_groups[0]["lr"] = lrnow

        for step in range(0, args.num_steps):
            step_base = global_step
            global_step += 1 * args.num_envs
            obs[step] = next_obs
            dones[step] = next_done

            # ALGO LOGIC: action logic
            with torch.no_grad():
                action, logprob, _, value, probs = agent.get_action_value_and_probs(next_obs)
                values[step] = value.flatten()
            actions[step] = action
            logprobs[step] = logprob

            # TRY NOT TO MODIFY: execute the game and log data.
            next_obs, reward, done, info = envs.step(action.cpu().numpy())
            rewards[step] = torch.tensor(reward).to(device).view(-1)
            next_obs, next_done = torch.Tensor(next_obs).to(device), torch.Tensor(done).to(device)

            if args.save_state_heatmap:
                sample_steps = step_base + np.arange(1, args.num_envs + 1)
                record_state_heatmap_samples(
                    args,
                    phase_heatmaps,
                    obs[step].detach().cpu().numpy(),
                    values[step].detach().cpu().numpy(),
                    probs.detach().cpu().numpy(),
                    action.detach().cpu().numpy(),
                    done,
                    sample_steps,
                )

            for item in info:
                if "episode" in item.keys():
                    print(f"global_step={global_step}, episodic_return={item['episode']['r']}")
                    writer.add_scalar("charts/episodic_return", item["episode"]["r"], global_step)
                    writer.add_scalar("charts/episodic_length", item["episode"]["l"], global_step)
                    break

        # bootstrap value if not done
        with torch.no_grad():
            next_value = agent.get_value(next_obs).reshape(1, -1)
            advantages = torch.zeros_like(rewards).to(device)
            lastgaelam = 0
            for t in reversed(range(args.num_steps)):
                if t == args.num_steps - 1:
                    nextnonterminal = 1.0 - next_done
                    nextvalues = next_value
                else:
                    nextnonterminal = 1.0 - dones[t + 1]
                    nextvalues = values[t + 1]
                delta = rewards[t] + args.gamma * nextvalues * nextnonterminal - values[t]
                advantages[t] = lastgaelam = delta + args.gamma * args.gae_lambda * nextnonterminal * lastgaelam
            returns = advantages + values

        # flatten the batch
        b_obs = obs.reshape((-1,) + envs.single_observation_space.shape)
        b_logprobs = logprobs.reshape(-1)
        b_actions = actions.reshape((-1,) + envs.single_action_space.shape)
        b_advantages = advantages.reshape(-1)
        b_returns = returns.reshape(-1)
        b_values = values.reshape(-1)

        # Optimizing the policy and value network
        b_inds = np.arange(args.batch_size)
        clipfracs = []
        for epoch in range(args.update_epochs):
            np.random.shuffle(b_inds)
            for start in range(0, args.batch_size, args.minibatch_size):
                end = start + args.minibatch_size
                mb_inds = b_inds[start:end]

                _, newlogprob, entropy, newvalue = agent.get_action_and_value(b_obs[mb_inds], b_actions.long()[mb_inds])
                logratio = newlogprob - b_logprobs[mb_inds]
                ratio = logratio.exp()

                with torch.no_grad():
                    # calculate approx_kl http://joschu.net/blog/kl-approx.html
                    old_approx_kl = (-logratio).mean()
                    approx_kl = ((ratio - 1) - logratio).mean()
                    clipfracs += [((ratio - 1.0).abs() > args.clip_coef).float().mean().item()]

                mb_advantages = b_advantages[mb_inds]
                if args.norm_adv:
                    mb_advantages = (mb_advantages - mb_advantages.mean()) / (mb_advantages.std() + 1e-8)

                # Policy loss
                pg_loss1 = -mb_advantages * ratio
                pg_loss2 = -mb_advantages * torch.clamp(ratio, 1 - args.clip_coef, 1 + args.clip_coef)
                pg_loss = torch.max(pg_loss1, pg_loss2).mean()

                # Value loss
                newvalue = newvalue.view(-1)
                if args.clip_vloss:
                    v_loss_unclipped = (newvalue - b_returns[mb_inds]) ** 2
                    v_clipped = b_values[mb_inds] + torch.clamp(
                        newvalue - b_values[mb_inds],
                        -args.clip_coef,
                        args.clip_coef,
                    )
                    v_loss_clipped = (v_clipped - b_returns[mb_inds]) ** 2
                    v_loss_max = torch.max(v_loss_unclipped, v_loss_clipped)
                    v_loss = 0.5 * v_loss_max.mean()
                else:
                    v_loss = 0.5 * ((newvalue - b_returns[mb_inds]) ** 2).mean()

                entropy_loss = entropy.mean()
                loss = pg_loss - args.ent_coef * entropy_loss + v_loss * args.vf_coef

                optimizer.zero_grad()
                loss.backward()
                nn.utils.clip_grad_norm_(agent.parameters(), args.max_grad_norm)
                optimizer.step()

            if args.target_kl is not None:
                if approx_kl > args.target_kl:
                    break

        y_pred, y_true = b_values.cpu().numpy(), b_returns.cpu().numpy()
        var_y = np.var(y_true)
        explained_var = np.nan if var_y == 0 else 1 - np.var(y_true - y_pred) / var_y

        # TRY NOT TO MODIFY: record rewards for plotting purposes
        writer.add_scalar("charts/learning_rate", optimizer.param_groups[0]["lr"], global_step)
        writer.add_scalar("losses/value_loss", v_loss.item(), global_step)
        writer.add_scalar("losses/policy_loss", pg_loss.item(), global_step)
        writer.add_scalar("losses/entropy", entropy_loss.item(), global_step)
        writer.add_scalar("losses/old_approx_kl", old_approx_kl.item(), global_step)
        writer.add_scalar("losses/approx_kl", approx_kl.item(), global_step)
        writer.add_scalar("losses/clipfrac", np.mean(clipfracs), global_step)
        writer.add_scalar("losses/explained_variance", explained_var, global_step)
        print("SPS:", int(global_step / (time.time() - start_time)))
        writer.add_scalar("charts/SPS", int(global_step / (time.time() - start_time)), global_step)
        if (
            args.save_model_interval > 0
            and global_step - last_checkpoint_step >= args.save_model_interval
        ):
            save_actor_critic(agent, args.save_model_dir, run_name, global_step)
            last_checkpoint_step = global_step

    if args.save_state_heatmap:
        export_state_heatmaps(args, run_name, envs, phase_heatmaps)

    envs.close()
    writer.close()
