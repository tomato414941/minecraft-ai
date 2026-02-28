import type { Bot } from "mineflayer";
import type { ActionParams, SkillResult } from "./index.js";
import { Vec3 } from "vec3";

export async function shelter(bot: Bot, params: ActionParams): Promise<SkillResult> {
  const mcData = (await import("minecraft-data")).default(bot.version);
  const pos = bot.entity.position.floored();

  // Find dirt or cobblestone in inventory for building
  const buildMaterials = ["cobblestone", "dirt", "stone", "oak_planks", "spruce_planks", "birch_planks"];
  let material = null;
  for (const matName of buildMaterials) {
    material = bot.inventory.items().find((i) => i.name === matName);
    if (material) break;
  }

  if (!material || material.count < 12) {
    return { success: false, message: "Not enough building materials (need 12+ blocks)" };
  }

  await bot.equip(material, "hand");

  // Build a 3x3x3 shelter around current position
  const baseY = pos.y;
  const offsets: Vec3[] = [];

  // Walls (3x3, height 3)
  for (let dy = 0; dy < 3; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        // Skip interior (only walls)
        if (dx === 0 && dz === 0) continue;
        // Skip corners to save material (optional)
        offsets.push(new Vec3(pos.x + dx, baseY + dy, pos.z + dz));
      }
    }
  }

  // Roof
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      offsets.push(new Vec3(pos.x + dx, baseY + 3, pos.z + dz));
    }
  }

  let placed = 0;
  for (const offset of offsets) {
    const block = bot.blockAt(offset);
    if (block && block.name === "air") {
      // Find a face to place against
      const neighbors = [
        new Vec3(0, -1, 0),
        new Vec3(0, 1, 0),
        new Vec3(1, 0, 0),
        new Vec3(-1, 0, 0),
        new Vec3(0, 0, 1),
        new Vec3(0, 0, -1),
      ];

      for (const n of neighbors) {
        const refBlock = bot.blockAt(offset.minus(n));
        if (refBlock && refBlock.name !== "air") {
          try {
            await bot.placeBlock(refBlock, n);
            placed++;
            break;
          } catch {
            // try next face
          }
        }
      }
    }
  }

  if (placed > 0) {
    return { success: true, message: `Built shelter (placed ${placed} blocks)` };
  }
  return { success: false, message: "Could not place any blocks for shelter" };
}
