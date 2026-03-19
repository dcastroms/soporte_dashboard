import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { chat } from "@/lib/aiProvider";
import { buildSuggestMessages } from "@/lib/supportPrompt";
import { embedQuery, findTopChunksScored } from "@/lib/embeddings";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { query } = await req.json();
  if (!query) return NextResponse.json({ error: "query requerido" }, { status: 400 });

  // RAG
  const allChunks = await prisma.knowledgeChunk.findMany({
    select: { text: true, embedding: true },
  });

  const queryEmbedding = await embedQuery(query);
  const topScored = findTopChunksScored(queryEmbedding, allChunks, 8);
  const topChunks = topScored.map((c) => c.text);
  const knowledgeContext = topChunks.length > 0 ? topChunks.join("\n\n---\n\n") : undefined;

  // AI
  const messages = buildSuggestMessages(
    [{ role: "user", content: query }],
    knowledgeContext
  );
  const result = await chat(messages);

  return NextResponse.json({
    query,
    provider: result.provider,
    model: result.model,
    chunksTotal: allChunks.length,
    chunksFound: topScored.length,
    chunks: topScored,
    knowledgeContext: knowledgeContext ?? null,
    suggestion: result.text,
  });
}
