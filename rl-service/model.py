import torch
import torch.nn as nn

OBS_DIM = 85
N_ACTIONS = 6
N_PARAMS_PER_ACTION = 4


class MinecraftRLModel(nn.Module):
    """
    Actor-Critic MLP with hybrid action space.

    Outputs:
      - action_logits: probability distribution over 6 discrete skills
      - param_values: continuous parameters per action (N_ACTIONS * N_PARAMS_PER_ACTION)
      - value: state value estimate (scalar)
    """

    def __init__(
        self,
        obs_dim: int = OBS_DIM,
        hidden: int = 128,
        n_actions: int = N_ACTIONS,
        n_params: int = N_PARAMS_PER_ACTION,
    ):
        super().__init__()
        self.n_actions = n_actions
        self.n_params = n_params

        self.backbone = nn.Sequential(
            nn.Linear(obs_dim, hidden),
            nn.ReLU(),
            nn.Linear(hidden, hidden),
            nn.ReLU(),
        )

        self.action_head = nn.Sequential(
            nn.Linear(hidden, 64),
            nn.ReLU(),
            nn.Linear(64, n_actions),
        )

        self.param_head = nn.Sequential(
            nn.Linear(hidden, 64),
            nn.ReLU(),
            nn.Linear(64, n_actions * n_params),
        )

        self.value_head = nn.Sequential(
            nn.Linear(hidden, 64),
            nn.ReLU(),
            nn.Linear(64, 1),
        )

    def forward(self, obs: torch.Tensor):
        features = self.backbone(obs)
        action_logits = self.action_head(features)
        param_values = self.param_head(features)
        value = self.value_head(features)
        return action_logits, param_values, value
