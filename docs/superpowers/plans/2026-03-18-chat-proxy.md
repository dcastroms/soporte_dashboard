# Chat Proxy (Sistema B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full inbox-style chat interface inside the dashboard that lets support agents read and reply to Intercom conversations without logging into Intercom directly.

**Architecture:** A `/chat` page with a 3-column layout (conversation list → message thread → client context). Three new API routes proxy all Intercom operations server-side (list, detail, reply). Real-time updates reuse the existing SSE registry. No new npm packages needed.

**Tech Stack:** Next.js 16.1.1 App Router, React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Intercom REST API v2.11, existing SSE via `sseRegistry.ts`.

---

## Prerequisites

- `INTERCOM_TOKEN` env var must be set (already used by `intercom.ts`)
- `INTERCOM_ADMIN_ID` env var must be added — the numeric Intercom admin ID used to send replies
  - Find it: call `GET https://api.intercom.io/me` with your token, or check your Intercom profile URL (`/admins/{id}`)

---

## Important Codebase Notes

- **`src/lib/intercom.ts` has `"use server"` at the top.** Functions there are Server Actions. Calling them from API route handlers (server → server) works fine, but they must never be imported directly in client components.
- **Dynamic route `params` are Promises in Next.js 16.** Always type as `Promise<{id: string}>` and `await params`. See existing pattern in `src/app/clients/[client]/page.tsx:8-13`.
- **`useLiveEvents` takes an options object** `{ onNewTicket, onVipTicket, onCalendarEvent, showToasts }` — not a callback function. The `ticket_updated` event fires as `CustomEvent("live:ticket_updated")` on `window`, not via a named callback.

---

## File Map

### New files
| File | Responsibility |
|------|---------------|
| `src/types/chat.ts` | Shared TypeScript interfaces |
| `src/app/api/chat/conversations/route.ts` | GET: list open conversations |
| `src/app/api/chat/conversations/[id]/route.ts` | GET: full conversation + messages |
| `src/app/api/chat/conversations/[id]/reply/route.ts` | POST: send reply via Intercom API |
| `src/app/chat/page.tsx` | `/chat` page — server component shell |
| `src/app/chat/ChatShell.tsx` | Client component — 3-column layout controller |
| `src/components/chat/ConversationList.tsx` | Left column — scrollable list |
| `src/components/chat/ConversationListItem.tsx` | Single row in the list |
| `src/components/chat/ConversationThread.tsx` | Middle column — message history |
| `src/components/chat/ReplyBox.tsx` | Bottom of thread — textarea + send |
| `src/components/chat/ConversationContext.tsx` | Right column — client info, VIP, tags |

### Modified files
| File | Change |
|------|--------|
| `src/lib/intercom.ts` | Add `getConversationDetail(id)` function |
| `src/components/layout/Sidebar.tsx` | Add "Chat Proxy" nav item |

---

## Task 1: Add `INTERCOM_ADMIN_ID` and shared types

**Files:**
- Create: `src/types/chat.ts`

- [ ] **Step 1: Create `src/types/chat.ts`**

```typescript
export interface ChatConversation {
  id: string;
  subject: string;
  assignee: string;
  client: string | null;
  tags: string[];
  isVip: boolean;
  priority: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  url: string;
}

export interface ChatMessage {
  id: string;
  author: string;
  authorType: "user" | "admin" | "bot";
  body: string; // HTML string from Intercom
  createdAt: string;
}

export interface ChatConversationDetail extends ChatConversation {
  messages: ChatMessage[];
}
```

- [ ] **Step 2: Add env var**

Add to `.env.local`:
```
INTERCOM_ADMIN_ID=<your_admin_id_here>
```

- [ ] **Step 3: Lint**

```bash
npm run lint
```
Expected: no new errors

- [ ] **Step 4: Commit**

```bash
git add src/types/chat.ts
git commit -m "feat(chat): add shared TypeScript types for Chat Proxy"
```

---

## Task 2: `getConversationDetail` in intercom.ts

**Files:**
- Modify: `src/lib/intercom.ts`

> Note: `src/lib/intercom.ts` starts with `"use server"`. Adding `getConversationDetail` here is valid — it will only be called from API routes (server → server), never directly from client components.

- [ ] **Step 1: Append `getConversationDetail` at the end of `src/lib/intercom.ts`**

