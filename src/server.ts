import { createServer, IncomingMessage, ServerResponse } from "http";
import { eventBus, GameEvent } from "./events";
import type { GameState } from "./state/observer";
import { logger } from "./utils/logger";

export interface ExternalCommand {
  action: string;
  params: Record<string, unknown>;
  priority?: "normal" | "urgent";
}

const commandQueue: ExternalCommand[] = [];

export function dequeueCommand(): ExternalCommand | undefined {
  return commandQueue.shift();
}

export function hasCommand(): boolean {
  return commandQueue.length > 0;
}

let latestState: GameState | null = null;

export function updateState(state: GameState): void {
  latestState = state;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk: Buffer) => (body += chunk.toString()));
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function json(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(data));
}

// SSE connections for event streaming
const sseClients = new Set<ServerResponse>();

function broadcastEvent(event: GameEvent): void {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of sseClients) {
    client.write(data);
  }
}

eventBus.on("game-event", broadcastEvent);

export function startApiServer(port = 3001): void {
  const server = createServer(async (req, res) => {
    // CORS preflight
    if (req.method === "OPTIONS") {
      json(res, 204, null);
      return;
    }

    const url = req.url ?? "";

    // GET /api/state
    if (req.method === "GET" && url === "/api/state") {
      json(res, 200, latestState ?? { error: "no state yet" });
      return;
    }

    // POST /api/command
    if (req.method === "POST" && url === "/api/command") {
      try {
        const body = JSON.parse(await readBody(req));
        const cmd: ExternalCommand = {
          action: body.action,
          params: body.params ?? {},
          priority: body.priority ?? "normal",
        };
        if (!cmd.action) {
          json(res, 400, { error: "action is required" });
          return;
        }
        if (cmd.priority === "urgent") {
          commandQueue.unshift(cmd);
        } else {
          commandQueue.push(cmd);
        }
        logger.info(`[API] Command queued: ${cmd.action} (${cmd.priority})`);
        json(res, 200, { ok: true, queueLength: commandQueue.length });
      } catch {
        json(res, 400, { error: "invalid JSON" });
      }
      return;
    }

    // GET /api/events (SSE)
    if (req.method === "GET" && url === "/api/events") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
      });
      res.write("data: {\"type\":\"connected\"}\n\n");
      sseClients.add(res);
      req.on("close", () => sseClients.delete(res));
      return;
    }

    // GET /health
    if (req.method === "GET" && url === "/health") {
      json(res, 200, { status: "ok", commandQueueLength: commandQueue.length });
      return;
    }

    json(res, 404, { error: "not found" });
  });

  server.listen(port, "0.0.0.0", () => {
    logger.info(`[API] Server listening on http://0.0.0.0:${port}`);
  });
}
