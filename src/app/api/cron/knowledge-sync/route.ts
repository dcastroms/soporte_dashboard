// src/app/api/cron/knowledge-sync/route.ts
import { NextRequest, NextResponse } from "next/server";
import { searchClosedConversations } from "@/lib/intercom";
import { generateArticleDraft, saveArticleToDB } from "@/lib/ticketToKnowledge";

export const dynamic = "force-dynamic";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[knowledge-cron] CRON_SECRET no está configurado");
    return NextResponse.json({ error: "Cron not configured" }, { status: 503 });
  }

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 1);
  from.setHours(0, 0, 0, 0);
  to.setHours(0, 0, 0, 0);

  console.log(`[knowledge-cron] Procesando tickets ${from.toISOString()} → ${to.toISOString()}`);

  const allIds: string[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const result = await searchClosedConversations(from, to, page);
    allIds.push(...result.ids);
    totalPages = result.totalPages;
    page++;
    if (page <= totalPages) await sleep(1000);
  } while (page <= totalPages);

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const conversationId of allIds) {
    try {
      const draft = await generateArticleDraft(conversationId);
      const result = await saveArticleToDB(draft, {
        conversationId,
        uploadedBy: "cron:knowledge-sync",
      });
      if (result.skipped) skipped++;
      else processed++;
    } catch (err) {
      errors++;
      console.error(`[knowledge-cron] Error en ${conversationId}:`, err);
    }
    await sleep(500);
  }

  console.log(`[knowledge-cron] Completado — procesados: ${processed}, omitidos: ${skipped}, errores: ${errors}`);

  return NextResponse.json({ processed, skipped, errors, total: allIds.length });
}