```typescript
export async function getConversationDetail(id: string): Promise<import("@/types/chat").ChatConversationDetail | null> {
  if (!INTERCOM_TOKEN) return null;

  try {
    const resp = await fetch(`${INTERCOM_API_URL}/conversations/${id}`, {
      headers: HEADERS,
    });
    if (!resp.ok) return null;
    const c = await resp.json();

    // Subject
    let subject = (c.source?.subject || "").replace(/<[^>]*>?/gm, "").trim();
    if (!subject) {
      const author = c.source?.author;
      const snippet = (c.source?.body || "").replace(/<[^>]*>?/gm, "").substring(0, 50);
      subject = snippet ? `${author?.name || "Usuario"}: ${snippet}...` : `Ticket de ${author?.name || "Usuario"}`;
    }

    // Admins map
    let adminMap: Record<string, string> = {};
    try {
      const adminsResp = await fetch(`${INTERCOM_API_URL}/admins`, { headers: HEADERS });
      if (adminsResp.ok) {
        const adminsData = await adminsResp.json();
        (adminsData.admins || []).forEach((a: any) => {
          adminMap[a.id] = a.name || a.email;
        });
      }
    } catch {}

    const attrs = c.custom_attributes || {};
    const client = attrs["Clientes"] || attrs["Client"] || attrs["Cliente"] || null;
    const tags: string[] = (c.tags?.tags || []).map((t: any) => t.name as string);
    const isVip =
      tags.some((t) => ["vip", "enterprise", "priority", "VIP", "Enterprise"].includes(t)) ||
      c.priority === "priority";

    // Build message list from source + conversation_parts
    const messages: import("@/types/chat").ChatMessage[] = [];

    if (c.source) {
      messages.push({
        id: c.source.id || "source",
        author: c.source.author?.name || c.source.author?.email || "Usuario",
        authorType: c.source.author?.type === "admin" ? "admin" : "user",
        body: c.source.body || "",
        createdAt: c.created_at ? new Date(c.created_at * 1000).toISOString() : "",
      });
    }

    const parts: any[] = c.conversation_parts?.conversation_parts || [];
    for (const part of parts) {
      if (!part.body || part.part_type === "close" || part.part_type === "open") continue;
      messages.push({
        id: part.id,
        author: part.author?.name || part.author?.email || "Sistema",
        authorType:
          part.author?.type === "admin" ? "admin" : part.author?.type === "bot" ? "bot" : "user",
        body: part.body,
        createdAt: part.created_at ? new Date(part.created_at * 1000).toISOString() : "",
      });
    }

    return {
      id: c.id,
      subject,
      assignee: c.admin_assignee_id
        ? adminMap[c.admin_assignee_id] || "Agente Desconocido"
        : "Sin asignar",
      client,
      tags,
      isVip,
      priority: c.priority || null,
      createdAt: c.created_at ? new Date(c.created_at * 1000).toISOString() : null,
      updatedAt: c.updated_at ? new Date(c.updated_at * 1000).toISOString() : null,
      url: `https://app.intercom.com/a/inbox/here/inbox/conversation/${c.id}`,
      messages,
    };
  } catch (error) {
    console.error("Error fetching conversation detail", error);
    return null;
  }
}
```

- [ ] **Step 2: Lint**

```bash
npm run lint
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/intercom.ts
git commit -m "feat(chat): add getConversationDetail to intercom.ts"
```

---

## Task 3: API route — GET /api/chat/conversations

**Files:**
- Create: `src/app/api/chat/conversations/route.ts`

- [ ] **Step 1: Create the route**

```typescript
import { NextResponse } from "next/server";
import { getAllOpenConversations } from "@/lib/intercom";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const conversations = await getAllOpenConversations();
  return NextResponse.json(conversations);
}
```

- [ ] **Step 2: Lint**

```bash
npm run lint
```

- [ ] **Step 3: Test manually**

Start dev server: `npm run dev`
Open: `http://localhost:3000/api/chat/conversations`
Expected: JSON array (or mock objects when no INTERCOM_TOKEN)

- [ ] **Step 4: Commit**

```bash
git add src/app/api/chat/conversations/route.ts
git commit -m "feat(chat): add GET /api/chat/conversations route"
```

---

## Task 4: API routes — GET /api/chat/conversations/[id] and POST reply

