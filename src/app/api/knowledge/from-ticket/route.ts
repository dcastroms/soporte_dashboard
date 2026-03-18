// src/app/api/knowledge/from-ticket/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateArticleDraft } from "@/lib/ticketToKnowledge";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let conversationId: string;
  try {
    const body = await req.json();
    conversationId = body.conversationId;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!conversationId) {
    return NextResponse.json({ error: "conversationId requerido" }, { status: 400 });
  }

  try {
    const draft = await generateArticleDraft(conversationId);
    return NextResponse.json({ draft, conversationId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error generando artículo";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
