// A typed event bus: on() returns an unsubscribe, emit() awaits handlers in order.
// Split from <original-cascade-slot>/client/src/core/pipeline/EventBus.ts; the event map is
// now the caller's type parameter (the source fixed its own events and was a singleton).

export type EventHandler<P> = (payload: P) => void | Promise<void>;

export class EventBus<M extends Record<string, unknown>> {
  private listeners = new Map<keyof M, Set<EventHandler<never>>>();

  on<K extends keyof M>(event: K, handler: EventHandler<M[K]>): () => void {
    let set = this.listeners.get(event);
    if (!set) this.listeners.set(event, (set = new Set()));
    set.add(handler as EventHandler<never>);
    return () => this.off(event, handler);
  }

  off<K extends keyof M>(event: K, handler: EventHandler<M[K]>): void {
    this.listeners.get(event)?.delete(handler as EventHandler<never>);
  }

  /** Calls the handlers one after another (a handler added during emit waits for the next one). */
  async emit<K extends keyof M>(event: K, payload: M[K]): Promise<void> {
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    for (const h of [...handlers]) await (h as EventHandler<M[K]>)(payload);
  }

  clear(): void {
    this.listeners.clear();
  }
}
