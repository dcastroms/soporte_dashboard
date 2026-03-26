"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  conversationId: string;
}

interface AuditSummary {
  urgency: string;
  problem: string;
  action: string;
}

export function TicketSummaryPopover({ conversationId }: Props) {
  const [state, setState] = useState<"idle" | "loading" | "open">("idle");
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state !== "open") return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setState("idle");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [state]);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (state === "open") {
      setState("idle");
      return;
    }

    setState("loading");
    try {
      const resp = await fetch("/api/ai/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, mode: "audit" }),
      });

      if (!resp.ok) {
        if (resp.status === 429) {
          toast.error("Límite de resúmenes alcanzado, intenta en un minuto");
        } else {
          toast.error("No se pudo generar el resumen, intenta de nuevo");
        }
        setState("idle");
        return;
      }

      const data = await resp.json();
      setSummary(data);
      setState("open");
    } catch {
      toast.error("No se pudo generar el resumen, intenta de nuevo");
      setState("idle");
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={handleClick}
        className={cn(
          "text-muted-foreground hover:text-primary transition-colors",
          state === "open" && "text-primary"
        )}
        title="Resumen IA"
      >
        {state === "loading" ? (
          <Loader2 size={10} className="animate-spin" />
        ) : (
          <Sparkles size={10} />
        )}
      </button>

      {state === "open" && summary && (
        <div className="absolute right-0 top-5 z-50 w-64 rounded-xl border border-border bg-card p-3 shadow-lg space-y-2 text-[11px]">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground mb-0.5">Urgencia</p>
            <p className="text-foreground">{summary.urgency}</p>
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground mb-0.5">Problema</p>
            <p className="text-foreground">{summary.problem}</p>
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground mb-0.5">Acción</p>
            <p className="text-foreground">{summary.action}</p>
          </div>
        </div>
      )}
    </div>
  );
}
