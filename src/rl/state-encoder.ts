import type { GameState, InventoryItem } from "../state/observer";

export const OBS_DIM = 85;

const ENTITY_TYPE_MAP: Record<string, number> = {
  zombie: 0.1, skeleton: 0.2, creeper: 0.3, spider: 0.4,
  enderman: 0.5, witch: 0.6, phantom: 0.7, drowned: 0.8,
  husk: 0.15, stray: 0.25, blaze: 0.35, ghast: 0.45,
  cow: -0.1, pig: -0.2, sheep: -0.3, chicken: -0.4,
  horse: -0.5, villager: -0.6, wolf: -0.7, cat: -0.8,
};

const BIOME_LIST = [
  "plains", "forest", "desert", "mountains", "taiga",
  "swamp", "jungle", "ocean", "savanna", "unknown",
];

const ITEM_CATEGORIES: Record<string, string> = {
  oak_log: "wood", birch_log: "wood", spruce_log: "wood", jungle_log: "wood",
  oak_planks: "wood", birch_planks: "wood", spruce_planks: "wood",
  cobblestone: "stone", stone: "stone", deepslate: "stone",
  iron_ingot: "iron", iron_ore: "iron", raw_iron: "iron",
  coal: "fuel", charcoal: "fuel",
  diamond: "diamond", diamond_ore: "diamond",
  gold_ingot: "gold", gold_ore: "gold",
  cooked_beef: "food", cooked_porkchop: "food", bread: "food",
  cooked_chicken: "food", apple: "food", baked_potato: "food",
  carrot: "food", melon_slice: "food", sweet_berries: "food",
  wooden_pickaxe: "tool_wood", wooden_axe: "tool_wood", wooden_sword: "tool_wood",
  stone_pickaxe: "tool_stone", stone_axe: "tool_stone", stone_sword: "tool_stone",
  iron_pickaxe: "tool_iron", iron_axe: "tool_iron", iron_sword: "tool_iron",
  diamond_pickaxe: "tool_diamond", diamond_axe: "tool_diamond", diamond_sword: "tool_diamond",
  leather_helmet: "armor", leather_chestplate: "armor", leather_leggings: "armor",
  iron_helmet: "armor", iron_chestplate: "armor", iron_leggings: "armor",
  stick: "misc", crafting_table: "misc", furnace: "misc", torch: "misc", chest: "misc",
};

const INVENTORY_CATEGORIES = [
  "wood", "stone", "iron", "fuel", "diamond", "gold",
  "food", "tool_wood", "tool_stone", "tool_iron", "tool_diamond",
  "armor", "misc", "other", "total",
];

const BLOCK_CATEGORIES: Record<string, string> = {
  oak_log: "tree", birch_log: "tree", spruce_log: "tree",
  oak_leaves: "tree", birch_leaves: "tree", spruce_leaves: "tree",
  stone: "stone", cobblestone: "stone", deepslate: "stone",
  iron_ore: "ore", coal_ore: "ore", diamond_ore: "ore", gold_ore: "ore",
  copper_ore: "ore", lapis_ore: "ore", redstone_ore: "ore",
  dirt: "terrain", grass_block: "terrain", sand: "terrain", gravel: "terrain",
  water: "water", lava: "lava",
  tall_grass: "plant", fern: "plant", dandelion: "plant", poppy: "plant",
  crafting_table: "crafted", furnace: "crafted", chest: "crafted",
};

const BLOCK_CATEGORY_LIST = [
  "tree", "stone", "ore", "terrain", "water", "lava",
  "plant", "crafted", "other", "total",
];

export function encodeState(state: GameState): number[] {
  const v: number[] = [];

  // [0-3] Core vitals
  v.push(state.health / 20.0);
  v.push(state.food / 20.0);
  v.push(state.time.isDay ? 1.0 : 0.0);
  v.push(state.isRaining ? 1.0 : 0.0);

  // [4-5] Time (cyclical encoding)
  const timeNorm = state.time.timeOfDay / 24000.0;
  v.push(Math.sin(2 * Math.PI * timeNorm));
  v.push(Math.cos(2 * Math.PI * timeNorm));

  // [6-8] Position (normalized)
  v.push(state.position.x / 1000.0);
  v.push(state.position.y / 256.0);
  v.push(state.position.z / 1000.0);

  // [9-16] Top 4 hostile entities (distance, type)
  const hostiles = state.nearbyEntities.filter((e) => e.hostile).slice(0, 4);
  for (let i = 0; i < 4; i++) {
    if (i < hostiles.length) {
      v.push(1.0 - hostiles[i].distance / 32.0);
      v.push(ENTITY_TYPE_MAP[hostiles[i].name] ?? 0.0);
    } else {
      v.push(0.0);
      v.push(0.0);
    }
  }

  // [17-24] Top 4 friendly entities
  const friendly = state.nearbyEntities
    .filter((e) => !e.hostile && e.type !== "object")
    .slice(0, 4);
  for (let i = 0; i < 4; i++) {
    if (i < friendly.length) {
      v.push(1.0 - friendly[i].distance / 32.0);
      v.push(ENTITY_TYPE_MAP[friendly[i].name] ?? 0.0);
    } else {
      v.push(0.0);
      v.push(0.0);
    }
  }

  // [25-54] Inventory summary (30 floats: 15 categories x 2 [has, normalized_count])
  v.push(...encodeInventory(state.inventory));

  // [55-74] Nearby blocks summary (20 floats: 10 categories x 2)
  v.push(...encodeBlocks(state.nearbyBlocks));

  // [75-84] Biome (one-hot, 10 floats)
  const biomeLower = (state.biome ?? "unknown").toLowerCase();
  for (const b of BIOME_LIST) {
    v.push(biomeLower.includes(b) ? 1.0 : 0.0);
  }

  return v;
}

function encodeInventory(items: InventoryItem[]): number[] {
  const counts: Record<string, number> = {};
  let total = 0;
  for (const item of items) {
    const cat = ITEM_CATEGORIES[item.name] ?? "other";
    counts[cat] = (counts[cat] ?? 0) + item.count;
    total += item.count;
  }

  const result: number[] = [];
  for (const cat of INVENTORY_CATEGORIES) {
    if (cat === "total") {
      result.push(Math.min(total / 256.0, 1.0));
      result.push(total > 0 ? 1.0 : 0.0);
    } else {
      const c = counts[cat] ?? 0;
      result.push(Math.min(c / 64.0, 1.0));
      result.push(c > 0 ? 1.0 : 0.0);
    }
  }
  return result; // 15 * 2 = 30
}

function encodeBlocks(blocks: string[]): number[] {
  const counts: Record<string, number> = {};
  let total = 0;
  for (const block of blocks) {
    const cat = BLOCK_CATEGORIES[block] ?? "other";
    counts[cat] = (counts[cat] ?? 0) + 1;
    total++;
  }

  const result: number[] = [];
  for (const cat of BLOCK_CATEGORY_LIST) {
    if (cat === "total") {
      result.push(Math.min(total / 50.0, 1.0));
      result.push(total > 0 ? 1.0 : 0.0);
    } else {
      const c = counts[cat] ?? 0;
      result.push(Math.min(c / 10.0, 1.0));
      result.push(c > 0 ? 1.0 : 0.0);
    }
  }
  return result; // 10 * 2 = 20
}
