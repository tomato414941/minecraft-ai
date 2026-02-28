import type { GameState, InventoryItem } from "../state/observer";
import type { SkillResult } from "../skills";

const TOOL_TIERS: Record<string, number> = {
  wooden_pickaxe: 1, stone_pickaxe: 2, iron_pickaxe: 3, diamond_pickaxe: 4,
  wooden_sword: 1, stone_sword: 2, iron_sword: 3, diamond_sword: 4,
  wooden_axe: 1, stone_axe: 2, iron_axe: 3, diamond_axe: 4,
};

export function computeReward(
  prevState: GameState | null,
  nextState: GameState,
  result: SkillResult,
): number {
  let reward = 0.1; // survival tick

  if (prevState) {
    // Health delta
    reward += (nextState.health - prevState.health) * 0.5;

    // Food delta
    reward += (nextState.food - prevState.food) * 0.3;

    // Inventory gain
    const prevCount = prevState.inventory.reduce((s, i) => s + i.count, 0);
    const nextCount = nextState.inventory.reduce((s, i) => s + i.count, 0);
    reward += Math.min((nextCount - prevCount) * 0.05, 1.0);

    // Tool tier advancement
    reward += toolTierBonus(prevState.inventory, nextState.inventory);

    // Combat success
    const prevHostiles = prevState.nearbyEntities.filter((e) => e.hostile).length;
    const nextHostiles = nextState.nearbyEntities.filter((e) => e.hostile).length;
    if (prevHostiles > nextHostiles && nextState.health > 0) {
      reward += 2.0;
    }

    // Exploration
    const dist = Math.sqrt(
      (nextState.position.x - prevState.position.x) ** 2 +
      (nextState.position.z - prevState.position.z) ** 2,
    );
    reward += Math.min(dist * 0.01, 0.3);
  }

  // Death penalty
  if (nextState.health <= 0) {
    reward -= 10.0;
  }

  // Skill outcome
  reward += result.success ? 0.5 : -0.2;

  return reward;
}

function toolTierBonus(prev: InventoryItem[], next: InventoryItem[]): number {
  const prevMax = Math.max(0, ...prev.map((i) => TOOL_TIERS[i.name] ?? 0));
  const nextMax = Math.max(0, ...next.map((i) => TOOL_TIERS[i.name] ?? 0));
  return Math.max(0, nextMax - prevMax) * 3.0;
}
