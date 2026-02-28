export const ACTION_NAMES = [
  "gather",
  "craft",
  "eat",
  "combat",
  "shelter",
  "explore",
] as const;

export type ActionName = (typeof ACTION_NAMES)[number];

export const ACTION_TO_INDEX: Record<string, number> = {};
export const INDEX_TO_ACTION: Record<number, string> = {};

for (let i = 0; i < ACTION_NAMES.length; i++) {
  ACTION_TO_INDEX[ACTION_NAMES[i]] = i;
  INDEX_TO_ACTION[i] = ACTION_NAMES[i];
}

export const N_ACTIONS = ACTION_NAMES.length;
