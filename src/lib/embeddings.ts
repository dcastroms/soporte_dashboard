/**
 * Embeddings — supports Ollama (local) and Voyage AI (API)
 *
 * EMBEDDING_PROVIDER=ollama  → uses local Ollama (nomic-embed-text)
 * EMBEDDING_PROVIDER=voyage  → uses Voyage AI (voyage-3-lite)
 *
 * Default: voyage if VOYAGE_API_KEY is set, otherwise ollama
 */

const EMBEDDING_PROVIDER = process.env.EMBEDDING_PROVIDER ||
  (process.env.VOYAGE_API_KEY ? "voyage" : "ollama");

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text";

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY || "";
const VOYAGE_MODEL = process.env.VOYAGE_MODEL || "voyage-3-lite";

/** Generate an embedding vector for a single text string */
export async function embed(text: string): Promise<number[]> {
  if (EMBEDDING_PROVIDER === "voyage") return embedVoyage(text);
  return embedOllama(text);
}

async function embedOllama(text: string): Promise<number[]> {
  const resp = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, prompt: text }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Ollama embedding error ${resp.status}: ${err}`);
  }

  const data = await resp.json();
  return data.embedding as number[];
}

async function embedVoyage(text: string): Promise<number[]> {
  const resp = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${VOYAGE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: VOYAGE_MODEL,
      input: text,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Voyage embedding error ${resp.status}: ${err}`);
  }

  const data = await resp.json();
  return data.data?.[0]?.embedding as number[];
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

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .filter((c) => c.score > 0.2)
    .map((c) => c.text);
}
