# Ticket → Knowledge Base Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir tickets resueltos de Intercom en artículos de la base de conocimiento RAG — desde un botón en el chat, importación batch por fechas, y un cron nocturno automático.

**Architecture:** `ticketToKnowledge.ts` centraliza toda la lógica compartida (fetch Intercom → prompt IA → parse JSON → chunk + embed + save). Las APIs delegan en este módulo. Los componentes React consumen las APIs con SSE para el batch. El cron es un script Node standalone que llama el endpoint via HTTP.

**Tech Stack:** Next.js 16 App Router, Prisma + MongoDB Atlas, Intercom REST API v2.11, Ollama/Claude via aiProvider.ts, shadcn/ui, Tailwind CSS v4

---

## Mapa de archivos

### Crear
| Archivo | Responsabilidad |
|---|---|
| `src/lib/platformModules.ts` | Lista de módulos de Platform (constante compartida) |
| `src/lib/ticketToKnowledge.ts` | Lógica core: draft generation + save to DB |
| `src/app/api/knowledge/from-ticket/route.ts` | POST: genera borrador, no guarda |
| `src/app/api/knowledge/save-from-ticket/route.ts` | POST: guarda artículo aprobado |
| `src/app/api/knowledge/batch-from-tickets/route.ts` | POST: importación masiva SSE |
| `src/app/api/cron/knowledge-sync/route.ts` | GET: endpoint del cron nocturno |
| `src/components/knowledge/KnowledgeFromTicketDialog.tsx` | Modal editable con borrador IA |
| `src/components/knowledge/BatchImportDialog.tsx` | Modal con selector fechas + progreso SSE |
| `scripts/cron-knowledge.mjs` | Script Node standalone para el cron |

### Modificar
| Archivo | Cambio |
|---|---|
| `prisma/schema.prisma` | Agregar `sourceType`, `sourceId`, `category`, `@@index([sourceId])` a KnowledgeDoc |
| `src/lib/intercom.ts` | Agregar `searchClosedConversations(from, to, page)` |
| `src/components/chat/ConversationThread.tsx` | Botón "Convertir a KB" en el header |
| `src/components/knowledge/KnowledgeShell.tsx` | Botón "Importar tickets" en el header |

---

## Task 1: Schema — Agregar campos a KnowledgeDoc

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Paso 1: Agregar campos nuevos al modelo KnowledgeDoc**

Localizar el modelo `KnowledgeDoc` y agregar 3 campos + 1 index:

```prisma
model KnowledgeDoc {
  id          String           @id @default(auto()) @map("_id") @db.ObjectId
  title       String
  content     String
  uploadedBy  String
  docType     String           @default("text")
  imageUrl    String?
  sourceType  String?          // "manual" | "ticket" | "script"
  sourceId    String?          // conversationId de Intercom (para dedup)
  category    String?          // Módulo de Mediastream Platform
  createdAt   DateTime         @default(now())
  chunks      KnowledgeChunk[]

  @@index([sourceId])
}
```

- [ ] **Paso 2: Aplicar schema a la base de datos**

```bash
cd D:/Soporte/dashboard
npx prisma db push
```

Esperado: `Your database is now in sync with your Prisma schema.`

- [ ] **Paso 3: Verificar con lint**

```bash
npm run lint 2>&1 | grep -E "schema|prisma" | head -5
```

