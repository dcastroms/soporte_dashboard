/**
 * import-postman.mjs
 * Imports a Postman collection into the RAG knowledge base.
 *
 * Strategy: ONE CHUNK PER ENDPOINT — each endpoint is fully self-contained
 * so retrieval always returns complete, usable information.
 *
 * Each chunk includes:
 *   - Spanish description header (for better Spanish query matching)
 *   - HTTP method + full URL
 *   - All parameters with descriptions
 *   - Example response if available
 *
 * Usage:
 *   node scripts/import-postman.mjs [path/to/collection.json]
 *
 * To re-import after changes, first delete existing docs from the UI
 * or run with --clean flag: node scripts/import-postman.mjs --clean
 */

import { readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text";
const CLEAN = process.argv.includes("--clean");
const COLLECTION_PATH =
  process.argv.find((a) => a.endsWith(".json")) || "./MEDIASTREAM.postman_collection.json";

const prisma = new PrismaClient();

// ── Embedding ────────────────────────────────────────────────────────────────

async function embed(text) {
  const resp = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, prompt: text }),
  });
  if (!resp.ok) throw new Error(`Embedding error ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  return data.embedding;
}

// ── URL builder ──────────────────────────────────────────────────────────────

function buildUrl(urlObj) {
  if (!urlObj) return "";
  if (typeof urlObj === "string") return urlObj.split("?")[0];
  const host = (urlObj.host || []).join(".");
  const path = (urlObj.path || []).join("/");
  return `https://${host}/${path}`;
}

// ── Endpoint → self-contained text chunk ─────────────────────────────────────
// Written to be found by Spanish queries: method name, action verbs, etc.

