import copy

import torch
import torch.nn.functional as F

from model import MinecraftRLModel
from experience_buffer import ExperienceBuffer


class Trainer:
    def __init__(
        self,
        model: MinecraftRLModel,
        buffer: ExperienceBuffer,
        lr: float = 3e-4,
        gamma: float = 0.99,
        tau: float = 0.005,
        entropy_coeff: float = 0.01,
    ):
        self.model = model
        self.target_model = copy.deepcopy(model)
        self.buffer = buffer
        self.optimizer = torch.optim.Adam(model.parameters(), lr=lr)
        self.gamma = gamma
        self.tau = tau
        self.entropy_coeff = entropy_coeff
        self.train_steps = 0
        self.last_loss: float | None = None

    def train_step(self, batch_size: int = 64, n_steps: int = 100) -> float:
        total_loss = 0.0

        for _ in range(n_steps):
            if len(self.buffer) < batch_size:
                break

            states, actions, rewards, next_states, dones = self.buffer.sample(
                batch_size
            )

            states_t = torch.tensor(states)
            actions_t = torch.tensor(actions)
            rewards_t = torch.tensor(rewards)
            next_states_t = torch.tensor(next_states)
            dones_t = torch.tensor(dones)

            # Forward
            action_logits, _, values = self.model(states_t)
            with torch.no_grad():
                _, _, next_values = self.target_model(next_states_t)

            # TD target
            td_target = rewards_t + self.gamma * next_values.squeeze(-1) * (
                1 - dones_t
            )

            # Value loss
            value_loss = F.mse_loss(values.squeeze(-1), td_target)

            # Policy loss
            advantage = (td_target - values.squeeze(-1)).detach()
            log_probs = F.log_softmax(action_logits, dim=-1)
            action_log_probs = log_probs.gather(1, actions_t.unsqueeze(1)).squeeze(1)
            policy_loss = -(action_log_probs * advantage).mean()

            # Entropy bonus
            probs = torch.exp(log_probs)
            entropy = -(probs * log_probs).sum(dim=-1).mean()

            loss = value_loss + policy_loss - self.entropy_coeff * entropy

            self.optimizer.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(self.model.parameters(), 0.5)
            self.optimizer.step()

            total_loss += loss.item()
            self.train_steps += 1

            if self.train_steps % 10 == 0:
                self._soft_update()

        avg_loss = total_loss / max(n_steps, 1)
        self.last_loss = avg_loss
        return avg_loss

    def _soft_update(self):
        for tp, p in zip(
            self.target_model.parameters(), self.model.parameters()
        ):
            tp.data.copy_(self.tau * p.data + (1.0 - self.tau) * tp.data)