**Files:**
- Create: `src/app/api/chat/conversations/[id]/route.ts`
- Create: `src/app/api/chat/conversations/[id]/reply/route.ts`

> **Next.js 16 pattern**: `params` is a `Promise`. See `src/app/clients/[client]/page.tsx` for the existing pattern.

- [ ] **Step 1: Create `src/app/api/chat/conversations/[id]/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { getConversationDetail } from "@/lib/intercom";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const detail = await getConversationDetail(id);
  if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(detail);
}
```

- [ ] **Step 2: Create `src/app/api/chat/conversations/[id]/reply/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const INTERCOM_TOKEN = process.env.INTERCOM_TOKEN;
const INTERCOM_ADMIN_ID = process.env.INTERCOM_ADMIN_ID;
const INTERCOM_API_URL = "https://api.intercom.io";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!INTERCOM_TOKEN || !INTERCOM_ADMIN_ID) {
    return NextResponse.json({ error: "Intercom not configured" }, { status: 503 });
  }

  const { id } = await params;
  const { body } = await req.json();

  if (!body || typeof body !== "string" || !body.trim()) {
    return NextResponse.json({ error: "Empty message" }, { status: 400 });
  }

  const resp = await fetch(`${INTERCOM_API_URL}/conversations/${id}/reply`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${INTERCOM_TOKEN}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "Intercom-Version": "2.11",
    },
    body: JSON.stringify({
      type: "admin",
      admin_id: INTERCOM_ADMIN_ID,
      message_type: "comment",
      body: body.trim(),
    }),
  });

  if (!resp.ok) {
    const error = await resp.text();
    console.error("Intercom reply error:", error);
    return NextResponse.json({ error: "Failed to send reply" }, { status: 502 });
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Lint**

```bash
npm run lint
```
Expected: no errors

- [ ] **Step 4: Test manually**

Open `http://localhost:3000/api/chat/conversations/<real_id>` (use an ID from the conversations list)
Expected: JSON with `messages` array

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/chat/conversations/[id]/route.ts" "src/app/api/chat/conversations/[id]/reply/route.ts"
git commit -m "feat(chat): add conversation detail and reply API routes"
```

---

## Task 5: ConversationListItem and ConversationList

**Files:**
- Create: `src/components/chat/ConversationListItem.tsx`
- Create: `src/components/chat/ConversationList.tsx`

- [ ] **Step 1: Create `src/components/chat/ConversationListItem.tsx`**

```typescript
"use client";

import { ChatConversation } from "@/types/chat";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Star } from "lucide-react";

interface Props {
  conversation: ChatConversation;
  isSelected: boolean;
  onClick: () => void;
}

export function ConversationListItem({ conversation, isSelected, onClick }: Props) {
  const timeAgo = conversation.updatedAt
    ? formatDistanceToNow(new Date(conversation.updatedAt), { addSuffix: true, locale: es })
    : null;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-3 py-3 border-b border-border/40 hover:bg-accent/50 transition-colors",
        isSelected && "bg-accent border-l-2 border-l-primary"
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="text-[12px] font-semibold text-foreground line-clamp-2 flex-1 leading-tight">
          {conversation.subject}
        </span>
        {conversation.isVip && (
          <Star size={11} className="text-yellow-500 fill-yellow-500 shrink-0 mt-0.5" />
        )}
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {conversation.client && (
          <span className="text-[10px] text-primary font-medium truncate max-w-[100px]">
            {conversation.client}
          </span>
        )}
        <span className="text-[10px] text-muted-foreground">·</span>
        <span className="text-[10px] text-muted-foreground truncate">{conversation.assignee}</span>
        {timeAgo && (
          <>
            <span className="text-[10px] text-muted-foreground">·</span>
            <span className="text-[10px] text-muted-foreground">{timeAgo}</span>
          </>
        )}
      </div>
    </button>
  );
}
```

- [ ] **Step 2: Create `src/components/chat/ConversationList.tsx`**

```typescript
"use client";

import { ChatConversation } from "@/types/chat";
import { ConversationListItem } from "./ConversationListItem";
import { Inbox } from "lucide-react";

