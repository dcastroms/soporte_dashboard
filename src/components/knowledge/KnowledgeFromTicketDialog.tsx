// src/components/knowledge/KnowledgeFromTicketDialog.tsx
"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Loader2, Save, X } from "lucide-react";
import { toast } from "sonner";
import { PLATFORM_MODULES } from "@/lib/platformModules";
import type { ArticleDraft } from "@/lib/ticketToKnowledge";

interface Props {
  conversationId: string;
  open: boolean;
  onClose: () => void;
}

export function KnowledgeFromTicketDialog({ conversationId, open, onClose }: Props) {
  const [step, setStep] = useState<"loading" | "editing" | "saving">("loading");
  const [draft, setDraft] = useState<ArticleDraft | null>(null);
  const [solucionText, setSolucionText] = useState("");

  const loadDraft = async () => {
    setStep("loading");
    try {
      const res = await fetch("/api/knowledge/from-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error generando borrador");
      setDraft(data.draft);
      setSolucionText(data.draft.solucion.join("\n"));
      setStep("editing");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al generar artículo");
      onClose();
    }
  };

  // Disparar carga cuando el dialog se abre
  useEffect(() => {
    if (open) loadDraft();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) onClose();
  };

  const handleSave = async () => {
    if (!draft) return;
    setStep("saving");

    const solucion = solucionText
      .split("\n")
      .map((s) => s.replace(/^\d+\.\s*/, "").trim())
      .filter(Boolean);

    const finalDraft: ArticleDraft = { ...draft, solucion };

    try {
      const res = await fetch("/api/knowledge/save-from-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft: finalDraft, conversationId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error guardando artículo");

      if (data.skipped) {
        toast.info("Este ticket ya estaba en la base de conocimiento");
      } else {
        toast.success("Artículo guardado en la Base de Conocimiento");
      }
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
      setStep("editing");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-bold">
            <BookOpen size={15} className="text-primary" />
            Convertir ticket a Base de Conocimiento
          </DialogTitle>
        </DialogHeader>

        {step === "loading" && (
          <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
            <Loader2 size={24} className="animate-spin text-primary" />
            <p className="text-sm">Analizando conversación...</p>
          </div>
        )}

        {(step === "editing" || step === "saving") && draft && (
          <div className="space-y-4 mt-2">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Título</label>
              <Input
                value={draft.titulo}
                onChange={(e) => setDraft((d) => d ? { ...d, titulo: e.target.value } : d)}
                className="text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Problema</label>
              <Textarea
                value={draft.problema}
                onChange={(e) => setDraft((d) => d ? { ...d, problema: e.target.value } : d)}
                rows={2}
                className="text-sm resize-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">
                Solución <span className="text-muted-foreground/60 font-normal">(un paso por línea)</span>
              </label>
              <Textarea
                value={solucionText}
                onChange={(e) => setSolucionText(e.target.value)}
                rows={5}
                className="text-sm font-mono resize-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Categoría</label>
              <Select
                value={draft.categoria}
                onValueChange={(v) => setDraft((d) => d ? { ...d, categoria: v } : d)}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {PLATFORM_MODULES.map((m) => (
                    <SelectItem key={m} value={m} className="text-sm">{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Tags</label>
              <div className="flex flex-wrap gap-1.5">
                {draft.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-[10px] gap-1">
                    {tag}
                    <button
                      onClick={() => setDraft((d) => d ? { ...d, tags: d.tags.filter((t) => t !== tag) } : d)}
                      className="hover:text-destructive"
                    >
                      <X size={9} />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="outline" size="sm" onClick={onClose} disabled={step === "saving"}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSave} disabled={step === "saving"} className="gap-1.5">
                {step === "saving" ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                Guardar en KB
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
