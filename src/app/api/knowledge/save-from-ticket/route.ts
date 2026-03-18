// src/app/api/knowledge/save-from-ticket/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { saveArticleToDB } from "@/lib/ticketToKnowledge";
import type { ArticleDraft } from "@/lib/ticketToKnowledge";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { draft: ArticleDraft; conversationId: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.draft || !body.conversationId) {
    return NextResponse.json({ error: "draft y conversationId requeridos" }, { status: 400 });
  }

  try {
    const result = await saveArticleToDB(body.draft, {
      conversationId: body.conversationId,
      uploadedBy: session.user.email,
    });

    if (result.skipped) {
      return NextResponse.json({ skipped: true, docId: result.docId }, { status: 200 });
    }

    return NextResponse.json({ saved: true, docId: result.docId }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error guardando artículo";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
