import os

import numpy as np
import torch
from fastapi import FastAPI
from pydantic import BaseModel

from action_space import decode_action
from experience_buffer import ExperienceBuffer
from model import MinecraftRLModel, OBS_DIM, N_ACTIONS, N_PARAMS_PER_ACTION
from trainer import Trainer

app = FastAPI(title="Minecraft RL Service")

MODEL_PATH = os.environ.get("MODEL_PATH", "/data/model.pt")
BUFFER_PATH = os.environ.get("BUFFER_PATH", "/data/buffer.json")

model = MinecraftRLModel()
buffer = ExperienceBuffer(capacity=50000)
trainer = Trainer(model, buffer)

# Load existing model if available
if os.path.exists(MODEL_PATH):
    model.load_state_dict(torch.load(MODEL_PATH, weights_only=True))

# Load existing buffer if available
buffer.load(BUFFER_PATH)


class PredictRequest(BaseModel):
    state_vector: list[float]


class PredictResponse(BaseModel):
    action: str
    params: dict
    confidence: float
    q_value: float


class ExperienceRequest(BaseModel):
    state_vector: list[float]
    action_idx: int
    reward: float
    next_state_vector: list[float]
    done: bool


class TrainRequest(BaseModel):
    n_steps: int = 100


@app.get("/health")
def health():
    return {
        "status": "ok",
        "buffer_size": len(buffer),
        "train_steps": trainer.train_steps,
    }


@app.get("/stats")
def stats():
    return {
        "buffer_size": len(buffer),
        "train_steps": trainer.train_steps,
        "model_params": sum(p.numel() for p in model.parameters()),
        "last_loss": trainer.last_loss,
    }


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    if len(req.state_vector) != OBS_DIM:
        return PredictResponse(
            action="explore",
            params={"direction": "random", "count": 20},
            confidence=0.0,
            q_value=0.0,
        )

    obs = torch.tensor(req.state_vector, dtype=torch.float32).unsqueeze(0)

    with torch.no_grad():
        action_logits, param_values, value = model(obs)

    action_probs = torch.softmax(action_logits, dim=-1).squeeze(0)
    action_idx = torch.argmax(action_probs).item()
    confidence = action_probs[action_idx].item()

    start = action_idx * N_PARAMS_PER_ACTION
    end = start + N_PARAMS_PER_ACTION
    raw_params = param_values.squeeze(0)[start:end].tolist()

    decoded = decode_action(action_idx, raw_params)

    return PredictResponse(
        action=decoded["action"],
        params=decoded["params"],
        confidence=float(confidence),
        q_value=float(value.item()),
    )


@app.post("/experience")
def add_experience(req: ExperienceRequest):
    buffer.add(
        state=np.array(req.state_vector, dtype=np.float32),
        action=req.action_idx,
        reward=req.reward,
        next_state=np.array(req.next_state_vector, dtype=np.float32),
        done=req.done,
    )
    return {"buffer_size": len(buffer)}


@app.post("/train")
def trigger_training(req: TrainRequest):
    if len(buffer) < 256:
        return {"status": "skip", "reason": f"buffer too small: {len(buffer)}"}

    loss = trainer.train_step(batch_size=64, n_steps=req.n_steps)

    # Auto-save model and buffer
    os.makedirs(os.path.dirname(MODEL_PATH) or ".", exist_ok=True)
    torch.save(model.state_dict(), MODEL_PATH)
    buffer.save(BUFFER_PATH)

    return {
        "status": "ok",
        "loss": loss,
        "train_steps": trainer.train_steps,
        "buffer_size": len(buffer),
    }


@app.post("/save")
def save_model():
    os.makedirs(os.path.dirname(MODEL_PATH) or ".", exist_ok=True)
    torch.save(model.state_dict(), MODEL_PATH)
    buffer.save(BUFFER_PATH)
    return {"status": "saved"}


@app.post("/load")
def load_model():
    if os.path.exists(MODEL_PATH):
        model.load_state_dict(torch.load(MODEL_PATH, weights_only=True))
        return {"status": "loaded"}
    return {"status": "not_found"}
