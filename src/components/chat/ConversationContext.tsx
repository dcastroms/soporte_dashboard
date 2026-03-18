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
