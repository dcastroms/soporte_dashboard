// A.2 + A.9 — Suggest a reply using conversation history + RAG context
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { chat } from "@/lib/aiProvider";
import { buildSuggestMessages } from "@/lib/supportPrompt";
import { embedQuery, findTopChunks } from "@/lib/embeddings";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rateLimit";

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // A.13: Rate limit — 20 suggestions per minute per user
  const { allowed, retryAfterMs } = checkRateLimit(`ai:suggest:${session.user.email}`, {
    maxRequests: 20,
    windowMs: 60_000,
  });
  if (!allowed) {
    return NextResponse.json(
      { error: `Demasiadas solicitudes. Intenta en ${Math.ceil(retryAfterMs / 1000)}s` },
      { status: 429 }
    );
  }

  let body: { messages?: ConversationMessage[]; conversationId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { messages = [], conversationId = "" } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages array is required" }, { status: 400 });
  }

  // A.9: RAG — find relevant knowledge chunks for the last user message
  let knowledgeContext: string | undefined;
  try {
    // Skip auto-generated Intercom system messages (e.g. "Las respuestas te llegarán aquí...")
    const lastUserMsg = [...messages].reverse().find(
      (m) => m.role === "user" && m.content.length > 10 && !m.content.includes("te llegarán") && !m.content.includes("correo electrónico")
    );
    if (lastUserMsg) {
      const allChunks = await prisma.knowledgeChunk.findMany({
        select: { text: true, embedding: true },
      });

      if (allChunks.length > 0) {
        const queryEmbedding = await embedQuery(lastUserMsg.content);
        const topChunks = findTopChunks(queryEmbedding, allChunks);
        console.log(`[RAG] query="${lastUserMsg.content.slice(0, 60)}" chunks=${allChunks.length} found=${topChunks.length}`);
        if (topChunks.length > 0) {
          knowledgeContext = topChunks.join("\n\n---\n\n");
        }
      }
    }
  } catch (err) {
    // RAG failure is non-fatal — continue without context
    console.warn("[AI suggest] RAG lookup failed:", err instanceof Error ? err.message : err);
  }

  // Load custom system prompt if set
  const configRow = await prisma.aiConfig.findUnique({ where: { key: "systemPrompt" } }).catch(() => null);
  const customSystemPrompt = configRow?.value;

  try {
    const aiMessages = buildSuggestMessages(messages, knowledgeContext, customSystemPrompt);
    const result = await chat(aiMessages);

    // A.9: Log suggestion for feedback tracking
    const log = await prisma.aiSuggestionLog.create({
      data: {
        conversationId,
        suggestion: result.text,
        agentEmail: session.user.email,
        usedKnowledge: !!knowledgeContext,
      },
    });

    return NextResponse.json({
      suggestion: result.text,
      logId: log.id,
      model: result.model,
      provider: result.provider,
      usedKnowledge: !!knowledgeContext,
    });
  } catch (err) {
    console.error("[AI suggest]", err);
    const message = err instanceof Error ? err.message : "AI provider error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
