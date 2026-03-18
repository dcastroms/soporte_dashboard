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

  // Re-fetch when a ticket_updated SSE event matches this conversation
  useEffect(() => {
    if (!conversationId) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ id: string }>).detail;
      if (detail?.id === conversationId) fetchDetail();
    };
    window.addEventListener("live:ticket_updated", handler);
    return () => window.removeEventListener("live:ticket_updated", handler);
  }, [conversationId, fetchDetail]);

  // Polling fallback: refresh every 15s while a conversation is open
  useEffect(() => {
    if (!conversationId) return;
    const interval = setInterval(fetchDetail, 15_000);
    return () => clearInterval(interval);
  }, [conversationId, fetchDetail]);

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
          const isNote = msg.isNote;
          return (
            <div key={msg.id} className={cn("flex", isNote ? "justify-center" : isAdmin ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "rounded-lg px-3 py-2 text-[12px] leading-relaxed",
                  isNote
                    ? "max-w-[90%] w-full bg-amber-500/10 border border-amber-500/25 text-foreground"
                    : isAdmin
                    ? "max-w-[75%] bg-primary/15 text-foreground border border-primary/20"
                    : "max-w-[75%] bg-accent text-foreground"
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  {isNote && <span className="text-[9px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">Nota interna</span>}
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
