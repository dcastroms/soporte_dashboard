/**
 * Proxy MongoDB local para desarrollo.
 * Imita el comportamiento de la Lambda soporte-mongodb-*-proxy.
 *
 * Uso:
 *   node scripts/local-mongo-proxy.mjs
 *
 * Requiere en .env:
 *   DATABASE_URL=mongodb+srv://...
 *   DATABASE_PROXY_URL=http://localhost:3001
 */

import { createServer } from "http";
import { MongoClient, ObjectId } from "mongodb";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Cargar .env manualmente (sin dependencias extra)
try {
  const envPath = resolve(__dirname, "../.env");
  const lines = readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
} catch {
  // .env no encontrado, continúa con variables del sistema
}

const MONGODB_URI = process.env.DATABASE_URL;
const PORT = 3001;

if (!MONGODB_URI) {
  console.error("❌  DATABASE_URL no está definida en .env");
  process.exit(1);
}

const client = new MongoClient(MONGODB_URI);
await client.connect();
const db = client.db();
console.log(`✅  Conectado a MongoDB: ${db.databaseName}`);

function parseValue(val) {
  if (val === null || val === undefined) return val;
  if (typeof val === "object" && !Array.isArray(val)) {
    // Convertir {$oid: "..."} a ObjectId
    if (val.$oid) return new ObjectId(val.$oid);
    const out = {};
    for (const [k, v] of Object.entries(val)) out[k] = parseValue(v);
    return out;
  }
  if (Array.isArray(val)) return val.map(parseValue);
  return val;
}

async function handleQuery(payload) {
  const { collection, operation, filter, document, documents, update, options, pipeline } = payload;
  const col = db.collection(collection);

  const f = parseValue(filter) || {};
  const opts = parseValue(options) || {};

  switch (operation) {
    case "find":
      return await col.find(f, opts).toArray();
    case "findOne":
      return await col.findOne(f, opts);
    case "insertOne":
      return await col.insertOne(parseValue(document));
    case "insertMany":
      return await col.insertMany((documents || []).map(parseValue));
    case "updateOne":
      return await col.updateOne(f, parseValue(update), opts);
    case "updateMany":
      return await col.updateMany(f, parseValue(update), opts);
    case "replaceOne":
      return await col.replaceOne(f, parseValue(document), opts);
    case "deleteOne":
      return await col.deleteOne(f);
    case "deleteMany":
      return await col.deleteMany(f);
    case "countDocuments":
      return await col.countDocuments(f, opts);
    case "aggregate":
      return await col.aggregate((pipeline || []).map(parseValue)).toArray();
    default:
      throw new Error(`Operación no soportada: ${operation}`);
  }
}

const server = createServer(async (req, res) => {
  if (req.method !== "POST") {
    res.writeHead(405);
    res.end();
    return;
  }

  let body = "";
  for await (const chunk of req) body += chunk;

  try {
    const payload = JSON.parse(body);
    const result = await handleQuery(payload);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, result }));
  } catch (err) {
    console.error(`[proxy] Error en ${body.slice(0, 100)}:`, err.message);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, reason: err.message }));
  }
});

server.listen(PORT, () => {
  console.log(`🚀  Local MongoDB proxy escuchando en http://localhost:${PORT}`);
  console.log(`    Agrega a .env:  DATABASE_PROXY_URL=http://localhost:${PORT}`);
});
