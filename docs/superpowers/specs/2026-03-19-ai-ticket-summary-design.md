# AI Ticket Summary — Design Spec

**Date:** 2026-03-19
**Status:** Approved
**Project:** soporte_dashboard

---

## Overview

Add AI-generated ticket summaries in two views:
- **Auditoría** — manual trigger (button), short format focused on urgency and action
- **Chat** — automatic trigger on conversation open, full format with complete context

Reuses the existing AI provider abstraction (`aiProvider.ts`) calling `chat()` (the exported function), and follows the same auth/rate-limit pattern as `/api/ai/suggest/route.ts`.

---

## Architecture

### Endpoint

```
POST /api/ai/summary
Auth: NextAuth session required (getServerSession)
Rate limit: 10 requests/min per user — key: "ai:summary:{email}" (independent of suggest quota)
```

**Request:**
```typescript
{
  conversationId: string,  // intercomId value
  mode: "audit" | "chat"
}
```

**Response (audit):**
```typescript
{
  urgency: string,   // e.g. "Alta — 6h sin respuesta"
  problem: string,   // e.g. "Cliente sin acceso al módulo VOD"
  action: string     // e.g. "Escalar a nivel 2"
}
```

**Response (chat):**
```typescript
{
  problem: string,   // Descripción del problema
  context: string,   // Contexto del cliente y antecedentes
  attempts: string,  // Soluciones intentadas
  action: string     // Acción recomendada
}
```

### Data Sources

| Mode | Source | Detail |
|------|--------|--------|
| audit | DB only — `prisma.intercomConversation.findFirst({ where: { intercomId } })` | Fields: `subject, status, priority, client, module, ticketType, teammateName, updatedAt`; route computes `staleHours = Math.floor((Date.now() - updatedAt.getTime()) / 3_600_000)` before passing to prompt builder |
| chat | DB metadata + `getConversationDetail(conversationId)` from `src/lib/intercom.ts` | Last 15 messages (most recent) sliced from `messages` array (ordered oldest-first, so `slice(-15)`) |

### AI Stack

- Calls `chat(messages, { maxTokens: 300 })` for audit, `chat(messages, { maxTokens: 500 })` for chat
- `chat()` returns `Promise<AIResponse>` where `AIResponse = { text: string; model: string; provider: string }` — the parseable content is at `result.text`
- Function exported from `src/lib/aiProvider.ts` — no modifications needed
- Prompts in Spanish, model instructed to return valid JSON with the exact fields defined above
- Endpoint wraps `chat()` + `JSON.parse(result.text)` in a single try/catch — any AI or parse failure returns `{ error: "Respuesta inválida del modelo" }` with status 502

---

## New Files

### `src/app/api/ai/summary/route.ts`

Logic flow:
1. Validate session → 401 if missing
2. Parse and validate body (`conversationId`, `mode`) → 400 if missing
3. Apply rate limit: `import { checkRateLimit } from "@/lib/rateLimit"`, call `checkRateLimit(\`ai:summary:${session.user.email}\`, { maxRequests: 10, windowMs: 60_000 })` — returns `{ allowed, retryAfterMs }`. If `!allowed`, return 429. Uses the same shared utility as `suggest/route.ts` (in-memory Map, resets on restart, not shared across workers — acceptable at current scale)
4. Fetch DB record by `intercomId` → 404 if not found
5. Audit mode: compute `staleHours = Math.floor((Date.now() - record.updatedAt.getTime()) / 3_600_000)` (`updatedAt` is `DateTime` non-nullable in Prisma schema — no null-guard needed), build prompt from DB fields + staleHours, call `chat()` with `maxTokens: 300`
6. Chat mode:
   a. Call `getConversationDetail(conversationId)` from `src/lib/intercom.ts`
   b. If returns `null` (INTERCOM_TOKEN missing or conversation not found) → return 502 `{ error: "No se pudo obtener el historial de la conversación" }`
   c. Check `messages.length < 2` → return 200 `{ tooShort: true }` (client renders "Conversación muy corta para resumir"). Threshold `< 2` means: skip if only the initial source message exists with no replies yet — minimum meaningful conversation requires at least one reply.
   d. Slice last 15 messages: `messages.slice(-15)`
   e. Build prompt, call `chat()` with `maxTokens: 500`
