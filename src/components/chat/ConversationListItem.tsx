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
