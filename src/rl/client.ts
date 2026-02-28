import { logger } from "../utils/logger";
import type { GameState } from "../state/observer";
import { encodeState } from "./state-encoder";
import { ACTION_TO_INDEX } from "./action-map";

export interface RLPrediction {
  action: string;
  params: Record<string, unknown>;
  confidence: number;
  qValue: number;
}

export class RLClient {
  private baseUrl: string;
  private timeout: number;
  private _available = false;
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;

  constructor(baseUrl: string, timeout = 2000) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
  }

  async start(): Promise<void> {
    await this.checkHealth();
    this.healthCheckTimer = setInterval(() => this.checkHealth(), 30000);
  }

  stop(): void {
    if (this.healthCheckTimer) clearInterval(this.healthCheckTimer);
  }

  get available(): boolean {
    return this._available;
  }

  async predict(state: GameState): Promise<RLPrediction> {
    const stateVector = encodeState(state);
    const res = await this.post("/predict", { state_vector: stateVector });
    return res as RLPrediction;
  }

  async sendExperience(
    state: GameState,
    action: string,
    reward: number,
    nextState: GameState,
    done: boolean,
  ): Promise<void> {
    if (!this._available) return;
    const actionIdx = ACTION_TO_INDEX[action] ?? 5;
    try {
      await this.post("/experience", {
        state_vector: encodeState(state),
        action_idx: actionIdx,
        reward,
        next_state_vector: encodeState(nextState),
        done,
      });
    } catch {
      logger.warn("Failed to send experience to RL service");
    }
  }

  async triggerTraining(nSteps = 100): Promise<void> {
    if (!this._available) return;
    try {
      await this.post("/train", { n_steps: nSteps });
      logger.info("RL training triggered");
    } catch {
      logger.warn("Failed to trigger RL training");
    }
  }

  private async post(path: string, body: unknown): Promise<unknown> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`RL ${path}: ${res.status}`);
      return await res.json();
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  private async checkHealth(): Promise<void> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(3000),
      });
      const wasAvailable = this._available;
      this._available = res.ok;
      if (this._available && !wasAvailable) {
        logger.info("RL service: connected");
      }
    } catch {
      if (this._available) {
        logger.warn("RL service: disconnected (LLM fallback)");
      }
      this._available = false;
    }
  }
}