function endpointToChunk(item, folderName) {
  const req = item.request;
  if (!req) return null;

  const method = req.method || "GET";
  const urlObj = req.url;
  const cleanUrl = buildUrl(urlObj);
  const endpointName = item.name || cleanUrl;

  // Spanish action verb per HTTP method
  const actionVerb = {
    GET: "Obtener / Consultar",
    POST: "Crear / Emitir / Enviar",
    PUT: "Actualizar / Modificar",
    PATCH: "Actualizar parcialmente",
    DELETE: "Eliminar / Borrar",
  }[method] || method;

  const lines = [];

  // Header — searchable in Spanish
  lines.push(`Endpoint Mediastream API — Sección: ${folderName}`);
  lines.push(`Acción: ${actionVerb}`);
  lines.push(`Nombre: ${endpointName}`);
  lines.push(`Método HTTP: ${method}`);
  lines.push(`URL: ${cleanUrl}`);
  lines.push("");

  // Description
  if (req.description) {
    lines.push("Descripción:");
    lines.push(req.description.trim());
    lines.push("");
  }

  // Auth note
  lines.push("Autenticación: incluir el parámetro token (API key) en la query string o en el header X-API-Token.");
  lines.push("");

  // Query parameters
  const queryParams = urlObj?.query || [];
  if (queryParams.length > 0) {
    lines.push("Parámetros de query:");
    for (const p of queryParams) {
      const isRequired = p.description?.toLowerCase().includes("required") && !p.description?.toLowerCase().includes("optional");
      const reqLabel = isRequired ? "REQUERIDO" : "opcional";
      const desc = p.description ? p.description.replace(/REQUIRED\s*[-–]?\s*/i, "").replace(/Optional\s*[-–]?\s*/i, "").trim() : "";
      const example = p.value && !p.disabled ? `, ejemplo: ${p.value}` : "";
      lines.push(`  - ${p.key} (${reqLabel}${example}): ${desc}`);
    }
    lines.push("");
  }

  // Request body
  if (req.body) {
    if (req.body.mode === "raw" && req.body.raw?.trim()) {
      lines.push("Body de la petición (JSON):");
      lines.push(req.body.raw.trim().slice(0, 600));
      lines.push("");
    } else if (req.body.mode === "formdata" && req.body.formdata?.length > 0) {
      lines.push("Body (form-data):");
      for (const f of req.body.formdata) {
        const desc = f.description ? ` — ${f.description}` : "";
        lines.push(`  - ${f.key}: ${f.value || ""}${desc}`);
      }
      lines.push("");
    }
  }

  // Example response (first saved response)
  const responses = item.response || [];
  if (responses.length > 0 && responses[0].body) {
    lines.push("Ejemplo de respuesta exitosa:");
    try {
      const parsed = JSON.parse(responses[0].body);
      lines.push(JSON.stringify(parsed, null, 2).slice(0, 800));
    } catch {
      lines.push(responses[0].body.trim().slice(0, 800));
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ── Collect all endpoints from collection ────────────────────────────────────

function collectEndpoints(collection) {
  const results = []; // { folderName, item }

  function walk(items, parentName) {
    for (const item of items) {
      if (item.item) {
        // It's a folder — recurse
        const folderName = parentName ? `${parentName} > ${item.name}` : item.name;
        walk(item.item, folderName);
      } else if (item.request) {
        results.push({ folderName: parentName || "General", item });
      }
    }
  }

  walk(collection.item || [], "");
  return results;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`📂 Reading: ${COLLECTION_PATH}`);
  const raw = readFileSync(COLLECTION_PATH, "utf8");
  const collection = JSON.parse(raw);
  const collectionName = collection.info?.name || "Mediastream API";

  // --clean: delete all previously imported Postman docs
  if (CLEAN) {
    const deleted = await prisma.knowledgeDoc.deleteMany({
      where: { uploadedBy: "import-postman-script" },
    });
    console.log(`🗑  Deleted ${deleted.count} existing Postman docs\n`);
  }

  const endpoints = collectEndpoints(collection);
  console.log(`📋 Found ${endpoints.length} endpoints\n`);

  // Group endpoints by folder so we create one KnowledgeDoc per folder
  // but each endpoint becomes its own chunk (atomic retrieval)
  const byFolder = new Map();
  for (const { folderName, item } of endpoints) {
    if (!byFolder.has(folderName)) byFolder.set(folderName, []);
    byFolder.get(folderName).push(item);
  }

  let totalChunks = 0;

  for (const [folderName, items] of byFolder) {
    const title = `${collectionName} — ${folderName}`;

    if (!CLEAN) {
      const existing = await prisma.knowledgeDoc.findFirst({ where: { title } });
      if (existing) {
        console.log(`⏭  Skipping "${title}" (already exists — use --clean to reimport)`);
        continue;
      }
    }

    console.log(`📝 ${title} (${items.length} endpoints)`);

    // Build one chunk per endpoint
    const chunks = [];
    for (const item of items) {
      const text = endpointToChunk(item, folderName);
      if (text) chunks.push(text);
    }

    if (chunks.length === 0) continue;

    // Embed each chunk
    const chunksWithEmbeddings = [];
    for (let i = 0; i < chunks.length; i++) {
      process.stdout.write(`   Embedding ${i + 1}/${chunks.length}...\r`);
      const embedding = await embed(chunks[i]);
      chunksWithEmbeddings.push({ text: chunks[i], embedding, chunkIndex: i });
    }
    process.stdout.write("\n");

    // Full content = all chunks joined (for display in the UI)
    const fullContent = chunks.join("\n\n---\n\n");

    await prisma.knowledgeDoc.create({
      data: {
        title,
        content: fullContent,
        docType: "text",
        uploadedBy: "import-postman-script",
        chunks: { create: chunksWithEmbeddings },
      },
    });

    totalChunks += chunksWithEmbeddings.length;
    console.log(`   ✅ ${chunksWithEmbeddings.length} chunks saved\n`);
  }

  // Overview doc (collection description)
  const overviewTitle = `${collectionName} — Overview`;
  const overviewExists = !CLEAN && await prisma.knowledgeDoc.findFirst({ where: { title: overviewTitle } });
  if (!overviewExists && collection.info?.description) {
    console.log(`📝 ${overviewTitle}`);
    const overviewText = [
      `Documentación general de la API de Mediastream (plataforma de streaming).`,
      ``,
      collection.info.description.trim(),
    ].join("\n");

    const embedding = await embed(overviewText);
    await prisma.knowledgeDoc.create({
      data: {
        title: overviewTitle,
        content: overviewText,
        docType: "text",
        uploadedBy: "import-postman-script",
        chunks: {
          create: [{ text: overviewText.slice(0, 1500), embedding, chunkIndex: 0 }],
        },
      },
    });
    totalChunks += 1;
    console.log(`   ✅ Overview saved\n`);
  }

  console.log(`🎉 Done! ${totalChunks} total chunks indexed.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
