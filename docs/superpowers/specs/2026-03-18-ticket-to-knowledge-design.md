# Diseño: Convertir Tickets de Intercom a Base de Conocimiento

**Fecha:** 2026-03-18
**Estado:** Aprobado
**Proyecto:** Soporte 360 — Mediastream

---

## Resumen

Permitir que los agentes de soporte conviertan tickets resueltos de Intercom en artículos estructurados de la base de conocimiento, con tres modalidades:

1. **Manual desde el chat** — botón en `ConversationThread` (conversación abierta o cerrada)
2. **Importación batch manual** — selector de fechas en `/knowledge`
3. **Cron nocturno automático** — procesa tickets cerrados del día anterior a las 2am

El objetivo es enriquecer la base de conocimiento RAG de la IA con casos reales resueltos, organizados por módulo de Mediastream Platform.

---

## Arquitectura General

### Tres capas de ingesta

```
[Chat: ConversationThread]
       ↓ clic "Convertir a KB"
[POST /api/knowledge/from-ticket]       → genera borrador (IA), no guarda
       ↓
[KnowledgeFromTicketDialog]             → agente edita y aprueba
       ↓
[POST /api/knowledge/save-from-ticket]  → chunking + embeddings + MongoDB

[/knowledge: BatchImportDialog]
       ↓ selector de fechas
[POST /api/knowledge/batch-from-tickets] → SSE stream de progreso
       ↓ por cada ticket
  [deduplicación por sourceId] → [genera artículo IA] → [guarda]

[Cron: script standalone a las 2am]
       ↓ HTTP GET con CRON_SECRET
[GET /api/cron/knowledge-sync]  → mismo flujo batch para ayer
```

---

## Modelo de Datos

### Cambios a `KnowledgeDoc` en `prisma/schema.prisma`

Tres campos nuevos opcionales:

| Campo | Tipo | Descripción |
|---|---|---|
| `sourceType` | `String?` | `"manual"` \| `"ticket"` \| `"script"` |
| `sourceId` | `String?` | `conversationId` de Intercom — clave de deduplicación (índice no-único, ver nota) |
| `category` | `String?` | Módulo de Mediastream Platform |

> **Nota importante sobre `sourceId`:** No se usa `@unique` porque MongoDB no genera índices sparse para campos nullable con Prisma, lo que causaría fallos en documentos sin `sourceId`. La deduplicación se garantiza a nivel de aplicación con un `findFirst` antes de cada guardado. Se agrega `@@index([sourceId])` para eficiencia de búsqueda.

### Convención para `uploadedBy`

| Origen | Valor en `uploadedBy` |
|---|---|
| Agente desde el chat | `session.user.email` |
| Batch manual | `session.user.email` |
| Cron nocturno | `"cron:knowledge-sync"` |

---

## Formato del Artículo Generado (Híbrido)

```json
{
  "titulo": "Cómo resolver señal live caída en Live Video",
  "problema": "El cliente reporta que su señal live no está transmitiendo correctamente desde el editor.",
  "solucion": [
    "Verificar estado del encoder en el panel de Live Video",
    "Revisar logs de MediaLive en busca de errores de ingesta",
    "Reiniciar el canal desde Live Editor si el estado es IDLE"
  ],
  "categoria": "Live Video",
  "tags": ["live", "encoder", "señal caída", "mediaLive"]
}
```

El texto final almacenado en `KnowledgeDoc.content` combina todos los campos en texto plano para chunking y embedding óptimos.

---

## Categorías Disponibles (Módulos de Platform)

```
Ad, Adswizz, Feeds, Analytics, Channel, Customer, Coupon,
Customer Data Platform (CDP), Federation, Products, Purchase,
Link, Live Video, Live Video Mediapackage, Live Video MediaLive,
Live Audio, Speech To Text, Watchfolder, Live Editor, AI,
Live Moments, Live Restreaming, Machine Learning, Media,
Migration, Image, Playlist, Rendition Rules, Encoder,
CDN Balancer, Video Templates, Zoom, Gracenote, External CDN,
Playout, Billing, Assistant, I18n, Full Access Token, DRM,
Distribution, Integrators, Opta, Next, Peering, Sale, Show,
WebHooks, Widget, Live Google DAI, VOD Google DAI, Articles,
Mailchimp, Emblue, Fast Channel, EPG (Origin), EPG (Output),
Api & Tokens
```

---

## Prompt de IA para Generación

