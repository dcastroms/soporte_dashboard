// src/app/api/knowledge/batch-from-tickets/route.ts
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { searchClosedConversations } from "@/lib/intercom";
import { generateArticleDraft, saveArticleToDB } from "@/lib/ticketToKnowledge";

export const dynamic = "force-dynamic";

function sseEvent(data: object): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  let from: Date, to: Date;
  try {
    const body = await req.json();
    from = new Date(body.from);
    to = new Date(body.to);
    if (isNaN(from.getTime()) || isNaN(to.getTime())) throw new Error("Fechas inválidas");
  } catch {
    return new Response(JSON.stringify({ error: "from y to requeridos (ISO date)" }), { status: 400 });
  }

  const uploadedBy = session.user.email;

  const stream = new ReadableStream({
    async start(controller) {
      const encode = (data: object) => controller.enqueue(new TextEncoder().encode(sseEvent(data)));

      try {
        const allIds: string[] = [];
        let page = 1;
        let totalPages = 1;

        encode({ type: "status", message: "Buscando tickets en Intercom..." });

        do {
          const result = await searchClosedConversations(from, to, page);
          allIds.push(...result.ids);
          totalPages = result.totalPages;
          page++;
          if (page <= totalPages) await sleep(1000);
        } while (page <= totalPages);

        const total = allIds.length;
        encode({ type: "status", message: `${total} tickets encontrados. Procesando...` });

        let processed = 0;
        let skipped = 0;
        let errors = 0;

        for (const conversationId of allIds) {
          try {
            const draft = await generateArticleDraft(conversationId);
            const result = await saveArticleToDB(draft, { conversationId, uploadedBy });
            if (result.skipped) {
              skipped++;
            } else {
              processed++;
            }
          } catch {
            errors++;
          }

          encode({ type: "progress", processed, skipped, errors, total });
          await sleep(500);
        }

        encode({ type: "done", processed, skipped, errors, total });
      } catch (err) {
        encode({ type: "error", message: err instanceof Error ? err.message : "Error inesperado" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
