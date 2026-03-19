/**
 * A.8 — Embeddings + semantic search via Ollama
 *
 * Uses nomic-embed-text (or the configured OLLAMA_EMBED_MODEL) to generate
 * vector embeddings, then does cosine similarity search in JavaScript.
 * No Atlas Vector Search needed — works with any MongoDB plan.
 */

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text";

/** Generate an embedding vector for a single text string */
export async function embed(text: string): Promise<number[]> {
  const resp = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, prompt: text }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Embedding error ${resp.status}: ${err}`);
  }

  const data = await resp.json();
  return data.embedding as number[];
}

/** Cosine similarity between two vectors (range: -1 to 1) */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/** Find the top K most relevant chunks for a query */
export function findTopChunks(
  query: number[],
  chunks: { text: string; embedding: number[] }[],
  topK = 8
): string[] {
  const scored = chunks.map((chunk) => ({
    text: chunk.text,
    score: cosineSimilarity(query, chunk.embedding),
  }));

  const sorted = scored.sort((a, b) => b.score - a.score);

  return sorted
    .slice(0, topK)
    .filter((c) => c.score > 0.2)
    .map((c) => c.text);
}
