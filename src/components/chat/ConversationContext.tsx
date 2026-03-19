"use client";

import { useState } from "react";
import { ChatConversation } from "@/types/chat";
import { Star, User, Tag, Clock, ExternalLink, UserCheck, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Props {
  conversation: ChatConversation | null;
  onAssigned?: () => void;
}

export function ConversationContext({ conversation, onAssigned }: Props) {
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  const handleAssign = async () => {
    if (!conversation) return;
    setAssigning(true);
    setAssignError(null);
    try {
      const resp = await fetch(`/api/chat/conversations/${conversation.id}/assign`, {
        method: "POST",
      });
      if (!resp.ok) {
        const data = await resp.json();
        setAssignError(data.error || "Error al asignar");
      } else {
        onAssigned?.();
      }
    } catch {
      setAssignError("Error de conexión");
    } finally {
      setAssigning(false);
    }
  };

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

      {/* B.12: Take/Assign conversation */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          Asignación
        </p>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
            <span className="text-[8px] font-black text-primary">
              {conversation.assignee.charAt(0)}
            </span>
          </div>
          <span className="font-medium flex-1">{conversation.assignee}</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 w-full text-[11px] gap-1.5"
          onClick={handleAssign}
          disabled={assigning}
        >
          {assigning ? (
            <Loader2 size={11} className="animate-spin" />
          ) : (
            <UserCheck size={11} />
          )}
          Tomar conversación
        </Button>
        {assignError && (
          <p className="text-[10px] text-destructive">{assignError}</p>
        )}
      </div>

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
