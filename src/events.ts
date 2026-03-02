import { EventEmitter } from "events";

export interface GameEvent {
  type: "death" | "combat_win" | "low_health" | "low_food" | "action_complete" | "spawn";
  data: Record<string, unknown>;
  timestamp: number;
}

class EventBus extends EventEmitter {
  emit(event: "game-event", payload: GameEvent): boolean;
  emit(event: string, ...args: unknown[]): boolean {
    return super.emit(event, ...args);
  }

  publish(type: GameEvent["type"], data: Record<string, unknown> = {}): void {
    const event: GameEvent = { type, data, timestamp: Date.now() };
    this.emit("game-event", event);
  }
}

export const eventBus = new EventBus();
