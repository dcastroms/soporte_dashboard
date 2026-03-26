"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  conversationId: string;
}

interface ChatSummary {
  problem: string;
  context: string;
  attempts: string;
  action: string;
}

type State =
  | { status: "loading" }
  | { status: "too_short" }
  | { status: "error"; message: string }
  | { status: "done"; data: ChatSummary };

export function ConversationSummary({ conversationId }: Props) {
  const [result, setResult] = useState<State>({ status: "loading" });
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const resp = await fetch("/api/ai/summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId, mode: "chat" }),
        });

        if (cancelled) return;

        if (!resp.ok) {
          if (resp.status === 429) {
            setResult({ status: "error", message: "Demasiadas solicitudes, intenta en un minuto" });
          } else if (resp.status === 404) {
            setResult({ status: "error", message: "Resumen no disponible (ticket no sincronizado aún)" });
          } else {
            setResult({ status: "error", message: "No se pudo generar el resumen" });
          }
          return;
        }

        const data = await resp.json();
        if (cancelled) return;

        if (data.tooShort) {
          setResult({ status: "too_short" });
        } else {
          setResult({ status: "done", data });
        }
      } catch {
        if (!cancelled) {
          setResult({ status: "error", message: "No se pudo generar el resumen" });
        }
      }
    };

    run();
    return () => { cancelled = true; };
  }, [conversationId]);

  return (
    <div className="mx-4 mt-2 mb-1 rounded-xl border border-border bg-card text-[11px] shrink-0">
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-left"
        onClick={() => setCollapsed((c) => !c)}
      >
        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          Resumen IA
        </span>
        {collapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
      </button>

      {!collapsed && (
        <div className="px-3 pb-3 pt-0">
          {result.status === "loading" && (
            <div className="flex items-center gap-2 text-muted-foreground py-1">
              <Loader2 size={11} className="animate-spin shrink-0" />
              <div className="flex-1 space-y-1.5">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-2 rounded bg-muted animate-pulse" style={{ width: `${70 + (i % 3) * 10}%` }} />
                ))}
              </div>
            </div>
          )}

          {result.status === "too_short" && (
            <p className="text-muted-foreground italic">Conversación muy corta para resumir</p>
          )}

          {result.status === "error" && (
            <p className="text-destructive">{result.message}</p>
          )}

          {result.status === "done" && (
            <div className="space-y-2">
              <Field label="Problema" value={result.data.problem} />
              <Field label="Contexto" value={result.data.context} />
              <Field label="Intentos" value={result.data.attempts} />
              <Field label="Acción" value={result.data.action} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className={cn("text-[9px] font-bold uppercase tracking-wide text-muted-foreground mb-0.5")}>{label}</p>
      <p className="text-foreground leading-relaxed">{value}</p>
    </div>
  );
}
