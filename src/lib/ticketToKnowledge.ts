// src/lib/ticketToKnowledge.ts
import { prisma } from "@/lib/prisma";
import { chat } from "@/lib/aiProvider";
import { chunkText } from "@/lib/chunker";
import { embed } from "@/lib/embeddings";
import { getConversationDetail } from "@/lib/intercom";
import { PLATFORM_MODULES } from "@/lib/platformModules";

export interface ArticleDraft {
  titulo: string;
  problema: string;
  solucion: string[];
  categoria: string;
  tags: string[];
}

const CATEGORIES_LIST = PLATFORM_MODULES.join(", ");

function buildPrompt(messages: { author: string; body: string; isNote: boolean }[]): string {
  const publicMessages = messages
    .filter((m) => !m.isNote && m.body?.trim())
    .slice(-15);

  let conversation = publicMessages
    .map((m) => `${m.author}: ${m.body.replace(/<[^>]*>/g, "").trim()}`)
    .join("\n\n");

  if (conversation.length > 6000) {
    conversation = conversation.slice(-6000);
  }

  return conversation;
}

/**
 * Genera un borrador de artículo KB a partir de un conversationId de Intercom.
 * No guarda nada en la base de datos.
 */
export async function generateArticleDraft(conversationId: string): Promise<ArticleDraft> {
  const detail = await getConversationDetail(conversationId);
  if (!detail || !detail.messages.length) {
    throw new Error("No se encontró la conversación o no tiene mensajes");
  }

  const conversation = buildPrompt(detail.messages);
  if (!conversation.trim()) {
    throw new Error("La conversación no tiene mensajes públicos para analizar");
  }

  const messages = [
    {
      role: "system" as const,
      content: `Eres un redactor de base de conocimientos para el equipo de soporte de Mediastream.
Tu tarea es convertir tickets de soporte resueltos en artículos útiles y reutilizables.
Responde SIEMPRE en español. Sé conciso y directo.
IMPORTANTE: Responde SOLO con JSON válido, sin texto adicional ni markdown.
Categorías disponibles: ${CATEGORIES_LIST}`,
    },
    {
      role: "user" as const,
      content: `Convierte este ticket resuelto en un artículo de conocimiento con el siguiente formato JSON exacto:
{
  "titulo": "Título claro del problema y solución (máx 80 chars)",
  "problema": "Descripción de 1-2 oraciones del problema reportado",
  "solucion": ["Paso 1...", "Paso 2...", "Paso 3..."],
  "categoria": "<una categoría de la lista>",
  "tags": ["tag1", "tag2", "tag3"]
}

Conversación:
${conversation}`,
    },
  ];

  const response = await chat(messages, { maxTokens: 2048 });
  const raw = response.text.trim();

  function sanitizeJson(text: string): string {
    // Strip markdown code fences
    let s = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    // Extract first JSON object
    const match = s.match(/\{[\s\S]*\}/);
    if (!match) return s;
    s = match[0];
    // Fix invalid escape sequences (\X where X is not a valid JSON escape char)
    s = s.replace(/\\([^"\\/bfnrtu])/g, "\\\\$1");
    return s;
  }

  let draft: ArticleDraft;
  try {
    draft = JSON.parse(sanitizeJson(raw));
  } catch {
    // Retry with shorter conversation (truncate to 3000 chars)
    const shortConversation = conversation.slice(-3000);
    messages[1].content = messages[1].content.replace(conversation, shortConversation);
    const retry = await chat(messages, { maxTokens: 2048 });
    const retryRaw = retry.text.trim();
    try {
      draft = JSON.parse(sanitizeJson(retryRaw));
    } catch {
      throw new Error("La IA no retornó JSON válido tras dos intentos");
    }
  }

  if (!draft.titulo || !draft.problema || !Array.isArray(draft.solucion)) {
    throw new Error("El artículo generado está incompleto");
  }

  if (!(PLATFORM_MODULES as readonly string[]).includes(draft.categoria)) {
    draft.categoria = "General";
  }

  return draft;
}

/**
 * Formatea un ArticleDraft como texto plano optimizado para RAG.
 */
export function formatArticleContent(draft: ArticleDraft): string {
  return `# ${draft.titulo}

## Problema
${draft.problema}

## Solución
${draft.solucion.map((s, i) => `${i + 1}. ${s}`).join("\n")}

## Categoría
${draft.categoria}

## Tags
${draft.tags.join(", ")}`;
}

/**
 * Guarda un artículo en la base de conocimiento con chunking y embeddings.
 * Retorna { skipped: true } si ya existe (deduplicación por sourceId).
 */
export async function saveArticleToDB(
  draft: ArticleDraft,
  options: {
    conversationId: string;
    uploadedBy: string;
  }
) {
  const existing = await prisma.knowledgeDoc.findFirst({
    where: { sourceId: options.conversationId },
    select: { id: true },
  });
  if (existing) return { skipped: true, docId: existing.id };

  const content = formatArticleContent(draft);
  const chunks = chunkText(content);

  let chunksWithEmbeddings: { text: string; embedding: number[]; chunkIndex: number }[];
  try {
    chunksWithEmbeddings = await Promise.all(
      chunks.map(async (text, i) => ({
        text,
        embedding: await embed(text),
        chunkIndex: i,
      }))
    );
  } catch (err) {
    console.warn("[ticketToKnowledge] Embeddings failed, saving without vectors:", err);
    chunksWithEmbeddings = chunks.map((text, i) => ({
      text,
      embedding: [],
      chunkIndex: i,
    }));
  }

  const doc = await prisma.knowledgeDoc.create({
    data: {
      title: draft.titulo,
      content,
      docType: "text",
      uploadedBy: options.uploadedBy,
      sourceType: "ticket",
      sourceId: options.conversationId,
      category: draft.categoria,
      chunks: { create: chunksWithEmbeddings },
    },
    select: { id: true, title: true, createdAt: true },
  });

  return { skipped: false, docId: doc.id, doc };
}
