// scripts/reembed-knowledge.mjs
// Re-genera todos los embeddings de KnowledgeChunk usando Voyage AI
// Uso: node scripts/reembed-knowledge.mjs
// Requiere: VOYAGE_API_KEY y DATABASE_URL en .env

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env") });

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;
const VOYAGE_MODEL = process.env.VOYAGE_MODEL || "voyage-3-lite";
const JINA_API_KEY = process.env.JINA_API_KEY;
const JINA_MODEL = process.env.JINA_MODEL || "jina-embeddings-v3";
const EMBEDDING_PROVIDER = process.env.EMBEDDING_PROVIDER ||
  (JINA_API_KEY ? "jina" : VOYAGE_API_KEY ? "voyage" : null);

if (!EMBEDDING_PROVIDER) {
  console.error("[reembed] ERROR: Configura JINA_API_KEY o VOYAGE_API_KEY en .env");
  process.exit(1);
}
console.log(`[reembed] Usando provider: ${EMBEDDING_PROVIDER}`);

const prisma = new PrismaClient();

async function embedVoyage(text) {
  const resp = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${VOYAGE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: VOYAGE_MODEL, input: text }),
  });
  if (!resp.ok) throw new Error(`Voyage error ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  return data.data?.[0]?.embedding;
}

async function embedJina(text) {
  const resp = await fetch("https://api.jina.ai/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${JINA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: JINA_MODEL, input: [text], task: "retrieval.passage" }),
  });
  if (!resp.ok) throw new Error(`Jina error ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  return data.data?.[0]?.embedding;
}

async function embedText(text) {
  if (EMBEDDING_PROVIDER === "jina") return embedJina(text);
  return embedVoyage(text);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const chunks = await prisma.knowledgeChunk.findMany({
    select: { id: true, text: true },
  });

  console.log(`[reembed] Total chunks a procesar: ${chunks.length}`);

  let ok = 0;
  let errors = 0;

  for (const chunk of chunks) {
    try {
      const embedding = await embedText(chunk.text);
      await prisma.knowledgeChunk.update({
        where: { id: chunk.id },
        data: { embedding },
      });
      ok++;
      if (ok % 10 === 0) console.log(`[reembed] Progreso: ${ok}/${chunks.length}`);
      await sleep(100); // respetar rate limit de Voyage
    } catch (err) {
      errors++;
      console.error(`[reembed] Error en chunk ${chunk.id}:`, err.message);
    }
  }

  console.log(`[reembed] Completado — OK: ${ok}, errores: ${errors}`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
