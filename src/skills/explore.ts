import type { Bot } from "mineflayer";
import type { ActionParams, SkillResult } from "./index";
import { goals } from "mineflayer-pathfinder";

const MAX_EXPLORE_MS = 30000;
const MAX_DISTANCE = 50;

export async function explore(bot: Bot, params: ActionParams): Promise<SkillResult> {
  const direction = (params.direction as string) ?? "random";
  const distance = Math.min((params.count as number) ?? 30, MAX_DISTANCE);

  const pos = bot.entity.position;
  let targetX = pos.x;
  let targetZ = pos.z;

  switch (direction) {
    case "north":
      targetZ -= distance;
      break;
    case "south":
      targetZ += distance;
      break;
    case "east":
      targetX += distance;
      break;
    case "west":
      targetX -= distance;
      break;
    case "random":
    default: {
      const angle = Math.random() * Math.PI * 2;
      targetX += Math.cos(angle) * distance;
      targetZ += Math.sin(angle) * distance;
      break;
    }
  }

  const goal = new goals.GoalXZ(Math.round(targetX), Math.round(targetZ));

  try {
    await Promise.race([
      bot.pathfinder.goto(goal),
      new Promise<never>((_, reject) =>
        setTimeout(() => {
          bot.pathfinder.stop();
          reject(new Error("timeout"));
        }, MAX_EXPLORE_MS),
      ),
    ]);
    const newPos = bot.entity.position;
    return {
      success: true,
      message: `Explored to (${Math.round(newPos.x)}, ${Math.round(newPos.z)})`,
    };
  } catch {
    const newPos = bot.entity.position;
    const moved = Math.sqrt(
      (newPos.x - pos.x) ** 2 + (newPos.z - pos.z) ** 2,
    );
    if (moved > 5) {
      return { success: true, message: `Partially explored to (${Math.round(newPos.x)}, ${Math.round(newPos.z)})` };
    }
    return { success: false, message: `Could not reach target (${Math.round(targetX)}, ${Math.round(targetZ)})` };
  }
}