- [ ] **Paso 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add sourceType, sourceId, category to KnowledgeDoc"
```

---

## Task 2: platformModules.ts — Lista de categorías

**Files:**
- Create: `src/lib/platformModules.ts`

- [ ] **Paso 1: Crear constante con todos los módulos**

```typescript
// src/lib/platformModules.ts
export const PLATFORM_MODULES = [
  "Ad", "Adswizz", "Feeds", "Analytics", "Channel", "Customer", "Coupon",
  "Customer Data Platform (CDP)", "Federation", "Products", "Purchase",
  "Link", "Live Video", "Live Video Mediapackage", "Live Video MediaLive",
  "Live Audio", "Speech To Text", "Watchfolder", "Live Editor", "AI",
  "Live Moments", "Live Restreaming", "Machine Learning", "Media",
  "Migration", "Image", "Playlist", "Rendition Rules", "Encoder",
  "CDN Balancer", "Video Templates", "Zoom", "Gracenote", "External CDN",
  "Playout", "Billing", "Assistant", "I18n", "Full Access Token", "DRM",
  "Distribution", "Integrators", "Opta", "Next", "Peering", "Sale", "Show",
  "WebHooks", "Widget", "Live Google DAI", "VOD Google DAI", "Articles",
  "Mailchimp", "Emblue", "Fast Channel", "EPG (Origin)", "EPG (Output)",
  "Api & Tokens", "General",
] as const;

export type PlatformModule = typeof PLATFORM_MODULES[number];
```

- [ ] **Paso 2: Lint**

```bash
npm run lint -- --file src/lib/platformModules.ts 2>&1 | tail -5
```

- [ ] **Paso 3: Commit**

```bash
git add src/lib/platformModules.ts
git commit -m "feat(knowledge): add platform modules catalog"
```

---

## Task 3: intercom.ts — Agregar searchClosedConversations

**Files:**
- Modify: `src/lib/intercom.ts` (al final del archivo)

- [ ] **Paso 1: Agregar la función de búsqueda de conversaciones cerradas**

Agregar al final de `src/lib/intercom.ts`:

```typescript
/**
 * Busca conversaciones cerradas (resueltas) en un rango de fechas.
 * Usa el endpoint POST /conversations/search de Intercom API v2.11.
 * Retorna array de IDs de conversación para procesar en batch.
 */
export async function searchClosedConversations(
  from: Date,
  to: Date,
  page = 1
): Promise<{ ids: string[]; totalPages: number }> {
  if (!INTERCOM_TOKEN) return { ids: [], totalPages: 0 };

  const resp = await fetch(`${INTERCOM_API_URL}/conversations/search`, {
    method: "POST",
    headers: { ...HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: {
        operator: "AND",
        value: [
          { field: "state", operator: "=", value: "resolved" },
          { field: "updated_at", operator: ">", value: Math.floor(from.getTime() / 1000) },
          { field: "updated_at", operator: "<", value: Math.floor(to.getTime() / 1000) },
        ],
      },
      pagination: { per_page: 20, page },
    }),
  });

  if (!resp.ok) return { ids: [], totalPages: 0 };

  const data = await resp.json();
  const ids: string[] = (data.conversations || []).map((c: { id: string }) => c.id);
  const total = data.total_count || 0;
  const totalPages = Math.ceil(total / 20);

  return { ids, totalPages };
}
```

- [ ] **Paso 2: Lint**

```bash
npm run lint -- --file src/lib/intercom.ts 2>&1 | grep "error" | head -10
```

- [ ] **Paso 3: Commit**

```bash
git add src/lib/intercom.ts
git commit -m "feat(intercom): add searchClosedConversations for batch KB import"
```

---

## Task 4: ticketToKnowledge.ts — Lógica core compartida

**Files:**
- Create: `src/lib/ticketToKnowledge.ts`

- [ ] **Paso 1: Crear el módulo con tipos, prompt y funciones**

```typescript
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
  // Filtrar: solo comentarios públicos, últimos 15, máx 6000 chars
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

  // Parsear JSON — 1 reintento si falla
  let draft: ArticleDraft;
  try {
    draft = JSON.parse(raw);
  } catch {
    // Intentar extraer JSON del texto si viene envuelto en markdown
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("La IA no retornó JSON válido");
    draft = JSON.parse(match[0]);
  }

  // Validar campos mínimos
  if (!draft.titulo || !draft.problema || !Array.isArray(draft.solucion)) {
    throw new Error("El artículo generado está incompleto");
  }

  // Normalizar categoría
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
 * Retorna null si ya existe (deduplicación por sourceId).
 */
