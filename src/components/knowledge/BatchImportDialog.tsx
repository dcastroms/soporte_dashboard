// src/components/knowledge/BatchImportDialog.tsx
"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Loader2, CheckCircle2 } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface Progress {
  processed: number;
  skipped: number;
  errors: number;
  total: number;
  message?: string;
}

function toInputDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

export function BatchImportDialog({ open, onClose }: Props) {
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);

  const [from, setFrom] = useState(toInputDate(thirtyDaysAgo));
  const [to, setTo] = useState(toInputDate(today));
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [progress, setProgress] = useState<Progress | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const handleImport = async () => {
    setStatus("running");
    setProgress({ processed: 0, skipped: 0, errors: 0, total: 0 });
    setErrorMsg("");

    try {
      const res = await fetch("/api/knowledge/batch-from-tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: new Date(from).toISOString(), to: new Date(to + "T23:59:59").toISOString() }),
      });

      if (!res.ok || !res.body) throw new Error("Error iniciando importación");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split("\n").filter((l) => l.startsWith("data: "));

        for (const line of lines) {
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "progress" || event.type === "done") {
              setProgress(event);
            }
            if (event.type === "status") {
              setProgress((p) => p ? { ...p, message: event.message } : null);
            }
            if (event.type === "done") {
              setStatus("done");
            }
            if (event.type === "error") {
              setErrorMsg(event.message);
              setStatus("error");
            }
          } catch {}
        }
      }

      // no-op: status was already set to "done" via SSE "done" event
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error inesperado");
      setStatus("error");
    }
  };

  const handleClose = () => {
    setStatus("idle");
    setProgress(null);
    setErrorMsg("");
    onClose();
  };

  const percent = progress?.total ? Math.round(((progress.processed + progress.skipped) / progress.total) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-bold">
            <Download size={14} className="text-primary" />
            Importar tickets resueltos a KB
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Desde</label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="text-sm" disabled={status === "running"} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Hasta</label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="text-sm" disabled={status === "running"} />
            </div>
          </div>

          {progress && (
            <div className="space-y-2">
              {progress.message && (
                <p className="text-[11px] text-muted-foreground">{progress.message}</p>
              )}
              {progress.total > 0 && (
                <>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>{progress.processed} importados · {progress.skipped} duplicados · {progress.errors} errores</span>
                    <span>{progress.processed + progress.skipped}/{progress.total}</span>
                  </div>
                </>
              )}
            </div>
          )}

          {status === "done" && (
            <div className="flex items-center gap-2 text-sm text-emerald-500 font-medium">
              <CheckCircle2 size={14} />
              Importación completada
            </div>
          )}

          {status === "error" && (
            <p className="text-sm text-destructive">{errorMsg}</p>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="outline" size="sm" onClick={handleClose} disabled={status === "running"}>
              {status === "done" ? "Cerrar" : "Cancelar"}
            </Button>
            {status !== "done" && (
              <Button size="sm" onClick={handleImport} disabled={status === "running"} className="gap-1.5">
                {status === "running" ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                {status === "running" ? "Importando..." : "Importar"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
