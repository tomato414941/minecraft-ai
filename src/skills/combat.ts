import type { Bot } from "mineflayer";
import type { ActionParams, SkillResult } from "./index";
import { goals } from "mineflayer-pathfinder";

export async function combat(bot: Bot, params: ActionParams): Promise<SkillResult> {
  const targetName = params.target;
  const mode = (params.mode as string) ?? "fight";

  if (mode === "flee") {
    return flee(bot);
  }

  // Find target entity
  let target = null;
  const entities = Object.values(bot.entities);

  if (targetName) {
    target = entities.find(
      (e) =>
        e !== bot.entity &&
        (e.name === targetName || e.username === targetName) &&
        e.position.distanceTo(bot.entity.position) < 32,
    );
  } else {
    // Find nearest hostile
    const hostiles = entities
      .filter((e) => e !== bot.entity && e.type === "hostile" && e.position.distanceTo(bot.entity.position) < 16)
      .sort((a, b) => a.position.distanceTo(bot.entity.position) - b.position.distanceTo(bot.entity.position));
    target = hostiles[0] ?? null;
  }

  if (!target) {
    return { success: false, message: `No target found: ${targetName ?? "nearest hostile"}` };
  }

  // Equip best weapon
  await equipBestWeapon(bot);

  // Attack using pvp plugin
  try {
    bot.pvp.attack(target);
    // Wait until fight ends (target dead or out of range)
    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (!target!.isValid || target!.position.distanceTo(bot.entity.position) > 32 || bot.health <= 4) {
          clearInterval(check);
          bot.pvp.stop();
          resolve();
        }
      }, 500);
      // Timeout after 30s
      setTimeout(() => {
        clearInterval(check);
        bot.pvp.stop();
        resolve();
      }, 30000);
    });

    if (bot.health <= 4) {
      return { success: true, message: "Retreated due to low health" };
    }
    return { success: true, message: `Fought ${target.name ?? targetName}` };
  } catch (err) {
    return { success: false, message: `Combat failed: ${err}` };
  }
}

async function flee(bot: Bot): Promise<SkillResult> {
  const pos = bot.entity.position;
  // Move away from the nearest hostile
  const hostiles = Object.values(bot.entities)
    .filter((e) => e !== bot.entity && e.type === "hostile" && e.position.distanceTo(pos) < 16)
    .sort((a, b) => a.position.distanceTo(pos) - b.position.distanceTo(pos));

  if (hostiles.length === 0) {
    return { success: true, message: "No hostiles to flee from" };
  }

  const hostile = hostiles[0];
  const dx = pos.x - hostile.position.x;
  const dz = pos.z - hostile.position.z;
  const len = Math.sqrt(dx * dx + dz * dz) || 1;

  const fleeGoal = new goals.GoalXZ(
    Math.round(pos.x + (dx / len) * 20),
    Math.round(pos.z + (dz / len) * 20),
  );

  try {
    await bot.pathfinder.goto(fleeGoal);
    return { success: true, message: "Fled from hostiles" };
  } catch {
    return { success: false, message: "Failed to flee" };
  }
}

async function equipBestWeapon(bot: Bot): Promise<void> {
  const weapons = ["netherite_sword", "diamond_sword", "iron_sword", "stone_sword", "wooden_sword", "netherite_axe", "diamond_axe", "iron_axe", "stone_axe", "wooden_axe"];
  for (const weaponName of weapons) {
    const weapon = bot.inventory.items().find((i) => i.name === weaponName);
    if (weapon) {
      try {
        await bot.equip(weapon, "hand");
      } catch {
        // ignore
      }
      return;
    }
  }
}