7. Wrap both the `chat()` call and `JSON.parse(result.text)` in a single try/catch → 502 `{ error: "Respuesta inválida del modelo" }` on any AI or parse failure
8. Return parsed summary object

### `src/lib/summaryPrompt.ts`

```typescript
interface AuditTicketInput {
  subject: string | null;
  status: string | null;
  priority: string | null;
  client: string | null;
  module: string | null;
  ticketType: string | null;
  teammateName: string | null;
  staleHours: number;  // computed in route: Math.floor((Date.now() - updatedAt.getTime()) / 3_600_000)
}

interface ChatTicketInput {
  subject: string | null;
  status: string | null;
  priority: string | null;
  client: string | null;
  module: string | null;
  ticketType: string | null;
  teammateName: string | null;
}

// messages: Intercom ChatMessage[] from src/types/chat.ts — serialized to readable strings internally (strip HTML)
export function buildAuditSummaryMessages(ticket: AuditTicketInput): AIMessage[]
export function buildChatSummaryMessages(ticket: ChatTicketInput, messages: ChatMessage[]): AIMessage[]
```

Return type is `AIMessage[]` (the format expected by `chat()` from `aiProvider.ts`) — not to be confused with the Intercom `ChatMessage` type from `src/types/chat.ts`, which is the message type coming from `getConversationDetail()`.

`ChatTicketInput` uses DB record fields (not `ChatConversationDetail` metadata) intentionally: the DB record is already fetched in step 4 and contains all needed ticket metadata. `ChatConversationDetail` has additional fields (`assignee`, `tags`, `isVip`) but using DB data keeps the prompt consistent between modes. Do not add `ChatConversationDetail` metadata to the chat prompt.

`summaryPrompt.ts` is a plain module — do NOT add `"use server"` directive (it contains pure functions, no server actions).

The `ChatMessage.body` field contains HTML. `stripHtml` exists in `src/lib/intercom.ts` but that file is marked `"use server"` — it cannot be imported into non-action modules. Add `stripHtml` as an exported function in `src/lib/utils.ts` (copy the implementation from `intercom.ts` lines 7–17), then import it in `summaryPrompt.ts`. Also update `intercom.ts` to import and use the shared `stripHtml` from `utils.ts` instead of maintaining a private copy, so there is only one implementation. Both functions instruct the model to respond with JSON only (no markdown, no explanation).

---

## UI Components

### `src/components/dashboard/TicketSummaryPopover.tsx`

