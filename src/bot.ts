import mineflayer from "mineflayer";
import { pathfinder } from "mineflayer-pathfinder";
import { plugin as collectBlock } from "mineflayer-collectblock";
import { plugin as pvpPlugin } from "mineflayer-pvp";
import { mineflayer as mineflayerViewer } from "prismarine-viewer";
import { logger } from "./utils/logger";

const VIEWER_PORT = parseInt(process.env.VIEWER_PORT ?? "3000", 10);

export interface BotConfig {
  host: string;
  port: number;
  username: string;
}

export function createBot(config: BotConfig): mineflayer.Bot {
  logger.info(`Connecting to ${config.host}:${config.port} as ${config.username}`);

  const bot = mineflayer.createBot({
    host: config.host,
    port: config.port,
    username: config.username,
    hideErrors: false,
  });

  bot.loadPlugin(pathfinder);
  bot.loadPlugin(collectBlock);
  bot.loadPlugin(pvpPlugin);

  bot.once("spawn", () => {
    logger.info("Bot spawned in the world");
    const pos = bot.entity.position;
    logger.info(`Position: ${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`);

    try {
      mineflayerViewer(bot, { port: VIEWER_PORT, firstPerson: true });
      logger.info(`Viewer started on http://0.0.0.0:${VIEWER_PORT}`);
    } catch (err) {
      logger.warn(`Failed to start viewer: ${err}`);
    }
  });

  bot.on("health", () => {
    logger.info(`Health: ${bot.health.toFixed(1)} | Food: ${bot.food}`);
  });

  bot.on("death", () => {
    logger.warn("Bot died! Respawning...");
  });

  bot.on("kicked", (reason) => {
    logger.error(`Kicked: ${reason}`);
  });

  bot.on("error", (err) => {
    logger.error(`Bot error: ${err.message}`);
  });

  bot.on("end", () => {
    logger.warn("Bot disconnected");
  });

  return bot;
}
