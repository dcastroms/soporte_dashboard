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
