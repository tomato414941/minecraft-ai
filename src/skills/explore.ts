import type { Bot } from "mineflayer";
import type { ActionParams, SkillResult } from "./index.js";
import { goals } from "mineflayer-pathfinder";

export async function explore(bot: Bot, params: ActionParams): Promise<SkillResult> {
  const direction = (params.direction as string) ?? "random";
  const distance = (params.count as number) ?? 30;

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
    await bot.pathfinder.goto(goal);
    const newPos = bot.entity.position;
    return {
      success: true,
      message: `Explored to (${Math.round(newPos.x)}, ${Math.round(newPos.z)})`,
    };
  } catch {
    return { success: false, message: `Could not reach target (${Math.round(targetX)}, ${Math.round(targetZ)})` };
  }
}
