import { NextRequest } from "next/server";
import { sseSubscribers } from "@/lib/sseRegistry";

/**
 * Server-Sent Events endpoint.
 * Dashboard tabs connect here and receive real-time events pushed
 * from the Intercom webhook handler via the shared sseSubscribers Set.
 *
 * Usage: GET /api/webhooks/intercom/stream
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  let ctrl: ReadableStreamDefaultController;

  const stream = new ReadableStream({
    start(c) {
      ctrl = c;
      sseSubscribers.add(ctrl);
      const ping = `event: connected\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`;
      ctrl.enqueue(new TextEncoder().encode(ping));
    },
    cancel() {
      sseSubscribers.delete(ctrl);
    },
  });

  // Heartbeat every 25s to keep the connection alive through proxies
  const heartbeat = setInterval(() => {
    try {
      ctrl.enqueue(new TextEncoder().encode(": heartbeat\n\n"));
    } catch {
      clearInterval(heartbeat);
    }
  }, 25_000);

  req.signal.addEventListener("abort", () => {
    clearInterval(heartbeat);
    sseSubscribers.delete(ctrl);
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
