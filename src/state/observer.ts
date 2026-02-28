import type { Bot } from "mineflayer";
import type { Entity } from "prismarine-entity";

export interface GameState {
  health: number;
  food: number;
  position: { x: number; y: number; z: number };
  time: { timeOfDay: number; isDay: boolean };
  inventory: InventoryItem[];
  nearbyEntities: NearbyEntity[];
  nearbyBlocks: string[];
  isRaining: boolean;
  biome: string;
}

export interface InventoryItem {
  name: string;
  count: number;
}

export interface NearbyEntity {
  name: string;
  type: string;
  distance: number;
  hostile: boolean;
}

const HOSTILE_MOBS = new Set([
  "zombie",
  "skeleton",
  "creeper",
  "spider",
  "enderman",
  "witch",
  "phantom",
  "drowned",
  "husk",
  "stray",
  "blaze",
  "ghast",
  "slime",
  "magma_cube",
  "pillager",
  "vindicator",
  "ravager",
  "warden",
]);

export function observeState(bot: Bot): GameState {
  const pos = bot.entity.position;
  const timeOfDay = bot.time.timeOfDay;

  const inventory: InventoryItem[] = [];
  for (const item of bot.inventory.items()) {
    inventory.push({ name: item.name, count: item.count });
  }

  const nearbyEntities: NearbyEntity[] = [];
  for (const entity of Object.values(bot.entities)) {
    if (entity === bot.entity) continue;
    const dist = entity.position.distanceTo(pos);
    if (dist > 32) continue;

    const name = entity.name ?? entity.username ?? "unknown";
    nearbyEntities.push({
      name,
      type: entity.type,
      distance: Math.round(dist * 10) / 10,
      hostile: HOSTILE_MOBS.has(name),
    });
  }
  nearbyEntities.sort((a, b) => a.distance - b.distance);

  const nearbyBlocks: string[] = [];
  const seen = new Set<string>();
  const radius = 8;
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dz = -radius; dz <= radius; dz++) {
        const block = bot.blockAt(pos.offset(dx, dy, dz));
        if (block && block.name !== "air" && !seen.has(block.name)) {
          seen.add(block.name);
          nearbyBlocks.push(block.name);
        }
      }
    }
  }

  let biome = "unknown";
  try {
    const block = bot.blockAt(pos);
    if (block) biome = (block as any).biome?.name ?? "unknown";
  } catch {
    // ignore
  }

  return {
    health: bot.health,
    food: bot.food,
    position: {
      x: Math.round(pos.x),
      y: Math.round(pos.y),
      z: Math.round(pos.z),
    },
    time: {
      timeOfDay,
      isDay: timeOfDay < 13000,
    },
    inventory,
    nearbyEntities: nearbyEntities.slice(0, 10),
    nearbyBlocks,
    isRaining: bot.isRaining,
    biome,
  };
}

export function stateToString(state: GameState): string {
  const lines: string[] = [];
  lines.push(`=== Game State ===`);
  lines.push(`Health: ${state.health}/20 | Food: ${state.food}/20`);
  lines.push(`Position: (${state.position.x}, ${state.position.y}, ${state.position.z})`);
  lines.push(`Time: ${state.time.timeOfDay} (${state.time.isDay ? "day" : "night"})`);
  lines.push(`Weather: ${state.isRaining ? "rain" : "clear"} | Biome: ${state.biome}`);

  if (state.inventory.length > 0) {
    lines.push(`Inventory: ${state.inventory.map((i) => `${i.name}x${i.count}`).join(", ")}`);
  } else {
    lines.push(`Inventory: empty`);
  }

  const hostiles = state.nearbyEntities.filter((e) => e.hostile);
  if (hostiles.length > 0) {
    lines.push(`HOSTILE: ${hostiles.map((e) => `${e.name}(${e.distance}m)`).join(", ")}`);
  }

  const friendly = state.nearbyEntities.filter((e) => !e.hostile && e.type !== "object");
  if (friendly.length > 0) {
    lines.push(`Nearby: ${friendly.map((e) => `${e.name}(${e.distance}m)`).join(", ")}`);
  }

  return lines.join("\n");
}
