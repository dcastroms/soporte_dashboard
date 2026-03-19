/**
 * A.7 — Text chunking utility
 * Splits a document into overlapping chunks for RAG embeddings.
 */

const CHUNK_SIZE = 500;   // characters per chunk
const CHUNK_OVERLAP = 100; // overlap between consecutive chunks

export function chunkText(text: string): string[] {
  // Normalize whitespace
  const normalized = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

  if (normalized.length <= CHUNK_SIZE) return [normalized];

  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    const end = Math.min(start + CHUNK_SIZE, normalized.length);
    let chunk = normalized.slice(start, end);

    // Try to break at a paragraph or sentence boundary
    if (end < normalized.length) {
      const lastParagraph = chunk.lastIndexOf("\n\n");
      const lastNewline = chunk.lastIndexOf("\n");
      const lastPeriod = chunk.lastIndexOf(". ");

      const breakAt = lastParagraph > CHUNK_SIZE * 0.5
        ? lastParagraph + 2
        : lastNewline > CHUNK_SIZE * 0.5
        ? lastNewline + 1
        : lastPeriod > CHUNK_SIZE * 0.5
        ? lastPeriod + 2
        : chunk.length;

      chunk = normalized.slice(start, start + breakAt).trim();
    }

    if (chunk) chunks.push(chunk);
    start += Math.max(chunk.length - CHUNK_OVERLAP, 1);
  }

  return chunks.filter((c) => c.trim().length > 20);
}