```
SISTEMA:
Eres un redactor de base de conocimientos para el equipo de soporte de Mediastream.
Tu tarea es convertir tickets de soporte resueltos en artículos útiles y reutilizables.
Responde SIEMPRE en español. Sé conciso y directo.
IMPORTANTE: Responde SOLO con JSON válido, sin texto adicional ni markdown.

USUARIO:
Convierte este ticket resuelto en un artículo de conocimiento con el siguiente formato JSON exacto:
{
  "titulo": "Título claro del problema y solución (máx 80 chars)",
  "problema": "Descripción de 1-2 oraciones del problema reportado",
  "solucion": ["Paso 1...", "Paso 2...", "Paso 3..."],
  "categoria": "<una categoría de la lista de módulos>",
  "tags": ["tag1", "tag2", "tag3"]
}

Conversación (últimos 15 mensajes, máx 6000 caracteres):
[mensajes del ticket — solo comentarios públicos, sin notas internas]
```

> **Filtrado de mensajes:** Antes de enviar a la IA, se filtran los mensajes para incluir solo `type: "comment"` (no notas internas). Se toman los últimos 15 mensajes y se trunca el total a 6000 caracteres. Esto evita problemas de token limit.

---

## Configuración de IA para Generación de Artículos

La función `chat()` en `src/lib/aiProvider.ts` mantiene su tipo de retorno `Promise<AIResponse>` y se extiende con un parámetro opcional `maxTokens`:

```typescript
// aiProvider.ts — cambio mínimo, backward compatible
export async function chat(
  messages: AIMessage[],
  options?: { maxTokens?: number }
): Promise<AIResponse>
```

Internamente:
- **Claude**: `max_tokens: options?.maxTokens ?? 1024`
- **Ollama**: `options: { num_predict: options?.maxTokens ?? -1 }` en el body del request

`ticketToKnowledge.ts` llama `chat(messages, { maxTokens: 2048 })` y usa `response.text` para obtener el JSON.
Todos los callers existentes (sin segundo parámetro) mantienen el comportamiento actual.

---

## Nuevos Archivos

### APIs

| Archivo | Método | Descripción |
|---|---|---|
| `src/app/api/knowledge/from-ticket/route.ts` | `POST` | Genera borrador IA, no guarda. Body: `{ conversationId }` |
| `src/app/api/knowledge/save-from-ticket/route.ts` | `POST` | Chunking + embeddings + save. Body: artículo aprobado |
| `src/app/api/knowledge/batch-from-tickets/route.ts` | `POST` | Importación masiva SSE. Body: `{ from, to }` (fechas ISO). Headers de respuesta obligatorios: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive` |
| `src/app/api/cron/knowledge-sync/route.ts` | `GET` | Cron endpoint protegido con `CRON_SECRET` |

### Componentes

| Archivo | Descripción |
|---|---|
| `src/components/knowledge/KnowledgeFromTicketDialog.tsx` | Modal editable con borrador generado por IA |
| `src/components/knowledge/BatchImportDialog.tsx` | Modal con selector de fechas y progreso SSE en tiempo real |

### Lib

| Archivo | Descripción |
|---|---|
| `src/lib/ticketToKnowledge.ts` | Lógica compartida: fetch Intercom → filtrar mensajes → prompt IA → parsear JSON → formatear texto → chunk + embed + save |

### Script standalone del cron

| Archivo | Descripción |
|---|---|
| `scripts/cron-knowledge.mjs` | Script Node.js independiente que llama `GET /api/cron/knowledge-sync` a las 2am usando `node-cron`. Se ejecuta como proceso separado: `node scripts/cron-knowledge.mjs` |

> **Por qué script standalone y no en `layout.tsx`:** Next.js App Router ejecuta módulos de Server Components por render, no al inicio del proceso. Importar `node-cron` desde `layout.tsx` registraría múltiples schedules superpuestos. El script standalone es un proceso Node.js independiente que simplemente hace una llamada HTTP al endpoint existente.

---

## Flujo Detallado: Botón en el Chat

1. Agente ve botón **"📚 Convertir a KB"** en header de `ConversationThread`
2. Clic → spinner "Analizando conversación..."
3. `POST /api/knowledge/from-ticket` con `conversationId`
   - Obtiene mensajes via Intercom API
   - Filtra: solo `type: "comment"`, últimos 15, máx 6000 chars
   - Construye prompt con los mensajes
   - Llama a IA con `maxTokens: 2048`
   - Parsea JSON de respuesta (retry 1 vez si falla el parse)
   - Retorna borrador
4. Se abre `KnowledgeFromTicketDialog` con campos prellenados
5. Agente puede editar: título, problema, solución, categoría, tags
6. Clic **"Guardar en KB"** → `POST /api/knowledge/save-from-ticket`
   - Verifica deduplicación: `findFirst({ where: { sourceId: conversationId } })`
   - Si ya existe: toast de aviso, no duplica
   - Genera texto completo del artículo
   - Chunking con `src/lib/chunker.ts`
   - Embeddings con `src/lib/embeddings.ts`
   - Guarda `KnowledgeDoc` + `KnowledgeChunk[]` con `sourceType: "ticket"`, `sourceId: conversationId`, `uploadedBy: session.user.email`
7. Toast: "✅ Artículo guardado en la base de conocimiento"

---

## Flujo Detallado: Batch Manual (SSE)

1. En `/knowledge`, botón **"📥 Importar tickets resueltos"** en el header
2. Abre `BatchImportDialog` con selector de fechas (default: últimos 30 días)
3. Clic **"Importar"** → `POST /api/knowledge/batch-from-tickets`
4. La API responde como `ReadableStream` (SSE):
   - Busca conversaciones cerradas en Intercom en el rango de fechas (paginado, 1s entre páginas para respetar rate limit)
   - Por cada ticket: verifica deduplicación → genera artículo → guarda
   - Emite: `{ type: "progress", processed: N, skipped: M, errors: K, total: T }`
   - Al terminar: `{ type: "done", processed, skipped, errors }`
5. `BatchImportDialog` lee el stream y actualiza barra de progreso en tiempo real
6. Al finalizar: "47 artículos importados · 3 duplicados omitidos"

---

## Flujo Detallado: Cron Nocturno

```
scripts/cron-knowledge.mjs (proceso Node independiente)
  → schedule: "0 2 * * *" via node-cron
  → fetch("http://localhost:3000/api/cron/knowledge-sync", {
      headers: { Authorization: `Bearer ${CRON_SECRET}` }
    })
