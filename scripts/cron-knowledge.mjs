// scripts/cron-knowledge.mjs
// Script standalone para el cron nocturno de sincronización de KB.
// Ejecutar como proceso separado: node scripts/cron-knowledge.mjs
// Requiere: CRON_SECRET y APP_URL en variables de entorno (o .env)

import cron from "node-cron";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env") });

const CRON_SECRET = process.env.CRON_SECRET;
const APP_URL = process.env.APP_URL || "http://localhost:3000";

if (!CRON_SECRET) {
  console.error("[cron-knowledge] ERROR: CRON_SECRET no está configurado en .env");
  process.exit(1);
}

async function runSync() {
  console.log(`[cron-knowledge] ${new Date().toISOString()} — Iniciando sincronización KB...`);
  try {
    const res = await fetch(`${APP_URL}/api/cron/knowledge-sync`, {
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });
    const data = await res.json();
    console.log(`[cron-knowledge] Resultado:`, data);
  } catch (err) {
    console.error("[cron-knowledge] Error:", err);
  }
}

// Ejecutar todos los días a las 2:00 AM
cron.schedule("0 2 * * *", runSync, {
  timezone: "America/Santiago",
});

console.log("[cron-knowledge] Scheduler iniciado. Próxima ejecución: 2:00 AM (Santiago)");
