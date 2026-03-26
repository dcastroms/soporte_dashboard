import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { chat } from "@/lib/aiProvider";
import { checkRateLimit } from "@/lib/rateLimit";
import { findConversationFirst } from "@/lib/models/IntercomModel";
import { getConversationDetail } from "@/lib/intercom";
import { buildAuditSummaryMessages, buildChatSummaryMessages } from "@/lib/summaryPrompt";
import { stripHtml } from "@/lib/utils";

function parseAIJson(text: string) {
  // Strip markdown code fences if present (```json ... ``` or ``` ... ```)
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  return JSON.parse(cleaned);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { conversationId?: string; mode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { conversationId, mode } = body;
  if (!conversationId || (mode !== "audit" && mode !== "chat")) {
    return NextResponse.json({ error: "conversationId and mode are required" }, { status: 400 });
  }

  const { allowed } = checkRateLimit(`ai:summary:${session.user.email}`, {
    maxRequests: 10,
    windowMs: 60_000,
  });
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const record = await findConversationFirst({ intercomId: conversationId });
  if (!record) {
    console.error(`[AI summary] conversation not found: ${conversationId}`);
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  if (mode === "audit") {
    const staleHours = Math.floor((Date.now() - new Date(record.updatedAt).getTime()) / 3_600_000);

    // Si faltan campos clave, enriquecer con los primeros mensajes reales de la conversación
    let firstMessages: { role: string; body: string }[] | undefined;
    if (!record.client || !record.module || !record.ticketType) {
      const detail = await getConversationDetail(conversationId);
      if (detail?.messages.length) {
        firstMessages = detail.messages.slice(0, 4).map((m) => ({
          role: m.isNote ? `Nota interna (${m.author})` : m.authorType === "admin" ? `Agente (${m.author})` : `Cliente (${m.author})`,
          body: stripHtml(m.body).trim(),
        })).filter((m) => m.body.length > 0);
      }
    }

    const messages = buildAuditSummaryMessages({
      subject: record.subject,
      status: record.status,
      priority: record.priority,
      client: record.client,
      module: record.module,
      ticketType: record.ticketType,
      teammateName: record.teammateName,
      staleHours,
      firstMessages,
    });
    try {
      const result = await chat(messages, { maxTokens: 400 });
      console.log("[AI summary audit] raw response:", result.text.slice(0, 300));
      const parsed = parseAIJson(result.text);
      return NextResponse.json(parsed);
    } catch (err) {
      console.error("[AI summary audit]", err);
      return NextResponse.json({ error: "Respuesta inválida del modelo" }, { status: 502 });
    }
  }

  // chat mode
  const detail = await getConversationDetail(conversationId);
  if (!detail) {
    return NextResponse.json(
      { error: "No se pudo obtener el historial de la conversación" },
      { status: 502 }
    );
  }

  if (detail.messages.length < 2) {
    return NextResponse.json({ tooShort: true });
  }

  const recentMessages = detail.messages.slice(-15);
  const messages = buildChatSummaryMessages(
    {
      subject: record.subject,
      status: record.status,
      priority: record.priority,
      client: record.client,
      module: record.module,
      ticketType: record.ticketType,
      teammateName: record.teammateName,
    },
    recentMessages
  );

  try {
    console.log("[AI summary chat] sending", recentMessages.length, "messages");
    const result = await chat(messages, { maxTokens: 600 });
    console.log("[AI summary chat] raw response:", result.text.slice(0, 300));
    const parsed = parseAIJson(result.text);
    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[AI summary chat]", err);
    return NextResponse.json({ error: "Respuesta inválida del modelo" }, { status: 502 });
  }
}
