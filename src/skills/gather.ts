import type { Bot } from "mineflayer";
import type { ActionParams, SkillResult } from "./index.js";
import { goals } from "mineflayer-pathfinder";

export async function gather(bot: Bot, params: ActionParams): Promise<SkillResult> {
  const target = params.target ?? "oak_log";
  const count = params.count ?? 1;

  const mcData = (await import("minecraft-data")).default(bot.version);
  const blockType = mcData.blocksByName[target];
  if (!blockType) {
    return { success: false, message: `Unknown block: ${target}` };
  }

  let collected = 0;
  for (let i = 0; i < count; i++) {
    const block = bot.findBlock({
      matching: blockType.id,
      maxDistance: 64,
    });

    if (!block) {
      if (collected > 0) {
        return { success: true, message: `Collected ${collected}/${count} ${target} (no more found)` };
      }
      return { success: false, message: `No ${target} found nearby` };
    }

    // Move to block
    const goal = new goals.GoalNear(block.position.x, block.position.y, block.position.z, 2);
    try {
      await bot.pathfinder.goto(goal);
    } catch {
      return { success: false, message: `Cannot reach ${target} at ${block.position}` };
    }

    // Equip best tool
    await equipBestTool(bot, block);

    // Dig
    try {
      await bot.dig(block);
      collected++;
    } catch {
      return { success: false, message: `Failed to dig ${target}` };
    }

    // Wait for drops
    await sleep(300);
  }

  return { success: true, message: `Collected ${collected} ${target}` };
}

async function equipBestTool(bot: Bot, block: any): Promise<void> {
  const items = bot.inventory.items();
  let bestTool = null;
  let bestTime = Infinity;

  for (const item of items) {
    const time = block.digTime(item.type, false, false, false, [], []);
    if (time < bestTime) {
      bestTime = time;
      bestTool = item;
    }
  }

  if (bestTool) {
    try {
      await bot.equip(bestTool, "hand");
    } catch {
      // ignore
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
