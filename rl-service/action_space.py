import math

ACTION_MAP = {
    0: "gather",
    1: "craft",
    2: "eat",
    3: "combat",
    4: "shelter",
    5: "explore",
}

GATHER_TARGETS = [
    "oak_log", "birch_log", "spruce_log", "cobblestone",
    "iron_ore", "coal_ore", "sand", "dirt",
    "diamond_ore", "gold_ore", "gravel", "stone",
    "sugar_cane", "clay", "deepslate", "copper_ore",
]

CRAFT_TARGETS = [
    "oak_planks", "stick", "crafting_table", "wooden_pickaxe",
    "stone_pickaxe", "iron_pickaxe", "wooden_sword", "stone_sword",
    "iron_sword", "wooden_axe", "furnace", "chest",
    "torch", "bread", "iron_ingot", "bucket",
]

FOOD_TARGETS = [
    "cooked_beef", "cooked_porkchop", "bread", "cooked_chicken",
    "apple", "baked_potato", "carrot", "melon_slice",
]

DIRECTIONS = ["north", "south", "east", "west", "random"]


def _sigmoid(x: float) -> float:
    return 1.0 / (1.0 + math.exp(-max(-10, min(10, x))))


def decode_action(action_idx: int, raw_params: list[float]) -> dict:
    """Convert RL model output to skill name + params dict."""
    action_name = ACTION_MAP.get(action_idx, "explore")
    params: dict = {}

    if action_name == "gather":
        idx = int(_sigmoid(raw_params[0]) * len(GATHER_TARGETS))
        idx = min(idx, len(GATHER_TARGETS) - 1)
        params["target"] = GATHER_TARGETS[idx]
        params["count"] = max(1, int(_sigmoid(raw_params[1]) * 10))

    elif action_name == "craft":
        idx = int(_sigmoid(raw_params[0]) * len(CRAFT_TARGETS))
        idx = min(idx, len(CRAFT_TARGETS) - 1)
        params["target"] = CRAFT_TARGETS[idx]
        params["count"] = max(1, int(_sigmoid(raw_params[1]) * 5))

    elif action_name == "eat":
        idx = int(_sigmoid(raw_params[0]) * len(FOOD_TARGETS))
        idx = min(idx, len(FOOD_TARGETS) - 1)
        params["target"] = FOOD_TARGETS[idx]

    elif action_name == "combat":
        params["mode"] = "fight" if raw_params[0] > 0 else "flee"

    elif action_name == "explore":
        idx = int(_sigmoid(raw_params[0]) * len(DIRECTIONS))
        idx = min(idx, len(DIRECTIONS) - 1)
        params["direction"] = DIRECTIONS[idx]
        params["count"] = max(10, int(_sigmoid(raw_params[1]) * 50))

    # shelter has no meaningful params

    return {"action": action_name, "params": params}
