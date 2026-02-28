import type { Bot } from "mineflayer";
import type { ActionParams, SkillResult } from "./index";

const FOOD_ITEMS = [
  "cooked_beef",
  "cooked_porkchop",
  "cooked_chicken",
  "cooked_mutton",
  "cooked_salmon",
  "cooked_cod",
  "bread",
  "golden_apple",
  "apple",
  "baked_potato",
  "cooked_rabbit",
  "mushroom_stew",
  "beetroot_soup",
  "carrot",
  "potato",
  "melon_slice",
  "sweet_berries",
  "dried_kelp",
  "beef",
  "porkchop",
  "chicken",
  "mutton",
  "rabbit",
  "rotten_flesh",
];

export async function eat(bot: Bot, params: ActionParams): Promise<SkillResult> {
  const preferred = params.target;

  // Find food in inventory
  let foodItem = null;

  if (preferred) {
    foodItem = bot.inventory.items().find((i) => i.name === preferred);
  }

  if (!foodItem) {
    for (const foodName of FOOD_ITEMS) {
      foodItem = bot.inventory.items().find((i) => i.name === foodName);
      if (foodItem) break;
    }
  }

  if (!foodItem) {
    return { success: false, message: "No food in inventory" };
  }

  try {
    await bot.equip(foodItem, "hand");
    await bot.consume();
    return { success: true, message: `Ate ${foodItem.name}` };
  } catch (err) {
    return { success: false, message: `Failed to eat: ${err}` };
  }
}
