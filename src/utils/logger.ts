const colors = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
} as const;

type Level = "info" | "warn" | "error" | "action" | "ai";

const levelConfig: Record<Level, { color: string; label: string }> = {
  info: { color: colors.cyan, label: "INFO" },
  warn: { color: colors.yellow, label: "WARN" },
  error: { color: colors.red, label: "ERROR" },
  action: { color: colors.green, label: "ACTION" },
  ai: { color: colors.magenta, label: "AI" },
};

function log(level: Level, message: string, data?: unknown) {
  const { color, label } = levelConfig[level];
  const time = new Date().toISOString().slice(11, 19);
  const prefix = `${colors.dim}${time}${colors.reset} ${color}[${label}]${colors.reset}`;
  console.log(`${prefix} ${message}`);
  if (data !== undefined) {
    console.log(JSON.stringify(data, null, 2));
  }
}

export const logger = {
  info: (msg: string, data?: unknown) => log("info", msg, data),
  warn: (msg: string, data?: unknown) => log("warn", msg, data),
  error: (msg: string, data?: unknown) => log("error", msg, data),
  action: (msg: string, data?: unknown) => log("action", msg, data),
  ai: (msg: string, data?: unknown) => log("ai", msg, data),
};