interface Props {
  conversations: ChatConversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ConversationList({ conversations, selectedId, onSelect }: Props) {
  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground p-6">
        <Inbox size={32} className="opacity-30" />
        <p className="text-sm text-center">No hay conversaciones abiertas</p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full">
      {conversations.map((conv) => (
        <ConversationListItem
          key={conv.id}
          conversation={conv}
          isSelected={selectedId === conv.id}
          onClick={() => onSelect(conv.id)}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Lint**

```bash
npm run lint
```

- [ ] **Step 4: Commit**

```bash
git add src/components/chat/ConversationListItem.tsx src/components/chat/ConversationList.tsx
git commit -m "feat(chat): add ConversationList and ConversationListItem"
```

---

## Task 6: ConversationThread + ReplyBox

**Files:**
- Create: `src/components/chat/ReplyBox.tsx`
- Create: `src/components/chat/ConversationThread.tsx`

> **Security note**: `ConversationThread` renders Intercom HTML via `dangerouslySetInnerHTML`. Intercom message bodies include both admin-authored and user-authored content. This is an internal dashboard (authenticated, @mediastre.am only), so XSS risk is scoped to the team's own Intercom workspace. This is acceptable for now but should be revisited if the app ever widens its user base.

- [ ] **Step 1: Create `src/components/chat/ReplyBox.tsx`**

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  conversationId: string;
  onReplySent: () => void;
}

export function ReplyBox({ conversationId, onReplySent }: Props) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSend() {
    if (!body.trim()) return;
    setSending(true);
    try {
      const resp = await fetch(`/api/chat/conversations/${conversationId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (!resp.ok) throw new Error("Error al enviar");
      setBody("");
      toast.success("Respuesta enviada");
      onReplySent();
    } catch {
      toast.error("No se pudo enviar la respuesta");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="border-t border-border p-3 space-y-2 bg-background shrink-0">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Escribe una respuesta..."
        rows={3}
        className="resize-none text-sm"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handleSend();
          }
        }}
      />
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground">Ctrl+Enter para enviar</p>
        <Button size="sm" onClick={handleSend} disabled={sending || !body.trim()}>
          {sending ? (
            <Loader2 size={14} className="animate-spin mr-1" />
          ) : (
            <Send size={14} className="mr-1" />
          )}
          Enviar
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/chat/ConversationThread.tsx`**

```typescript
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ChatConversationDetail } from "@/types/chat";
import { ReplyBox } from "./ReplyBox";
import { Loader2, MessageSquare, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Props {
  conversationId: string | null;
}

export function ConversationThread({ conversationId }: Props) {
  const [detail, setDetail] = useState<ChatConversationDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchDetail = useCallback(async () => {
    if (!conversationId) return;
    setLoading(true);
    try {
      const resp = await fetch(`/api/chat/conversations/${conversationId}`);
      if (resp.ok) setDetail(await resp.json());
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    setDetail(null);
    fetchDetail();
  }, [fetchDetail]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [detail?.messages.length]);

  if (!conversationId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <MessageSquare size={40} className="opacity-20" />
        <p className="text-sm">Selecciona una conversación</p>
      </div>
    );
  }

  if (loading && !detail) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      {detail && (
        <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
          <div>
            <p className="text-[13px] font-semibold text-foreground line-clamp-1">{detail.subject}</p>
            <p className="text-[10px] text-muted-foreground">Asignado a: {detail.assignee}</p>
          </div>
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
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {detail?.messages.map((msg) => {
          const isAdmin = msg.authorType === "admin";
          return (
            <div key={msg.id} className={cn("flex", isAdmin ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[75%] rounded-lg px-3 py-2 text-[12px] leading-relaxed",
                  isAdmin
                    ? "bg-primary/15 text-foreground border border-primary/20"
                    : "bg-accent text-foreground"
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-[10px]">{msg.author}</span>
                  {msg.createdAt && (
                    <span className="text-[9px] text-muted-foreground">
                      {format(new Date(msg.createdAt), "d MMM, HH:mm", { locale: es })}
                    </span>
                  )}
                </div>
                {/* Intercom HTML — trusted, internal-only dashboard */}
                <div
                  className="prose prose-sm max-w-none [&_p]:mb-1 [&_p:last-child]:mb-0"
                  dangerouslySetInnerHTML={{ __html: msg.body }}
                />
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Reply */}
      {detail && conversationId && (
        <ReplyBox conversationId={conversationId} onReplySent={fetchDetail} />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Lint**

```bash
npm run lint
```

- [ ] **Step 4: Commit**

```bash
git add src/components/chat/ReplyBox.tsx src/components/chat/ConversationThread.tsx
git commit -m "feat(chat): add ConversationThread and ReplyBox"
```

---

## Task 7: ConversationContext component

**Files:**
- Create: `src/components/chat/ConversationContext.tsx`

- [ ] **Step 1: Create `src/components/chat/ConversationContext.tsx`**

```typescript
"use client";

import { ChatConversation } from "@/types/chat";
import { Star, User, Tag, Clock, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Props {
  conversation: ChatConversation | null;
}

export function ConversationContext({ conversation }: Props) {
  if (!conversation) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground p-4">
        <p className="text-xs text-center">Selecciona una conversación para ver el contexto</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-5 overflow-y-auto h-full text-[12px]">
      {/* VIP Badge */}
      {conversation.isVip && (
        <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/25 rounded-lg px-3 py-2">
          <Star size={13} className="text-yellow-500 fill-yellow-500" />
          <span className="font-semibold text-yellow-600 dark:text-yellow-400">
            Cliente VIP / Prioritario
          </span>
        </div>
      )}

      {/* Client */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          Cliente
        </p>
        <div className="flex items-center gap-2">
          <User size={13} className="text-muted-foreground shrink-0" />
          <span className="font-medium">{conversation.client || "Desconocido"}</span>
        </div>
      </div>

      {/* Assignee */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          Asignado a
        </p>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
            <span className="text-[8px] font-black text-primary">
              {conversation.assignee.charAt(0)}
            </span>
          </div>
          <span className="font-medium">{conversation.assignee}</span>
        </div>
      </div>

      {/* Tags */}
      {conversation.tags.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Etiquetas
          </p>
          <div className="flex flex-wrap gap-1">
            {conversation.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[9px] px-1.5 py-0">
                <Tag size={8} className="mr-1" />
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Dates */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          Fechas
        </p>
        <div className="space-y-1">
          {conversation.createdAt && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock size={11} className="shrink-0" />
              <span>
                Creado:{" "}
                {format(new Date(conversation.createdAt), "d MMM yyyy, HH:mm", { locale: es })}
              </span>
            </div>
          )}
          {conversation.updatedAt && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock size={11} className="shrink-0" />
              <span>
                Actualizado:{" "}
                {format(new Date(conversation.updatedAt), "d MMM yyyy, HH:mm", { locale: es })}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Link to Intercom */}
      <div>
        <a
          href={conversation.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors text-[11px]"
        >
          <ExternalLink size={11} />
          Ver en Intercom
        </a>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Lint**

```bash
npm run lint
```

- [ ] **Step 3: Commit**

```bash
git add src/components/chat/ConversationContext.tsx
git commit -m "feat(chat): add ConversationContext panel"
```

---

## Task 8: ChatShell (3-column layout controller)

**Files:**
- Create: `src/app/chat/ChatShell.tsx`

> **`useLiveEvents` signature**: takes `{ onNewTicket, showToasts }` — NOT a callback function. For `ticket_updated` events, listen on `window` via `CustomEvent("live:ticket_updated")`.

- [ ] **Step 1: Create `src/app/chat/ChatShell.tsx`**

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import { ChatConversation } from "@/types/chat";
import { ConversationList } from "@/components/chat/ConversationList";
import { ConversationThread } from "@/components/chat/ConversationThread";
import { ConversationContext } from "@/components/chat/ConversationContext";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLiveEvents } from "@/hooks/useLiveEvents";

export function ChatShell() {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const selectedConversation = conversations.find((c) => c.id === selectedId) ?? null;

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch("/api/chat/conversations");
      if (resp.ok) setConversations(await resp.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Refresh list on new ticket via SSE
  useLiveEvents({
    onNewTicket: () => fetchConversations(),
    showToasts: false,
  });

  // Refresh list on ticket_updated (dispatched as CustomEvent on window)
  useEffect(() => {
    const handler = () => fetchConversations();
    window.addEventListener("live:ticket_updated", handler);
    return () => window.removeEventListener("live:ticket_updated", handler);
  }, [fetchConversations]);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: Conversation List */}
      <div className="w-72 shrink-0 border-r border-border flex flex-col">
        <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-[13px] font-bold">Conversaciones</h2>
            {!loading && (
              <p className="text-[10px] text-muted-foreground">{conversations.length} abiertas</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={fetchConversations}
            title="Actualizar"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </Button>
        </div>
        {loading && conversations.length === 0 ? (
          <div className="flex items-center justify-center flex-1">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ConversationList
            conversations={conversations}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        )}
      </div>

      {/* Middle: Thread */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-border">
        <ConversationThread conversationId={selectedId} />
      </div>

      {/* Right: Context — only on xl screens */}
      <div className="w-64 shrink-0 hidden xl:flex flex-col">
        <div className="px-3 py-2.5 border-b border-border">
          <h2 className="text-[13px] font-bold">Contexto</h2>
        </div>
        <ConversationContext conversation={selectedConversation} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Lint**

```bash
npm run lint
```

- [ ] **Step 3: Commit**

```bash
git add src/app/chat/ChatShell.tsx
git commit -m "feat(chat): add ChatShell 3-column layout controller"
```

---

## Task 9: /chat page

**Files:**
- Create: `src/app/chat/page.tsx`

- [ ] **Step 1: Create `src/app/chat/page.tsx`**

```typescript
import { ChatShell } from "./ChatShell";

export const metadata = {
  title: "Chat Proxy | Soporte 360",
};

export default function ChatPage() {
  return (
    <div className="h-[calc(100vh-4rem)] overflow-hidden">
      <ChatShell />
    </div>
  );
}
```

- [ ] **Step 2: Lint**

```bash
npm run lint
```

- [ ] **Step 3: Test in browser**

Navigate to `http://localhost:3000/chat`
Expected: 3-column layout renders, conversation list loads

- [ ] **Step 4: Commit**

```bash
git add src/app/chat/page.tsx
git commit -m "feat(chat): add /chat page"
```

---

## Task 10: Add Chat Proxy to Sidebar

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Add `MessageSquare` to the lucide-react import in `Sidebar.tsx`**

Current import line starts with `import { LayoutDashboard, Map, ...`. Add `MessageSquare` to the list.

- [ ] **Step 2: Add nav item to `menuItems` array (after Dashboard)**

```typescript
{ icon: MessageSquare, label: 'Chat Proxy', href: '/chat' },
```

- [ ] **Step 3: Lint**

```bash
npm run lint
```

- [ ] **Step 4: Verify in browser**

Expected: "Chat Proxy" link appears in sidebar, clicking navigates to `/chat`, active indicator highlights correctly

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat(chat): add Chat Proxy to Sidebar navigation"
```

---

## Task 11: Full build verification

- [ ] **Step 1: Run full build**

```bash
npm run build
```
Expected: Build succeeds with no TypeScript errors. Dynamic route warnings are acceptable.

- [ ] **Step 2: Smoke test checklist**

Navigate to `http://localhost:3000/chat` and verify:
- [ ] Conversation list loads (or shows empty state)
- [ ] Clicking a conversation loads its message thread
- [ ] Messages are displayed in chat-bubble style (user left, admin right)
- [ ] Reply box is at the bottom; Ctrl+Enter sends
- [ ] Sending a reply with no `INTERCOM_ADMIN_ID` shows toast "No se pudo enviar la respuesta"
- [ ] VIP conversations show a star icon in the list
- [ ] Context panel shows client name, assignee, tags on xl screens
- [ ] "Ver en Intercom" link opens the correct Intercom URL
- [ ] Refresh button reloads the list
- [ ] "Chat Proxy" is highlighted in sidebar when on `/chat`

- [ ] **Step 3: Final commit**

```bash
git add docs/superpowers/plans/2026-03-18-chat-proxy.md
git commit -m "feat(chat): Sistema B complete — Chat Proxy operational"
```

---

## Known Limitations / Future Work

- **Pagination**: Fetches only 20 most recent open conversations. Future: load more button.
- **Context panel on mobile/tablet**: Hidden below `xl`. Future: bottom sheet or tab toggle.
- **Who's viewing**: The `assignee` field shows which Intercom admin owns the conversation. A presence indicator showing which *dashboard* user currently has a convo open would need a lightweight shared store — deferred to Wave 5.
- **HTML sanitization**: Intercom message bodies rendered via `dangerouslySetInnerHTML`. XSS risk is scoped to the team's own workspace. If the app ever widens its audience, add DOMPurify.
- **Admin map caching**: Each `getConversationDetail` call fetches `/admins`. A short-lived in-memory cache would reduce Intercom API calls.
