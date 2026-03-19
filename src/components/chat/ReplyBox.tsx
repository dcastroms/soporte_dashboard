"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, MessageCircle, StickyNote, Sparkles, ThumbsUp, ThumbsDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ChatMessage } from "@/types/chat";

type MessageType = "comment" | "note";

interface Props {
  conversationId: string;
  messages: ChatMessage[];
  onReplySent: () => void;
}

export function ReplyBox({ conversationId, messages, onReplySent }: Props) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [messageType, setMessageType] = useState<MessageType>("comment");
  const [lastLogId, setLastLogId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);

  const isNote = messageType === "note";

  async function handleSend() {
    if (!body.trim()) return;
    setSending(true);
    try {
      const resp = await fetch(`/api/chat/conversations/${conversationId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, messageType }),
      });
      if (!resp.ok) throw new Error("Error al enviar");
      setBody("");
      toast.success(isNote ? "Nota interna guardada" : "Respuesta enviada");
      onReplySent();
    } catch {
      toast.error("No se pudo enviar");
    } finally {
      setSending(false);
    }
  }

  function stripMarkdown(text: string): string {
    return text
      .replace(/```[\w]*\n?([\s\S]*?)```/g, "$1")  // ```lang\ncode``` → code
      .replace(/`([^`]+)`/g, "$1")                  // `inline code` → text
      .replace(/\*\*(.*?)\*\*/g, "$1")              // **bold** → bold
      .replace(/\*(.*?)\*/g, "$1")                  // *italic* → italic
      .replace(/^#{1,6}\s+/gm, "")                  // ## headings → plain
      .replace(/^\s*[-*]\s+/gm, "• ")               // - list → bullet
      .replace(/\n{3,}/g, "\n\n")                   // 3+ blank lines → 2
      .trim();
  }

  async function handleFeedback(accepted: boolean) {
    if (!lastLogId) return;
    const type = accepted ? "up" : "down";
    setFeedback(type);
    await fetch("/api/ai/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logId: lastLogId, accepted }),
    }).catch(() => null);
  }

  async function handleSuggest() {
    if (messages.length === 0) return;
    setSuggesting(true);
    try {
      // Convert chat messages to the format the AI endpoint expects
      const history = messages
        .filter((m) => !m.isNote && m.body)
        .map((m) => ({
          role: m.authorType === "admin" ? ("assistant" as const) : ("user" as const),
          content: m.body.replace(/<[^>]*>?/gm, "").trim(),
        }));

      const resp = await fetch("/api/ai/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, conversationId }),
      });

      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || "Error del proveedor IA");
      }

      const data = await resp.json();
      setBody(stripMarkdown(data.suggestion || ""));
      setMessageType("comment");
      setLastLogId(data.logId ?? null);
      setFeedback(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo generar sugerencia");
    } finally {
      setSuggesting(false);
    }
  }

  return (
    <div
      className={cn(
        "border-t p-3 space-y-2 shrink-0 transition-colors",
        isNote ? "border-amber-500/30 bg-amber-500/5" : "border-border bg-background"
      )}
    >
      {/* Toggle + AI suggest button */}
      <div className="flex items-center justify-between gap-1">
        <div className="flex gap-1">
          <button
            onClick={() => setMessageType("comment")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors",
              !isNote
                ? "bg-primary/15 text-primary border border-primary/25"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <MessageCircle size={11} />
            Respuesta
          </button>
          <button
            onClick={() => setMessageType("note")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors",
              isNote
                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <StickyNote size={11} />
            Nota interna
          </button>
        </div>

        {/* Feedback buttons — appear after a suggestion is generated */}
        {lastLogId && (
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => handleFeedback(true)}
              title="Buena sugerencia"
              className={cn(
                "p-1 rounded-md transition-colors",
                feedback === "up"
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-primary"
              )}
            >
              <ThumbsUp size={11} />
            </button>
            <button
              onClick={() => handleFeedback(false)}
              title="Mala sugerencia"
              className={cn(
                "p-1 rounded-md transition-colors",
                feedback === "down"
                  ? "text-destructive bg-destructive/10"
                  : "text-muted-foreground hover:text-destructive"
              )}
            >
              <ThumbsDown size={11} />
            </button>
          </div>
        )}

        {/* A.4: AI suggest button */}
        <button
          onClick={handleSuggest}
          disabled={suggesting || messages.length === 0}
          title="Generar sugerencia con IA"
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors",
            "text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed",
            suggesting && "text-primary"
          )}
        >
          {suggesting ? (
            <Loader2 size={11} className="animate-spin" />
          ) : (
            <Sparkles size={11} />
          )}
          {suggesting ? "Pensando..." : "Sugerir IA"}
        </button>
      </div>

      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={
          isNote ? "Nota visible solo para el equipo..." : "Escribe una respuesta al cliente..."
        }
        rows={3}
        className={cn(
          "resize-none text-sm transition-colors max-h-52 overflow-y-auto",
          isNote && "border-amber-500/30 focus-visible:ring-amber-500/30"
        )}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handleSend();
          }
        }}
      />
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground">Ctrl+Enter para enviar</p>
        <Button
          size="sm"
          onClick={handleSend}
          disabled={sending || !body.trim()}
          className={cn(isNote && "bg-amber-500 hover:bg-amber-600 text-white")}
        >
          {sending ? (
            <Loader2 size={14} className="animate-spin mr-1" />
          ) : (
            <Send size={14} className="mr-1" />
          )}
          {isNote ? "Guardar nota" : "Enviar"}
        </Button>
      </div>
    </div>
  );
}