```

`GET /api/cron/knowledge-sync`:
```typescript
// Guard defensivo — falla explícitamente si CRON_SECRET no está configurado
const secret = process.env.CRON_SECRET;
if (!secret) return NextResponse.json({ error: "Cron not configured" }, { status: 503 });
const auth = req.headers.get("authorization");
if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
// → procesa tickets cerrados de ayer con uploadedBy: "cron:knowledge-sync"
```

---

## Variables de Entorno Requeridas

```env
CRON_SECRET=<token-secreto-para-el-endpoint-del-cron>
```

Se debe agregar a `.env.example` y documentar en `CLAUDE.md`.

---

## Dependencias Nuevas

```bash
npm install --save-dev node-cron @types/node-cron
```

Solo se usa en el script standalone `scripts/cron-knowledge.mjs`, no en el bundle de Next.js. Se instala como `devDependency` para que no sea incluido en el bundle de producción de Next.js.

---

## Manejo de Errores

| Escenario | Comportamiento |
|---|---|
| IA retorna JSON inválido | Reintentar 1 vez; si falla de nuevo, retornar error al cliente |
| Conversación sin mensajes públicos | Omitir en batch (contar como error), mostrar toast de error en manual |
| Ticket ya existe en KB | Omitido silenciosamente en batch (contar como `skipped`), toast informativo en manual |
| Error de embeddings (Ollama caído) | Guardar doc sin embeddings, loguear warning. El artículo es visible en /knowledge pero sin RAG hasta re-procesar |
| Intercom rate limit (429) | Esperar 1s entre requests en batch |
| `CRON_SECRET` no configurado | Endpoint retorna 503 y loguea error crítico en consola |
| `maxTokens` insuficiente (respuesta truncada) | El JSON parse falla → retry con mensaje más corto (truncar a 3000 chars) |

---

## Criterios de Éxito

- [ ] Botón "Convertir a KB" visible en `ConversationThread` para cualquier conversación
- [ ] Modal genera borrador en menos de 10 segundos
- [ ] Artículo guardado aparece inmediatamente en `/knowledge`
- [ ] La IA del chat usa los nuevos artículos como contexto RAG
- [ ] Batch procesa 100 tickets con progreso en tiempo real vía SSE, sin timeout del navegador
- [ ] Cron corre a las 2am como proceso standalone sin afectar el servidor Next.js
- [ ] No se generan duplicados aunque se importe el mismo ticket dos veces
- [ ] `CRON_SECRET` vacío/ausente bloquea el endpoint con 503 explícito
