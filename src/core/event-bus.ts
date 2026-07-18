/**
 * KVJ Analytics — Typed internal Event Bus (Prompt 4 §14 Event Architecture)
 * Layer: Core. Enables modules to communicate via domain events instead of
 * tight coupling. In-process now; upgradeable to a durable broker/Supabase
 * Realtime later without changing publishers/subscribers.
 *
 * Example cascade (wired by later modules, NOT here):
 *   'training.assigned' -> attendance seeds sessions -> notifications -> analytics dirty
 */

/**
 * Global application event map. Modules AUGMENT this interface to add their
 * own typed events (declaration merging), keeping payloads fully typed:
 *
 *   declare module '@core/event-bus' {
 *     interface AppEventMap { 'attendance.clockedIn': { userId: string } }
 *   }
 */
export interface AppEventMap {
  // Application lifecycle
  'app.ready': void;
  'auth.login': { userId: string; role: string };
  'auth.logout': { userId: string };
  'theme.changed': { theme: 'light' | 'dark' };
}

export type EventName = keyof AppEventMap;
type Handler<K extends EventName> = (payload: AppEventMap[K]) => void;
export type Unsubscribe = () => void;

class EventBus {
  private handlers = new Map<EventName, Set<Handler<EventName>>>();

  /** Subscribe to an event. Returns an unsubscribe function. */
  on<K extends EventName>(event: K, handler: Handler<K>): Unsubscribe {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as Handler<EventName>);
    return () => this.off(event, handler);
  }

  /** Subscribe once; auto-unsubscribes after the first emission. */
  once<K extends EventName>(event: K, handler: Handler<K>): Unsubscribe {
    const off = this.on(event, (payload) => {
      off();
      handler(payload);
    });
    return off;
  }

  off<K extends EventName>(event: K, handler: Handler<K>): void {
    this.handlers.get(event)?.delete(handler as Handler<EventName>);
  }

  /** Publish an event to all subscribers (errors in one handler don't affect others). */
  emit<K extends EventName>(event: K, payload: AppEventMap[K]): void {
    this.handlers.get(event)?.forEach((h) => {
      try {
        (h as Handler<K>)(payload);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`[event-bus] handler for "${String(event)}" threw:`, err);
      }
    });
  }

  clear(): void {
    this.handlers.clear();
  }
}

/** Single application-wide bus instance. */
export const eventBus = new EventBus();
