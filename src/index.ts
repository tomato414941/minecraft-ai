import { createBot } from "./bot.js";
import { Planner } from "./ai/planner.js";
import { observeState, stateToString, type GameState } from "./state/observer.js";
import { executeSkill } from "./skills/index.js";
import { logger } from "./utils/logger.js";

const MC_HOST = process.env.MC_HOST ?? "localhost";
const MC_PORT = parseInt(process.env.MC_PORT ?? "25565", 10);
const API_KEY = process.env.ANTHROPIC_API_KEY;
const LOOP_INTERVAL_MS = 8000;
const BOT_USERNAME = "ClaudeBot";

if (!API_KEY) {
  logger.error("ANTHROPIC_API_KEY is required");
  process.exit(1);
}

const planner = new Planner(API_KEY);
const bot = createBot({ host: MC_HOST, port: MC_PORT, username: BOT_USERNAME });

let lastResult: string | null = null;
let lastState: GameState | null = null;
let running = false;

bot.once("spawn", () => {
  logger.info("=== Minecraft AI Bot Started ===");
  logger.info(`Connected to ${MC_HOST}:${MC_PORT}`);

  // Wait a moment for world to load
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
      logger.info(stateToString(state));

      // 2. Skip API call if nothing changed significantly
      if (lastState && !hasSignificantChange(lastState, state)) {
        logger.info("No significant change, waiting...");
        await sleep(LOOP_INTERVAL_MS);
        continue;
      }
      lastState = state;

      // 3. Plan
      const plan = await planner.decide(stateToString(state), lastResult);

      // 4. Execute
      const result = await executeSkill(bot, plan.action, plan.params);
      lastResult = `${plan.action}: ${result.message}`;

      // 5. Wait before next loop
      await sleep(LOOP_INTERVAL_MS);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Game loop error: ${msg}`);
      await sleep(LOOP_INTERVAL_MS * 2);
    }
  }
}

function hasSignificantChange(prev: GameState, curr: GameState): boolean {
  // Health or food changed
  if (Math.abs(prev.health - curr.health) >= 2) return true;
  if (Math.abs(prev.food - curr.food) >= 2) return true;

  // Time phase changed (day/night)
  if (prev.time.isDay !== curr.time.isDay) return true;

  // New hostile nearby
  const prevHostiles = prev.nearbyEntities.filter((e) => e.hostile).length;
  const currHostiles = curr.nearbyEntities.filter((e) => e.hostile).length;
  if (currHostiles > prevHostiles) return true;

  // Inventory changed
  if (prev.inventory.length !== curr.inventory.length) return true;

  // Always act at least every other loop
  return true;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Graceful shutdown
process.on("SIGINT", () => {
  logger.info("Shutting down...");
  running = false;
  bot.quit();
  process.exit(0);
});

process.on("SIGTERM", () => {
  running = false;
  bot.quit();
  process.exit(0);
});
