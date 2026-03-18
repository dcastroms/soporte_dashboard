"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ChatConversationDetail } from "@/types/chat";
import { ReplyBox } from "./ReplyBox";
import {
  Loader2,
  MessageSquare,
  ExternalLink,
  Paperclip,
  Download,
  Mail,
  Eye,
  BookOpen,
} from "lucide-react";
import { KnowledgeFromTicketDialog } from "@/components/knowledge/KnowledgeFromTicketDialog";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Props {
  conversationId: string | null;
}

/** Ensures all <a> tags open in a new tab and images are clickable */
function processHtml(html: string): string {
  return html
    .replace(/<a\s/gi, '<a target="_blank" rel="noopener noreferrer" ')
    .replace(
      /<img\s/gi,
      '<img style="max-width:100%;height:auto;cursor:zoom-in;" onclick="window.open(this.src,\'_blank\')" '
    );
}

function formatBytes(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ConversationThread({ conversationId }: Props) {
  const [detail, setDetail] = useState<ChatConversationDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewers, setViewers] = useState<{ name: string; email: string }[]>([]);
  const [showKbDialog, setShowKbDialog] = useState(false);
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

  // B.9: Poll for presence (who else is viewing)
  useEffect(() => {
    if (!conversationId) return;
    const fetchPresence = async () => {
      try {
        const resp = await fetch(`/api/chat/presence?convId=${conversationId}`);
        if (resp.ok) {
          const data = await resp.json();
          setViewers(data.viewers ?? []);
        }
      } catch {}
    };
    fetchPresence();
    const interval = setInterval(fetchPresence, 30_000);
    return () => clearInterval(interval);
  }, [conversationId]);

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

  const isEmail = detail?.sourceType === "email";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      {detail && (
        <div className="px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              {isEmail && (
                <Mail size={13} className="shrink-0 text-muted-foreground" />
              )}
              <p className="text-[13px] font-semibold text-foreground line-clamp-1">
                {detail.subject}
              </p>
            </div>
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
          </div>
          <div className="flex items-center justify-between mt-0.5">
            <p className="text-[10px] text-muted-foreground">
              {isEmail ? "Correo · " : ""}Asignado a: {detail.assignee}
            </p>
            {/* B.9: Presence indicator */}
            {viewers.length > 0 && (
              <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                <Eye size={10} />
                <span>
                  {viewers.map((v) => v.name.split(" ")[0]).join(", ")} también{" "}
                  {viewers.length === 1 ? "ve" : "ven"} esto
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {detail?.messages.map((msg) => {
          const isAdmin = msg.authorType === "admin";
          const isNote = msg.isNote;
          return (
            <div
              key={msg.id}
              className={cn(
                "flex",
                isNote ? "justify-center" : isAdmin ? "justify-end" : "justify-start"
              )}
            >
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
                  {isNote && (
                    <span className="text-[9px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                      Nota interna
                    </span>
                  )}
                  <span className="font-semibold text-[10px]">{msg.author}</span>
                  {msg.createdAt && (
                    <span className="text-[9px] text-muted-foreground">
                      {format(new Date(msg.createdAt), "d MMM, HH:mm", { locale: es })}
                    </span>
                  )}
                </div>

                {/* B.17: Links get target="_blank" via processLinks */}
                {msg.body && (
                  <div
                    className="prose prose-sm max-w-none [&_p]:mb-1 [&_p:last-child]:mb-0 [&_a]:text-primary [&_a]:underline [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-md [&_img]:my-1 [&_img]:cursor-zoom-in [&_img]:block"
                    dangerouslySetInnerHTML={{ __html: processHtml(msg.body) }}
                  />
                )}

                {/* B.16: Attachments */}
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {msg.attachments.map((att, i) => (
                      <a
                        key={i}
                        href={att.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        download={att.name}
                        className={cn(
                          "flex items-center gap-2 px-2 py-1.5 rounded text-[10px] border transition-colors",
                          "bg-background/50 border-border hover:border-primary/50 hover:bg-primary/5"
                        )}
                      >
                        <Paperclip size={10} className="shrink-0 text-muted-foreground" />
                        <span className="truncate flex-1">{att.name}</span>
                        {att.fileSize && (
                          <span className="text-muted-foreground shrink-0">
                            {formatBytes(att.fileSize)}
                          </span>
                        )}
                        <Download size={10} className="shrink-0 text-muted-foreground" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Reply */}
      {detail && conversationId && (
        <ReplyBox
          conversationId={conversationId}
          messages={detail.messages}
          onReplySent={fetchDetail}
        />
      )}

      {showKbDialog && detail && (
        <KnowledgeFromTicketDialog
          conversationId={conversationId}
          open={showKbDialog}
          onClose={() => setShowKbDialog(false)}
        />
      )}
    </div>
  );
}
