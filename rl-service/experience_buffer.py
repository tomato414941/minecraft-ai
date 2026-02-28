import json
import os
from collections import deque

import numpy as np


class ExperienceBuffer:
    def __init__(self, capacity: int = 50000):
        self.buffer: deque = deque(maxlen=capacity)

    def add(
        self,
        state: np.ndarray,
        action: int,
        reward: float,
        next_state: np.ndarray,
        done: bool,
    ):
        self.buffer.append((state, action, reward, next_state, done))

    def sample(self, batch_size: int):
        indices = np.random.choice(len(self.buffer), batch_size, replace=False)
        batch = [self.buffer[i] for i in indices]
        states, actions, rewards, next_states, dones = zip(*batch)
        return (
            np.array(states, dtype=np.float32),
            np.array(actions, dtype=np.int64),
            np.array(rewards, dtype=np.float32),
            np.array(next_states, dtype=np.float32),
            np.array(dones, dtype=np.float32),
        )

    def save(self, path: str):
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        data = [
            (s.tolist(), int(a), float(r), ns.tolist(), bool(d))
            for s, a, r, ns, d in self.buffer
        ]
        with open(path, "w") as f:
            json.dump(data, f)

    def load(self, path: str):
        if not os.path.exists(path):
            return
        with open(path, "r") as f:
            data = json.load(f)
        for s, a, r, ns, d in data:
            self.add(np.array(s, dtype=np.float32), a, r, np.array(ns, dtype=np.float32), d)

    def __len__(self):
        return len(self.buffer)
