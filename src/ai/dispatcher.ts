import type { GameState } from "../state/observer";
import type { RLClient } from "../rl/client";
import type { RLConfig } from "../rl/config";

export interface DispatchDecision {
  source: "rl" | "llm";
  reason: string;
}

export class Dispatcher {
  private config: RLConfig;
  private rlClient: RLClient;
  private totalSteps = 0;

  constructor(config: RLConfig, rlClient: RLClient) {
    this.config = config;
    this.rlClient = rlClient;
  }

  decide(state: GameState): DispatchDecision {
    this.totalSteps++;

    // RL disabled
    if (!this.config.enabled) {
      return { source: "llm", reason: "RL disabled" };
    }

    // RL service not available
    if (!this.rlClient.available) {
      return { source: "llm", reason: "RL service unavailable" };
    }

    // Warmup period: collect experience with LLM only
    if (this.totalSteps < this.config.warmupSteps) {
      return { source: "llm", reason: `warmup (${this.totalSteps}/${this.config.warmupSteps})` };
    }

    // Hostile mob nearby → RL for fast reaction
    const hostiles = state.nearbyEntities.filter((e) => e.hostile);
    if (hostiles.length > 0 && hostiles[0].distance < 16) {
      return { source: "rl", reason: `hostile ${hostiles[0].name} at ${hostiles[0].distance}m` };
    }

    // Low health → RL
    if (state.health <= 10) {
      return { source: "rl", reason: `low health: ${state.health}` };
    }

    // Low food → RL
    if (state.food <= 6) {
      return { source: "rl", reason: `low food: ${state.food}` };
    }

    // Night time → RL
    if (!state.time.isDay) {
      return { source: "rl", reason: "night-time" };
    }

    // Default: LLM for strategic decisions
    return { source: "llm", reason: "strategic planning" };
  }

  get steps(): number {
    return this.totalSteps;
  }
}
