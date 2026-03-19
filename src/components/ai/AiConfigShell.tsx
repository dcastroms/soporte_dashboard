"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, CheckCircle2, AlertCircle, Sparkles, RotateCcw, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface Config {
  systemPrompt: string;
  isCustom: boolean;
  provider: string;
  model: string;
}

interface Stats {
  total: number;
  today: number;
  acceptanceRate: number | null;
  withFeedback: number;
  knowledgeRate: number;
}

export function AiConfigShell() {
  const [config, setConfig] = useState<Config | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [promptDraft, setPromptDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [healthStatus, setHealthStatus] = useState<"idle" | "checking" | "ok" | "error">("idle");

  useEffect(() => {
    fetch("/api/ai/config").then(r => r.json()).then(d => {
      setConfig(d);
      setPromptDraft(d.systemPrompt);
    });
    fetch("/api/ai/stats").then(r => r.json()).then(setStats);
  }, []);

  async function savePrompt() {
    setSaving(true);
    try {
      const resp = await fetch("/api/ai/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemPrompt: promptDraft }),
      });
      if (!resp.ok) throw new Error();
      setConfig(c => c ? { ...c, systemPrompt: promptDraft, isCustom: true } : c);
      toast.success("Prompt guardado");
    } catch {
      toast.error("No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  async function resetPrompt() {
    await fetch("/api/ai/config", { method: "DELETE" });
    const fresh = await fetch("/api/ai/config").then(r => r.json());
    setConfig(fresh);
    setPromptDraft(fresh.systemPrompt);
    toast.success("Prompt restaurado al original");
  }

  async function checkHealth() {
    setHealthStatus("checking");
    try {
      const resp = await fetch("/api/ai/health");
      setHealthStatus(resp.ok ? "ok" : "error");
    } catch {
      setHealthStatus("error");
    }
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 size={20} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Tabs defaultValue="status" className="space-y-4">
      <TabsList className="bg-muted/40">
        <TabsTrigger value="status">Estado</TabsTrigger>
        <TabsTrigger value="prompt">System Prompt</TabsTrigger>
        <TabsTrigger value="stats">Estadísticas</TabsTrigger>
      </TabsList>

      {/* ── Estado ─────────────────────────────────────────────── */}
      <TabsContent value="status" className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="card-neumorphic rounded-xl p-4 space-y-1">
            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Proveedor</p>
            <p className="text-lg font-bold capitalize">{config.provider}</p>
            <p className="text-[10px] text-muted-foreground">{config.provider === "ollama" ? "Local · Ollama" : "Cloud · Anthropic"}</p>
          </div>
          <div className="card-neumorphic rounded-xl p-4 space-y-1">
            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Modelo</p>
            <p className="text-lg font-bold font-mono">{config.model}</p>
            <p className="text-[10px] text-muted-foreground">
              {config.provider === "ollama" ? "Configurable en .env → OLLAMA_MODEL" : "Configurable en .env → CLAUDE_MODEL"}
            </p>
          </div>
        </div>

        <div className="card-neumorphic rounded-xl p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold">Verificar conexión</p>
            <p className="text-[11px] text-muted-foreground">Prueba que el proveedor IA responde correctamente</p>
          </div>
          <div className="flex items-center gap-3">
            {healthStatus === "ok" && <span className="flex items-center gap-1 text-xs text-success font-medium"><CheckCircle2 size={14} /> Conectado</span>}
            {healthStatus === "error" && <span className="flex items-center gap-1 text-xs text-destructive font-medium"><AlertCircle size={14} /> Sin conexión</span>}
            <Button size="sm" variant="outline" onClick={checkHealth} disabled={healthStatus === "checking"}>
              {healthStatus === "checking" ? <Loader2 size={13} className="animate-spin mr-1" /> : <Sparkles size={13} className="mr-1" />}
              Verificar
            </Button>
          </div>
        </div>

        <div className="card-neumorphic rounded-xl p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold">Base de Conocimiento</p>
            <p className="text-[11px] text-muted-foreground">Gestiona los documentos que usa la IA como fuente</p>
          </div>
          <Button size="sm" variant="outline" asChild>
            <Link href="/knowledge">
              <BookOpen size={13} className="mr-1" />
              Abrir
            </Link>
          </Button>
        </div>
      </TabsContent>

      {/* ── System Prompt ───────────────────────────────────────── */}
      <TabsContent value="prompt" className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Instrucciones del asistente IA</p>
            <p className="text-[11px] text-muted-foreground">
              Define el tono, restricciones y comportamiento del asistente.
              {config.isCustom && <span className="ml-1 text-primary font-medium">· Personalizado</span>}
              {!config.isCustom && <span className="ml-1 text-muted-foreground font-medium">· Usando prompt por defecto</span>}
            </p>
          </div>
          {config.isCustom && (
            <Button size="sm" variant="ghost" onClick={resetPrompt} className="text-muted-foreground hover:text-foreground">
              <RotateCcw size={12} className="mr-1" />
              Restaurar original
            </Button>
          )}
        </div>

        <Textarea
          value={promptDraft}
          onChange={e => setPromptDraft(e.target.value)}
          rows={16}
          className="font-mono text-[12px] resize-none"
          placeholder="Escribe las instrucciones del sistema..."
        />

        <div className="flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground">{promptDraft.length} caracteres</p>
          <Button
            size="sm"
            onClick={savePrompt}
            disabled={saving || promptDraft === config.systemPrompt}
          >
            {saving && <Loader2 size={13} className="animate-spin mr-1" />}
            Guardar prompt
          </Button>
        </div>
      </TabsContent>

      {/* ── Estadísticas ────────────────────────────────────────── */}
      <TabsContent value="stats" className="space-y-3">
        {!stats ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 size={18} className="animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: "Sugerencias hoy",
                value: stats.today.toString(),
                sub: `${stats.total} históricas`,
                color: "text-primary",
              },
              {
                label: "Tasa de aceptación",
                value: stats.acceptanceRate !== null ? `${stats.acceptanceRate}%` : "Sin datos",
                sub: `${stats.withFeedback} con feedback`,
                color: stats.acceptanceRate !== null && stats.acceptanceRate >= 70 ? "text-success" : "text-muted-foreground",
              },
              {
                label: "Con conocimiento",
                value: `${stats.knowledgeRate}%`,
                sub: "Usaron la base de docs",
                color: stats.knowledgeRate >= 50 ? "text-primary" : "text-amber-500",
              },
              {
                label: "Sin conocimiento",
                value: `${100 - stats.knowledgeRate}%`,
                sub: "Respondidas sin docs",
                color: "text-muted-foreground",
              },
            ].map(item => (
              <div key={item.label} className="card-neumorphic rounded-xl p-4 space-y-1">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">{item.label}</p>
                <p className={cn("text-2xl font-black", item.color)}>{item.value}</p>
                <p className="text-[10px] text-muted-foreground">{item.sub}</p>
              </div>
            ))}
          </div>
        )}

        {stats && stats.total === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
            <Sparkles size={24} className="text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Aún no hay sugerencias generadas</p>
            <p className="text-[11px] text-muted-foreground">Usa el botón "Sugerir IA" en el Chat para ver estadísticas aquí</p>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
