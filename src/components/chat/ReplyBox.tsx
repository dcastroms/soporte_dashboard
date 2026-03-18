"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, MessageCircle, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type MessageType = "comment" | "note";

interface Props {
  conversationId: string;
  onReplySent: () => void;
}

export function ReplyBox({ conversationId, onReplySent }: Props) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [messageType, setMessageType] = useState<MessageType>("comment");

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

  return (
    <div className={cn("border-t p-3 space-y-2 shrink-0 transition-colors", isNote ? "border-amber-500/30 bg-amber-500/5" : "border-border bg-background")}>
      {/* Toggle */}
      <div className="flex gap-1">
        <button
          onClick={() => setMessageType("comment")}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors",
            !isNote ? "bg-primary/15 text-primary border border-primary/25" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <MessageCircle size={11} />
          Respuesta
        </button>
        <button
          onClick={() => setMessageType("note")}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors",
            isNote ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <StickyNote size={11} />
          Nota interna
        </button>
      </div>

      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={isNote ? "Nota visible solo para el equipo..." : "Escribe una respuesta al cliente..."}
        rows={3}
        className={cn("resize-none text-sm transition-colors", isNote && "border-amber-500/30 focus-visible:ring-amber-500/30")}
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
