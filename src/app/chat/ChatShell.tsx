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

  // B.15: Refresh list + show push notification on new ticket
  useLiveEvents({
    onNewTicket: (data) => {
      fetchConversations();
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("🎫 Nuevo ticket", {
          body: data?.subject || "Hay un nuevo ticket abierto",
          icon: "/favicon.ico",
        });
      }
    },
    showToasts: false,
    enablePush: true, // requests permission + handles VIP push via SW
  });

  // Refresh list on ticket_updated
  useEffect(() => {
    const handler = () => fetchConversations();
    window.addEventListener("live:ticket_updated", handler);
    return () => window.removeEventListener("live:ticket_updated", handler);
  }, [fetchConversations]);

  // B.9: Register presence heartbeat when a conversation is selected
  useEffect(() => {
    const sendPresence = async (convId: string | null) => {
      try {
        await fetch("/api/chat/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ convId }),
        });
      } catch {}
    };

    sendPresence(selectedId);
    if (!selectedId) return;

    const interval = setInterval(() => sendPresence(selectedId), 30_000);
    return () => {
      clearInterval(interval);
      // Clear presence on unmount / deselect
      sendPresence(null);
    };
  }, [selectedId]);

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
        <ConversationContext
          conversation={selectedConversation}
          onAssigned={fetchConversations}
        />
      </div>
    </div>
  );
}
