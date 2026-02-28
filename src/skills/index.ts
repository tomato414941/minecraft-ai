import type { Bot } from "mineflayer";
import { gather } from "./gather.js";
import { craft } from "./craft.js";
import { eat } from "./eat.js";
import { combat } from "./combat.js";
import { shelter } from "./shelter.js";
import { explore } from "./explore.js";
import { logger } from "../utils/logger.js";

export interface SkillResult {
  success: boolean;
  message: string;
}

export interface ActionParams {
  target?: string;
  count?: number;
  item?: string;
  direction?: string;
  [key: string]: unknown;
}

export type SkillFn = (bot: Bot, params: ActionParams) => Promise<SkillResult>;

const skills: Record<string, SkillFn> = {
  gather,
  craft,
  eat,
  combat,
  shelter,
  explore,
};

export async function executeSkill(
  bot: Bot,
  action: string,
  params: ActionParams,
): Promise<SkillResult> {
  const skill = skills[action];
  if (!skill) {
    return { success: false, message: `Unknown skill: ${action}` };
  }

  logger.action(`Executing: ${action}`, params);

  try {
    const result = await skill(bot, params);
    if (result.success) {
      logger.action(`Completed: ${action} - ${result.message}`);
    } else {
      logger.warn(`Failed: ${action} - ${result.message}`);
    }
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`Skill error (${action}): ${msg}`);
    return { success: false, message: msg };
  }
}
