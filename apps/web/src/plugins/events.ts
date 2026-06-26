import type { CustomWidgetField } from "@/db/schema/customWidgets";

// The typed catalog of lifecycle events flowing through the bus. Extend this interface
// (here or via declaration merging) as new hooks are added; the keys gate `on`/`trigger`
// and the value type is the payload each carries.
export interface AppEvents {
  // Fired when an editor saves a dynamic widget instance's content. Carries the bound
  // definition id, its field set, and the saved { fieldName: value } draft.
  "widget:save": {
    definitionId: string;
    fields: CustomWidgetField[];
    values: Record<string, string>;
  };
}

type Listener<K extends keyof AppEvents> = (data: AppEvents[K]) => void;

/**
 * Minimal, dependency-free typed event bus. `on` returns an unsubscribe function; a
 * throwing listener is isolated so it can't break a `trigger` or sibling listeners.
 */
export class EventBus {
  private listeners = new Map<keyof AppEvents, Set<Listener<keyof AppEvents>>>();

  on<K extends keyof AppEvents>(event: K, listener: Listener<K>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as Listener<keyof AppEvents>);
    return () => this.off(event, listener);
  }

  off<K extends keyof AppEvents>(event: K, listener: Listener<K>): void {
    this.listeners.get(event)?.delete(listener as Listener<keyof AppEvents>);
  }

  trigger<K extends keyof AppEvents>(event: K, data: AppEvents[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const listener of set) {
      try {
        (listener as Listener<K>)(data);
      } catch (error) {
        console.error(`[plugins] listener for "${String(event)}" threw`, error);
      }
    }
  }
}

// Module singleton shared by every plugin and trigger site.
export const bus = new EventBus();
