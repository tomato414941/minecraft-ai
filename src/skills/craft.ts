import type { Bot } from "mineflayer";
import type { ActionParams, SkillResult } from "./index.js";
import { goals } from "mineflayer-pathfinder";

export async function craft(bot: Bot, params: ActionParams): Promise<SkillResult> {
  const item = params.target ?? params.item;
  if (!item) {
    return { success: false, message: "No item specified to craft" };
  }
  const count = params.count ?? 1;

  const mcData = (await import("minecraft-data")).default(bot.version);
  const itemType = mcData.itemsByName[item];
  if (!itemType) {
    return { success: false, message: `Unknown item: ${item}` };
  }

  // Find recipe
  const recipes = bot.recipesFor(itemType.id, null, 1, null);

  if (recipes.length === 0) {
    // Try with crafting table
    const craftingTable = bot.findBlock({
      matching: mcData.blocksByName["crafting_table"]?.id,
      maxDistance: 32,
    });

    if (craftingTable) {
      const goal = new goals.GoalNear(
        craftingTable.position.x,
        craftingTable.position.y,
        craftingTable.position.z,
        2,
      );
      try {
        await bot.pathfinder.goto(goal);
      } catch {
        return { success: false, message: "Cannot reach crafting table" };
      }

      const tableRecipes = bot.recipesFor(itemType.id, null, 1, craftingTable);
      if (tableRecipes.length === 0) {
        return { success: false, message: `No recipe found for ${item}` };
      }

      try {
        await bot.craft(tableRecipes[0], count, craftingTable);
        return { success: true, message: `Crafted ${count} ${item}` };
      } catch (err) {
        return { success: false, message: `Failed to craft ${item}: ${err}` };
      }
    }

    return { success: false, message: `No recipe found for ${item} (no crafting table nearby)` };
  }

  try {
    await bot.craft(recipes[0], count);
    return { success: true, message: `Crafted ${count} ${item}` };
  } catch (err) {
    return { success: false, message: `Failed to craft ${item}: ${err}` };
  }
}
