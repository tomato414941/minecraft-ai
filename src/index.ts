import { createBot } from "./bot";
import { Planner, type Plan } from "./ai/planner";
import { Dispatcher } from "./ai/dispatcher";
import { observeState, stateToString, type GameState } from "./state/observer";
import { executeSkill } from "./skills/index";
import { RLClient } from "./rl/client";
import { loadRLConfig } from "./rl/config";
import { computeReward } from "./rl/reward";
import { logger } from "./utils/logger";

const MC_HOST = process.env.MC_HOST ?? "localhost";
const MC_PORT = parseInt(process.env.MC_PORT ?? "25565", 10);
const API_KEY = process.env.ANTHROPIC_API_KEY;
const BOT_USERNAME = "ClaudeBot";

if (!API_KEY) {
  logger.error("ANTHROPIC_API_KEY is required");
  process.exit(1);
}

const rlConfig = loadRLConfig();
const planner = new Planner(API_KEY);
const rlClient = new RLClient(rlConfig.serviceUrl, rlConfig.serviceTimeout);
const dispatcher = new Dispatcher(rlConfig, rlClient);
const bot = createBot({ host: MC_HOST, port: MC_PORT, username: BOT_USERNAME });

let lastResult: string | null = null;
let lastState: GameState | null = null;
let running = false;
let stepCount = 0;

bot.once("spawn", async () => {
  logger.info("=== Minecraft AI Bot (Phase 2: LLM + RL) ===");
  logger.info(`Connected to ${MC_HOST}:${MC_PORT}`);
  logger.info(`RL enabled: ${rlConfig.enabled}`);

  if (rlConfig.enabled) {
    await rlClient.start();
  }

  setTimeout(() => {
    running = true;
    gameLoop();
  }, 3000);
});

async function gameLoop() {
  while (running) {
    try {
      // 1. Observe
      const state = observeState(bot);
      const prevState = lastState;
      lastState = state;

      logger.info(stateToString(state));

      // 2. Dispatch: decide RL or LLM
      const dispatch = dispatcher.decide(state);
      logger.info(`[Dispatcher] ${dispatch.source} (${dispatch.reason})`);

      // 3. Get action plan
      let plan: Plan;
      let usedRL = false;

      if (dispatch.source === "rl") {
        try {
          const rlResult = await rlClient.predict(state);
          logger.info(`[RL] action=${rlResult.action} confidence=${rlResult.confidence.toFixed(2)} q=${rlResult.qValue.toFixed(2)}`);

          if (rlResult.confidence >= rlConfig.confidenceThreshold) {
            plan = {
              thought: `RL(${rlResult.confidence.toFixed(2)})`,
              action: rlResult.action,
              params: rlResult.params,
            };
            usedRL = true;
          } else {
            logger.info(`[RL] confidence too low, falling back to LLM`);
            plan = await planner.decide(stateToString(state), lastResult);
          }
        } catch {
          logger.warn("[RL] prediction failed, falling back to LLM");
          plan = await planner.decide(stateToString(state), lastResult);
        }
      } else {
        plan = await planner.decide(stateToString(state), lastResult);
      }

      // 4. Execute skill
      const result = await executeSkill(bot, plan.action, plan.params);
      lastResult = `${plan.action}: ${result.message}`;

      // 5. Collect experience for RL training
      if (rlConfig.enabled && (rlConfig.collectInLLMMode || usedRL)) {
        const nextState = observeState(bot);
        const reward = computeReward(prevState, nextState, result);
        await rlClient.sendExperience(state, plan.action, reward, nextState, false);

        stepCount++;

        // Trigger training periodically
        if (stepCount % rlConfig.trainEveryNSteps === 0 && stepCount > 0) {
          logger.info(`[RL] Triggering training at step ${stepCount}`);
          await rlClient.triggerTraining(rlConfig.trainingBatchSteps);
        }
      }

      // 6. Wait (shorter for RL reactive mode)
      const interval = usedRL
        ? rlConfig.reactiveLoopInterval
        : rlConfig.strategicLoopInterval;
      await sleep(interval);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Game loop error: ${msg}`);
      await sleep(rlConfig.strategicLoopInterval * 2);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

process.on("SIGINT", () => {
  logger.info("Shutting down...");
  running = false;
  rlClient.stop();
  bot.quit();
  process.exit(0);
});

process.on("SIGTERM", () => {
  running = false;
  rlClient.stop();
  bot.quit();
  process.exit(0);
});