export async function saveArticleToDB(
  draft: ArticleDraft,
  options: {
    conversationId: string;
    uploadedBy: string;
  }
) {
  // Deduplicación: verificar si ya existe este ticket en la KB
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
    // Si Ollama falla, guardar sin embeddings (visible en KB pero sin RAG)
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
```

- [ ] **Paso 2: Lint**

```bash
npm run lint -- --file src/lib/ticketToKnowledge.ts 2>&1 | grep "error" | head -10
```

- [ ] **Paso 3: Commit**

```bash
git add src/lib/ticketToKnowledge.ts
git commit -m "feat(knowledge): add ticketToKnowledge core logic (draft + save)"
```

---

## Task 5: API — POST /api/knowledge/from-ticket

**Files:**
- Create: `src/app/api/knowledge/from-ticket/route.ts`

- [ ] **Paso 1: Crear el endpoint**

```typescript
// src/app/api/knowledge/from-ticket/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateArticleDraft } from "@/lib/ticketToKnowledge";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let conversationId: string;
  try {
    const body = await req.json();
    conversationId = body.conversationId;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!conversationId) {
    return NextResponse.json({ error: "conversationId requerido" }, { status: 400 });
  }

  try {
    const draft = await generateArticleDraft(conversationId);
    return NextResponse.json({ draft, conversationId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error generando artículo";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Paso 2: Lint**

```bash
npm run lint -- --file src/app/api/knowledge/from-ticket/route.ts 2>&1 | grep "error" | head -5
```

- [ ] **Paso 3: Commit**

```bash
git add src/app/api/knowledge/from-ticket/route.ts
git commit -m "feat(api): add POST /api/knowledge/from-ticket"
```

---

## Task 6: API — POST /api/knowledge/save-from-ticket

**Files:**
- Create: `src/app/api/knowledge/save-from-ticket/route.ts`

- [ ] **Paso 1: Crear el endpoint**

```typescript
// src/app/api/knowledge/save-from-ticket/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { saveArticleToDB } from "@/lib/ticketToKnowledge";
import type { ArticleDraft } from "@/lib/ticketToKnowledge";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { draft: ArticleDraft; conversationId: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.draft || !body.conversationId) {
    return NextResponse.json({ error: "draft y conversationId requeridos" }, { status: 400 });
  }

  try {
    const result = await saveArticleToDB(body.draft, {
      conversationId: body.conversationId,
      uploadedBy: session.user.email,
    });

    if (result.skipped) {
      return NextResponse.json({ skipped: true, docId: result.docId }, { status: 200 });
    }

    return NextResponse.json({ saved: true, docId: result.docId }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error guardando artículo";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Paso 2: Lint**

```bash
npm run lint -- --file src/app/api/knowledge/save-from-ticket/route.ts 2>&1 | grep "error" | head -5
```

- [ ] **Paso 3: Commit**

```bash
git add src/app/api/knowledge/save-from-ticket/route.ts
git commit -m "feat(api): add POST /api/knowledge/save-from-ticket"
```

---

## Task 7: Componente — KnowledgeFromTicketDialog

**Files:**
- Create: `src/components/knowledge/KnowledgeFromTicketDialog.tsx`

- [ ] **Paso 1: Crear el modal con borrador editable**

```typescript
// src/components/knowledge/KnowledgeFromTicketDialog.tsx
"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Loader2, Save, X } from "lucide-react";
import { toast } from "sonner";
import { PLATFORM_MODULES } from "@/lib/platformModules";
import type { ArticleDraft } from "@/lib/ticketToKnowledge";

interface Props {
  conversationId: string;
  open: boolean;
  onClose: () => void;
}

export function KnowledgeFromTicketDialog({ conversationId, open, onClose }: Props) {
  const [step, setStep] = useState<"loading" | "editing" | "saving">("loading");
  const [draft, setDraft] = useState<ArticleDraft | null>(null);
  const [solucionText, setSolucionText] = useState(""); // pasos como texto libre

  // Cargar borrador al abrir
  const loadDraft = async () => {
    setStep("loading");
    try {
      const res = await fetch("/api/knowledge/from-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error generando borrador");
      setDraft(data.draft);
      setSolucionText(data.draft.solucion.join("\n"));
      setStep("editing");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al generar artículo");
      onClose();
    }
  };

  // Disparar carga cuando el dialog se abre
  useEffect(() => {
    if (open) loadDraft();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) onClose();
  };

  const handleSave = async () => {
    if (!draft) return;
    setStep("saving");

    // Convertir texto de solución de vuelta a array
    const solucion = solucionText
      .split("\n")
      .map((s) => s.replace(/^\d+\.\s*/, "").trim())
      .filter(Boolean);

    const finalDraft: ArticleDraft = { ...draft, solucion };

    try {
      const res = await fetch("/api/knowledge/save-from-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft: finalDraft, conversationId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error guardando artículo");

      if (data.skipped) {
        toast.info("Este ticket ya estaba en la base de conocimiento");
      } else {
        toast.success("Artículo guardado en la Base de Conocimiento");
      }
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
      setStep("editing");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-bold">
            <BookOpen size={15} className="text-primary" />
            Convertir ticket a Base de Conocimiento
          </DialogTitle>
        </DialogHeader>

        {step === "loading" && (
          <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
            <Loader2 size={24} className="animate-spin text-primary" />
            <p className="text-sm">Analizando conversación...</p>
          </div>
        )}

        {(step === "editing" || step === "saving") && draft && (
          <div className="space-y-4 mt-2">
            {/* Título */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Título</label>
              <Input
                value={draft.titulo}
                onChange={(e) => setDraft((d) => d ? { ...d, titulo: e.target.value } : d)}
                className="text-sm"
              />
            </div>

            {/* Problema */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Problema</label>
              <Textarea
                value={draft.problema}
                onChange={(e) => setDraft((d) => d ? { ...d, problema: e.target.value } : d)}
                rows={2}
                className="text-sm resize-none"
              />
            </div>

            {/* Solución */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">
                Solución <span className="text-muted-foreground/60 font-normal">(un paso por línea)</span>
              </label>
              <Textarea
                value={solucionText}
                onChange={(e) => setSolucionText(e.target.value)}
                rows={5}
                className="text-sm font-mono resize-none"
              />
            </div>

            {/* Categoría */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Categoría</label>
              <Select
                value={draft.categoria}
                onValueChange={(v) => setDraft((d) => d ? { ...d, categoria: v } : d)}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {PLATFORM_MODULES.map((m) => (
                    <SelectItem key={m} value={m} className="text-sm">{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tags */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Tags</label>
              <div className="flex flex-wrap gap-1.5">
                {draft.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-[10px] gap-1">
                    {tag}
                    <button
                      onClick={() => setDraft((d) => d ? { ...d, tags: d.tags.filter((t) => t !== tag) } : d)}
                      className="hover:text-destructive"
                    >
                      <X size={9} />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            {/* Acciones */}
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="outline" size="sm" onClick={onClose} disabled={step === "saving"}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSave} disabled={step === "saving"} className="gap-1.5">
                {step === "saving" ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                Guardar en KB
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Paso 2: Lint**

```bash
npm run lint -- --file src/components/knowledge/KnowledgeFromTicketDialog.tsx 2>&1 | grep "error" | head -10
```

- [ ] **Paso 3: Commit**

```bash
git add src/components/knowledge/KnowledgeFromTicketDialog.tsx
git commit -m "feat(knowledge): add KnowledgeFromTicketDialog modal"
```

---

## Task 8: ConversationThread — Botón "Convertir a KB"

**Files:**
- Modify: `src/components/chat/ConversationThread.tsx`

- [ ] **Paso 1: Agregar import y estado del dialog**

Agregar al bloque de imports (buscar la línea con `import { ExternalLink`):

```typescript
import { KnowledgeFromTicketDialog } from "@/components/knowledge/KnowledgeFromTicketDialog";
import { BookOpen } from "lucide-react";
```

Agregar estado dentro del componente (junto a los otros `useState`):

```typescript
const [showKbDialog, setShowKbDialog] = useState(false);
```

- [ ] **Paso 2: Agregar botón en el header del conversation**

En el header, reemplazar el anchor `<a href={detail.url}...>` existente con un div wrapper que contenga ambos botones:

```tsx
<div className="flex items-center gap-2 ml-2 shrink-0">
  <button
    onClick={() => setShowKbDialog(true)}
    className="text-muted-foreground hover:text-primary transition-colors"
    title="Convertir a Base de Conocimiento"
  >
    <BookOpen size={15} />
  </button>
  <a
    href={detail.url}
    target="_blank"
    rel="noopener noreferrer"
    className="text-muted-foreground hover:text-primary transition-colors"
    title="Ver en Intercom"
  >
    <ExternalLink size={15} />
  </a>
</div>
```
Note: This replaces the existing `<a href={detail.url}...>` anchor — wrap it together with the new button.

- [ ] **Paso 3: Agregar el dialog al final del JSX**

Antes del cierre del `div` principal del componente:

```typescript
{/* KB Dialog */}
{showKbDialog && detail && (
  <KnowledgeFromTicketDialog
    conversationId={conversationId}
    open={showKbDialog}
    onClose={() => setShowKbDialog(false)}
  />
)}
```

- [ ] **Paso 4: Lint**

```bash
npm run lint -- --file src/components/chat/ConversationThread.tsx 2>&1 | grep "error" | head -10
```

- [ ] **Paso 5: Verificar en el navegador**

```bash
npm run dev
```

Abrir `/chat`, seleccionar una conversación, verificar que aparece el ícono 📚 en el header, hacer clic y confirmar que el modal se abre y genera el borrador.

- [ ] **Paso 6: Commit**

```bash
git add src/components/chat/ConversationThread.tsx
git commit -m "feat(chat): add 'Convertir a KB' button in ConversationThread"
```

---

## Task 9: API — POST /api/knowledge/batch-from-tickets (SSE)

**Files:**
- Create: `src/app/api/knowledge/batch-from-tickets/route.ts`

- [ ] **Paso 1: Crear el endpoint SSE**

```typescript
// src/app/api/knowledge/batch-from-tickets/route.ts
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { searchClosedConversations } from "@/lib/intercom";
import { generateArticleDraft, saveArticleToDB } from "@/lib/ticketToKnowledge";

export const dynamic = "force-dynamic";

function sseEvent(data: object): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  let from: Date, to: Date;
  try {
    const body = await req.json();
    from = new Date(body.from);
    to = new Date(body.to);
    if (isNaN(from.getTime()) || isNaN(to.getTime())) throw new Error("Fechas inválidas");
  } catch {
    return new Response(JSON.stringify({ error: "from y to requeridos (ISO date)" }), { status: 400 });
  }

  const uploadedBy = session.user.email;

  const stream = new ReadableStream({
    async start(controller) {
      const encode = (data: object) => controller.enqueue(new TextEncoder().encode(sseEvent(data)));

      try {
        // Fase 1: Obtener todos los IDs de conversaciones cerradas en el rango
        const allIds: string[] = [];
        let page = 1;
        let totalPages = 1;

        encode({ type: "status", message: "Buscando tickets en Intercom..." });

        do {
          const result = await searchClosedConversations(from, to, page);
          allIds.push(...result.ids);
          totalPages = result.totalPages;
          page++;
          if (page <= totalPages) await sleep(1000); // respetar rate limit
        } while (page <= totalPages);

        const total = allIds.length;
        encode({ type: "status", message: `${total} tickets encontrados. Procesando...` });

        // Fase 2: Procesar cada ticket
        let processed = 0;
        let skipped = 0;
        let errors = 0;

        for (const conversationId of allIds) {
          try {
            const draft = await generateArticleDraft(conversationId);
            const result = await saveArticleToDB(draft, { conversationId, uploadedBy });

            if (result.skipped) {
              skipped++;
            } else {
              processed++;
            }
          } catch {
            errors++;
          }

          encode({ type: "progress", processed, skipped, errors, total });
          await sleep(500); // throttle entre tickets
        }

        encode({ type: "done", processed, skipped, errors, total });
      } catch (err) {
        encode({ type: "error", message: err instanceof Error ? err.message : "Error inesperado" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
```

- [ ] **Paso 2: Lint**

```bash
npm run lint -- --file src/app/api/knowledge/batch-from-tickets/route.ts 2>&1 | grep "error" | head -5
```

- [ ] **Paso 3: Commit**

```bash
git add src/app/api/knowledge/batch-from-tickets/route.ts
git commit -m "feat(api): add POST /api/knowledge/batch-from-tickets with SSE streaming"
```

---

## Task 10: Componente — BatchImportDialog

**Files:**
- Create: `src/components/knowledge/BatchImportDialog.tsx`

- [ ] **Paso 1: Crear el modal de importación batch**

```typescript
// src/components/knowledge/BatchImportDialog.tsx
"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Loader2, CheckCircle2 } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface Progress {
  processed: number;
  skipped: number;
  errors: number;
  total: number;
  message?: string;
}

function toInputDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

export function BatchImportDialog({ open, onClose }: Props) {
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);

  const [from, setFrom] = useState(toInputDate(thirtyDaysAgo));
  const [to, setTo] = useState(toInputDate(today));
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [progress, setProgress] = useState<Progress | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const handleImport = async () => {
    setStatus("running");
    setProgress({ processed: 0, skipped: 0, errors: 0, total: 0 });
    setErrorMsg("");

    try {
      const res = await fetch("/api/knowledge/batch-from-tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: new Date(from).toISOString(), to: new Date(to + "T23:59:59").toISOString() }),
      });

      if (!res.ok || !res.body) throw new Error("Error iniciando importación");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split("\n").filter((l) => l.startsWith("data: "));

        for (const line of lines) {
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "progress" || event.type === "done") {
              setProgress(event);
            }
            if (event.type === "status") {
              setProgress((p) => p ? { ...p, message: event.message } : null);
            }
            if (event.type === "done") {
              setStatus("done");
            }
            if (event.type === "error") {
              setErrorMsg(event.message);
              setStatus("error");
            }
          } catch {}
        }
      }

      // no-op: status was already set to "done" via SSE "done" event
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error inesperado");
      setStatus("error");
    }
  };

  const handleClose = () => {
    setStatus("idle");
    setProgress(null);
    setErrorMsg("");
    onClose();
  };

  const percent = progress?.total ? Math.round(((progress.processed + progress.skipped) / progress.total) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-bold">
            <Download size={14} className="text-primary" />
            Importar tickets resueltos a KB
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Selector de fechas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Desde</label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="text-sm" disabled={status === "running"} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Hasta</label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="text-sm" disabled={status === "running"} />
            </div>
          </div>

          {/* Progreso */}
          {progress && (
            <div className="space-y-2">
              {progress.message && (
                <p className="text-[11px] text-muted-foreground">{progress.message}</p>
              )}
              {progress.total > 0 && (
                <>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>{progress.processed} importados · {progress.skipped} duplicados · {progress.errors} errores</span>
                    <span>{progress.processed + progress.skipped}/{progress.total}</span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Estado final */}
          {status === "done" && (
            <div className="flex items-center gap-2 text-sm text-emerald-500 font-medium">
              <CheckCircle2 size={14} />
              Importación completada
            </div>
          )}

          {status === "error" && (
            <p className="text-sm text-destructive">{errorMsg}</p>
          )}

          {/* Acciones */}
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="outline" size="sm" onClick={handleClose} disabled={status === "running"}>
              {status === "done" ? "Cerrar" : "Cancelar"}
            </Button>
            {status !== "done" && (
              <Button size="sm" onClick={handleImport} disabled={status === "running"} className="gap-1.5">
                {status === "running" ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                {status === "running" ? "Importando..." : "Importar"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Paso 2: Lint**

```bash
npm run lint -- --file src/components/knowledge/BatchImportDialog.tsx 2>&1 | grep "error" | head -5
```

- [ ] **Paso 3: Commit**

```bash
git add src/components/knowledge/BatchImportDialog.tsx
git commit -m "feat(knowledge): add BatchImportDialog with SSE progress"
```

---

## Task 11: KnowledgeShell — Botón "Importar tickets"

**Files:**
- Modify: `src/components/knowledge/KnowledgeShell.tsx`

- [ ] **Paso 1: Agregar import**

Agregar al bloque de imports:

```typescript
import { BatchImportDialog } from "@/components/knowledge/BatchImportDialog";
import { Download } from "lucide-react";
```

- [ ] **Paso 2: Agregar estado**

Dentro del componente, junto a los otros useState:

```typescript
const [showBatchDialog, setShowBatchDialog] = useState(false);
```

- [ ] **Paso 3: Agregar botón en el header**

En el área del header junto al botón "Agregar":

```typescript
<Button
  variant="outline"
  size="sm"
  onClick={() => setShowBatchDialog(true)}
  className="gap-1.5"
>
  <Download size={14} />
  Importar tickets
</Button>
```

- [ ] **Paso 4: Agregar el dialog**

Antes del cierre del return:

```typescript
<BatchImportDialog open={showBatchDialog} onClose={() => setShowBatchDialog(false)} />
```

- [ ] **Paso 5: Lint**

```bash
npm run lint -- --file src/components/knowledge/KnowledgeShell.tsx 2>&1 | grep "error" | head -5
```

- [ ] **Paso 6: Verificar en el navegador**

Abrir `/knowledge` y verificar que aparece el botón "Importar tickets", que el modal se abre, y que el selector de fechas funciona.

- [ ] **Paso 7: Commit**

```bash
git add src/components/knowledge/KnowledgeShell.tsx
git commit -m "feat(knowledge): add batch import button to KnowledgeShell"
```

---

## Task 12: API — GET /api/cron/knowledge-sync

**Files:**
- Create: `src/app/api/cron/knowledge-sync/route.ts`

- [ ] **Paso 1: Crear el endpoint del cron**

```typescript
// src/app/api/cron/knowledge-sync/route.ts
import { NextRequest, NextResponse } from "next/server";
import { searchClosedConversations } from "@/lib/intercom";
import { generateArticleDraft, saveArticleToDB } from "@/lib/ticketToKnowledge";

export const dynamic = "force-dynamic";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(req: NextRequest) {
  // Validar CRON_SECRET
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[knowledge-cron] CRON_SECRET no está configurado");
    return NextResponse.json({ error: "Cron not configured" }, { status: 503 });
  }

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Procesar tickets del día anterior
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 1);
  from.setHours(0, 0, 0, 0);
  to.setHours(0, 0, 0, 0); // hasta medianoche del día anterior

  console.log(`[knowledge-cron] Procesando tickets ${from.toISOString()} → ${to.toISOString()}`);

  const allIds: string[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const result = await searchClosedConversations(from, to, page);
    allIds.push(...result.ids);
    totalPages = result.totalPages;
    page++;
    if (page <= totalPages) await sleep(1000);
  } while (page <= totalPages);

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const conversationId of allIds) {
    try {
      const draft = await generateArticleDraft(conversationId);
      const result = await saveArticleToDB(draft, {
        conversationId,
        uploadedBy: "cron:knowledge-sync",
      });
      if (result.skipped) skipped++;
      else processed++;
    } catch (err) {
      errors++;
      console.error(`[knowledge-cron] Error en ${conversationId}:`, err);
    }
    await sleep(500);
  }

  console.log(`[knowledge-cron] Completado — procesados: ${processed}, omitidos: ${skipped}, errores: ${errors}`);

  return NextResponse.json({ processed, skipped, errors, total: allIds.length });
}
```

- [ ] **Paso 2: Lint**

```bash
npm run lint -- --file src/app/api/cron/knowledge-sync/route.ts 2>&1 | grep "error" | head -5
```

- [ ] **Paso 3: Commit**

```bash
git add src/app/api/cron/knowledge-sync/route.ts
git commit -m "feat(api): add GET /api/cron/knowledge-sync with CRON_SECRET auth"
```

---

## Task 13: Script standalone del cron

**Files:**
- Create: `scripts/cron-knowledge.mjs`

- [ ] **Paso 1: Instalar node-cron**

```bash
cd D:/Soporte/dashboard
npm install --save-dev node-cron @types/node-cron dotenv
```

Verificar que aparece en `devDependencies` en `package.json`.

- [ ] **Paso 2: Crear el script**

```javascript
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
```

- [ ] **Paso 3: Agregar CRON_SECRET a .env y .env.example**

En `.env` (no subir al repo):
```
CRON_SECRET=genera-un-token-secreto-aqui
APP_URL=http://localhost:3000
```

- [ ] **Paso 4: Documentar en CLAUDE.md**

Agregar en la sección de comandos de CLAUDE.md:

```markdown
## Variables de entorno adicionales

- `CRON_SECRET` — Token secreto para el endpoint `/api/cron/knowledge-sync`
- `APP_URL` — URL base de la app (default: http://localhost:3000), usada por el cron script

## Cron nocturno (KB sync)

```bash
node scripts/cron-knowledge.mjs   # Iniciar como proceso separado
```
```

- [ ] **Paso 5: Agregar cron-knowledge.mjs al .gitignore si tiene secrets inline**

El script no tiene secrets inline (lee de .env), así que no es necesario ignorarlo.

- [ ] **Paso 6: Lint y verificación manual del endpoint**

```bash
# Con el servidor corriendo, probar el endpoint
curl -H "Authorization: Bearer TU_CRON_SECRET" http://localhost:3000/api/cron/knowledge-sync
# Esperado: { "processed": N, "skipped": M, "errors": K, "total": T }
```

- [ ] **Paso 7: Commit final**

```bash
git add scripts/cron-knowledge.mjs package.json package-lock.json CLAUDE.md
git commit -m "feat(cron): add standalone knowledge sync cron script + node-cron"
```

---

## Verificación E2E Final

- [ ] **Flujo manual desde el chat**
  1. Abrir `/chat` y seleccionar cualquier conversación
  2. Clic en el ícono 📚 en el header
  3. Esperar que el modal cargue el borrador
  4. Verificar que los campos están prellenados (título, problema, solución, categoría)
  5. Guardar y confirmar que aparece en `/knowledge`
  6. Abrir el mismo ticket y volver a hacer clic en 📚 → debe mostrar "ya estaba en la KB"

- [ ] **Batch manual desde /knowledge**
  1. Abrir `/knowledge`
  2. Clic en "Importar tickets"
  3. Seleccionar rango de fechas de los últimos 7 días
  4. Clic en "Importar" y observar barra de progreso en tiempo real
  5. Confirmar que al terminar los tickets aparecen en `/knowledge`

- [ ] **Cron endpoint manualmente**
  ```bash
  curl -H "Authorization: Bearer TU_SECRET" http://localhost:3000/api/cron/knowledge-sync
  ```

- [ ] **Verificar que la IA usa los nuevos artículos**
  1. Abrir el chat con un ticket similar a uno importado
  2. Hacer clic en "Sugerir con IA"
  3. Confirmar que la respuesta hace referencia a la solución documentada
