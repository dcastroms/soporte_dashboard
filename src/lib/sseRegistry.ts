/**
 * sseRegistry.ts
 * Shared singleton for SSE subscriber controllers.
 * Import from here in BOTH the intercom and Google Calendar webhook handlers
 * to avoid circular dependencies.
 */

export const sseSubscribers = new Set<ReadableStreamDefaultController>();

export function broadcast(eventName: string, data: object) {
  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const ctrl of sseSubscribers) {
    try {
      ctrl.enqueue(new TextEncoder().encode(payload));
    } catch {
      sseSubscribers.delete(ctrl);
    }
  }
}
