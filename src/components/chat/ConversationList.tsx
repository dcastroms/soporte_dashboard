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