- Props: `{ conversationId: string }`
- Always calls the endpoint with `mode: "audit"` hardcoded internally — no `mode` prop needed (this component is only ever used in audit contexts)
- Renders a small button with `<Sparkles size={10} />` from lucide-react
- Positioned next to the `<ExternalLink>` anchor in each ticket row
- States: `idle` → `loading` (spinner replaces icon) → `open` (Popover with 3-field summary) → `error` (toast only, popover doesn't open)
- Error handling by `response.status`: 429 → toast "Límite de resúmenes alcanzado, intenta en un minuto"; all other non-OK responses → toast "No se pudo generar el resumen, intenta de nuevo"
- No cache — each click triggers a new fetch (audit tickets change frequently)

**Integration — `FocusAudit.tsx`:**
In the `tickets.map()` block, inside each ticket `<div>` row, the top-right container is:
```tsx
<div className="flex items-center gap-1 shrink-0">
  {t.priority ? <Badge ...>...</Badge> : null}
  <a href={t.intercomUrl} ...><ExternalLink size={10} /></a>
</div>
```
Add `<TicketSummaryPopover>` immediately before the `<a>` tag, passing `t.id` (`RedFlagTicket.id` holds the intercomId value):
```tsx
<TicketSummaryPopover conversationId={t.id} />
<a href={t.intercomUrl} ...><ExternalLink size={10} /></a>
```

**Integration — `ClientAuditView.tsx`:**
Add inside the `TicketRow` inner function component (defined at line ~78, receives `{ ticket: AuditTicket }`), immediately before the `<a>` ExternalLink anchor in the right-side flex container. Pass `ticket.intercomId`:
```tsx
<TicketSummaryPopover conversationId={ticket.intercomId} />
```

---

### `src/components/chat/ConversationSummary.tsx`

- Props: `{ conversationId: string }`
- Always calls the endpoint with `mode: "chat"` hardcoded internally — no `mode` prop needed (this component is only ever used in the chat view)
- Card colapsable, dark-mode compatible (`bg-card`, `border-border`, semantic tokens)
- Auto-fetches on mount (when conversation opens)
- Skeleton of 4 lines shown during loading — does not block message history
- Once loaded, result stored in local state — no re-fetch on collapse/expand
- `tooShort: true` response → renders `"Conversación muy corta para resumir"` inline (no toast)
- Error handling by `response.status` — inline in card (not toast):
  - 429 → "Demasiadas solicitudes, intenta en un minuto"
  - 404 → "Resumen no disponible (ticket no sincronizado aún)"
  - All other non-OK responses → "No se pudo generar el resumen"
- This is intentionally different from `TicketSummaryPopover` error handling (different surface types)

**Integration — `src/components/chat/ConversationThread.tsx`:**
Add `<ConversationSummary>` above the messages scroll container, below the thread header:
```tsx
// Inside ConversationThread, inside the outer <div className="flex flex-col h-full"> container,
// as a sibling element BETWEEN the {detail && (...)} header expression (ends line ~172)
// and the messages <div className="flex-1 overflow-y-auto p-4 space-y-3"> (line ~175):
{conversationId && <ConversationSummary key={conversationId} conversationId={conversationId} />}
```

This placement is a JSX sibling at the same nesting level as `{detail && (...)}` — not inside it. Note: `ConversationThread` has an early return at line ~113 that renders a full-height spinner while `loading && !detail` (the first fetch). During this initial load, `ConversationSummary` does not mount yet — it mounts once the spinner resolves and the main layout renders. This is acceptable: the summary fetch starts as soon as the conversation layout is visible, in parallel with any subsequent re-fetches. `key={conversationId}` forces React to remount on conversation switch, resetting local state and triggering a fresh fetch with skeleton.

---

## Error Handling

| Case | Where checked | Behavior |
|------|--------------|----------|
| Session missing | Server | 401 |
| Invalid body | Server | 400 |
| Rate limit exceeded | Server | 429 → toast "Límite de resúmenes alcanzado, intenta en un minuto" |
| DB conversation not found | Server | 404 → toast "No se pudo generar el resumen, intenta de nuevo" (audit) or inline error in `ConversationSummary` card (chat) |
| INTERCOM_TOKEN missing / API error (chat) | Server | 502 → inline error in `ConversationSummary` card |
| Conversation < 2 messages (chat) | Server | 200 `{ tooShort: true }` → inline text in card |
| Malformed AI JSON output / AI provider unavailable | Server | 502 → toast "No se pudo generar el resumen, intenta de nuevo" (audit) or inline error in `ConversationSummary` card (chat) — both caught by single try/catch wrapping `chat()` + `JSON.parse(result.text)`; returns static error string (unlike `suggest/route.ts` which surfaces raw error message) |
| Network error | Client | toast (audit) or inline error (chat) |

---

## Constraints

- Rate limit: `checkRateLimit` from `@/lib/rateLimit`, 10/min per user, key `ai:summary:{email}` (in-memory, resets on restart, not shared across workers — acceptable at current scale)
- Chat history: last 15 messages (`messages.slice(-15)`)
- Audit: no cache
- Chat: cache in React local state (no re-fetch on collapse/expand)
- Prompts in Spanish, JSON-only output
- `maxTokens`: 300 (audit), 500 (chat)

---

## Out of Scope

- Persisting summaries in DB
- Accept/reject feedback (unlike suggest)
- Summaries in other views (/reports, /clients)
- Translation to English/Portuguese
- Shared rate limit storage (Redis)
