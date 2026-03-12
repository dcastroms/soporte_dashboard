"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
    AlertOctagon, Bug, Clock, ExternalLink, RefreshCw,
    Pencil, Save, X, ChevronDown, ChevronUp, Zap
} from "lucide-react";
import { toast } from "sonner";
import type { CriticalAccount } from "@/lib/clientIntelActions";

const INTERCOM_APP_ID = "msxvtmeq";

// Project tracking notes — stored in localStorage per client
const NOTES_KEY = "cs_account_notes_v1";

function getNotes(): Record<string, string> {
    if (typeof window === "undefined") return {};
    try { return JSON.parse(localStorage.getItem(NOTES_KEY) || "{}"); } catch { return {}; }
}

function saveNote(client: string, note: string) {
    const notes = getNotes();
    notes[client.toLowerCase()] = note;
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

// ─── Sub components ───────────────────────────────────────────────────────────

function AlertBadge({ type }: { type: CriticalAccount["alertType"] }) {
    const cfg = {
        both: { label: "⚠️ Crítico", cls: "bg-destructive/15 text-destructive border-destructive/20" },
        stale: { label: "🕐 Sin respuesta", cls: "bg-amber-500/15 text-amber-600 border-amber-500/20" },
        bug_regression: { label: "🐛 Posible regresión", cls: "bg-[#9E77E5]/15 text-[#9E77E5] border-[#9E77E5]/20" },
    }[type];
    return <Badge className={`text-[8px] h-4 px-2 ${cfg.cls}`}>{cfg.label}</Badge>;
}

function AccountCard({ acc }: { acc: CriticalAccount }) {
    const [expanded, setExpanded] = useState(false);
    const [editing, setEditing] = useState(false);
    const [note, setNote] = useState(() => getNotes()[acc.client.toLowerCase()] || "");

    const url = acc.latestTicketId
        ? `https://app.intercom.com/a/apps/${INTERCOM_APP_ID}/conversations/${acc.latestTicketId}`
        : null;

    const handleSave = useCallback(() => {
        saveNote(acc.client, note);
        setEditing(false);
        toast.success(`Notas de ${acc.client} guardadas`);
    }, [acc.client, note]);

    return (
        <div className={`rounded-xl border p-3 space-y-2 ${acc.alertType === "both"
                ? "border-destructive/25 bg-destructive/5"
                : acc.alertType === "stale"
                    ? "border-amber-500/20 bg-amber-500/5"
                    : "border-[#9E77E5]/20 bg-[#9E77E5]/5"
            }`}>
            {/* Header row */}
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base">{acc.flag}</span>
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                            <p className="text-[11px] font-black text-foreground truncate">{acc.client}</p>
                            <AlertBadge type={acc.alertType} />
                        </div>
                        <p className="text-[8px] text-muted-foreground">{acc.country}</p>
                    </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                    {url && (
                        <a href={url} target="_blank" rel="noopener noreferrer"
                            className="text-[#9E77E5] hover:opacity-70 transition-opacity">
                            <ExternalLink size={11} />
                        </a>
                    )}
                    <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => setExpanded(e => !e)}>
                        {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                    </Button>
                </div>
            </div>

            {/* Stats chips */}
            <div className="flex flex-wrap gap-1.5">
                {acc.staleCount > 0 && (
                    <span className="flex items-center gap-0.5 text-[8px] font-bold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full">
                        <Clock size={8} />
                        {acc.staleCount} ticket{acc.staleCount > 1 ? "s" : ""} sin respuesta &gt;{acc.staleDays}d
                    </span>
                )}
                {acc.bugCount >= 3 && (
                    <span className="flex items-center gap-0.5 text-[8px] font-bold text-[#9E77E5] bg-[#9E77E5]/10 px-2 py-0.5 rounded-full">
                        <Bug size={8} />
                        {acc.bugCount} bugs — posible regresión técnica
                    </span>
                )}
            </div>

            {/* Auto-generated insight */}
            <p className="text-[9px] text-muted-foreground italic">
                {acc.alertType === "both"
                    ? `⚡ ${acc.client} acumula tickets sin resolver y múltiples bugs. Escalar a producto y asignar responsable.`
                    : acc.alertType === "stale"
                        ? `🕐 ${acc.client} lleva más de ${acc.staleDays} días sin resolución en ${acc.staleCount} ticket${acc.staleCount > 1 ? "s" : ""}. Revisar prioridad de asignación.`
                        : `🐛 Posible regresión técnica en la cuenta de ${acc.client} (${acc.bugCount} bugs reportados). Notificar a equipo de desarrollo.`}
            </p>

            {/* Expandable project notes */}
            {expanded && (
                <div className="space-y-1.5 pt-1 border-t border-border/30">
                    <div className="flex items-center justify-between">
                        <p className="text-[8px] font-black uppercase tracking-wider text-muted-foreground">Notas de seguimiento</p>
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-5 px-1.5 text-[8px] gap-1"
                            onClick={() => editing ? handleSave() : setEditing(true)}
                        >
                            {editing ? <><Save size={8} /> Guardar</> : <><Pencil size={8} /> Editar</>}
                        </Button>
                    </div>

                    {editing ? (
                        <div className="space-y-1">
                            <Textarea
                                value={note}
                                onChange={e => setNote(e.target.value)}
                                placeholder={`Notas de seguimiento para ${acc.client}:\n• Migración de plataforma: ...\n• Integración Ads: ...\n• Publicación en stores: ...`}
                                className="text-[9px] min-h-[80px] resize-none border-[#9E77E5]/20 focus:border-[#9E77E5]/50"
                            />
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-5 text-[8px] text-muted-foreground"
                                onClick={() => setEditing(false)}
                            >
                                <X size={8} className="mr-1" />Cancelar
                            </Button>
                        </div>
                    ) : (
                        <div className="text-[9px] text-muted-foreground whitespace-pre-wrap">
                            {note || <span className="italic opacity-50">Sin notas. Haz clic en Editar para agregar seguimiento de migraciones, integraciones de Ads o publicación en stores.</span>}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface CriticalAccountAlertsProps {
    accounts: CriticalAccount[];
}

export function CriticalAccountAlerts({ accounts }: CriticalAccountAlertsProps) {
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState<CriticalAccount[]>(accounts);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const resp = await fetch("/api/audit/critical-accounts");
            if (resp.ok) {
                const data = await resp.json();
                setItems(data);
                toast.success(`${data.length} cuentas en revisión`);
            }
        } catch {
            toast.error("No se pudo actualizar");
        } finally {
            setLoading(false);
        }
    }, []);

    const criticalCount = items.filter(a => a.alertType === "both").length;

    return (
        <Card className="card-neumorphic border-none">
            <CardHeader className="pb-3 px-5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-xl bg-destructive/10 flex items-center justify-center">
                            <AlertOctagon size={13} className="text-destructive" />
                        </div>
                        <div>
                            <CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-tight text-destructive">
                                Customer Health Alerts
                                {criticalCount > 0 && (
                                    <span className="w-4 h-4 rounded-full bg-destructive text-white text-[8px] font-black flex items-center justify-center">
                                        {criticalCount}
                                    </span>
                                )}
                            </CardTitle>
                            <p className="text-[9px] text-muted-foreground">Cuentas con tickets críticos o bugs recurrentes</p>
                        </div>
                    </div>
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-[9px] px-2 gap-1 border-destructive/30 text-destructive hover:bg-destructive/10"
                        onClick={refresh}
                        disabled={loading}
                    >
                        <RefreshCw size={9} className={loading ? "animate-spin" : ""} />
                        Actualizar
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="px-5 pb-5 space-y-2">
                {items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 gap-2">
                        <Zap size={20} className="text-[#67AA09]" />
                        <p className="text-[11px] text-muted-foreground font-medium">✅ Todas las cuentas en buen estado</p>
                        <p className="text-[9px] text-muted-foreground text-center">Sin tickets críticos ni regresiones técnicas detectadas</p>
                    </div>
                ) : (
                    <>
                        {items.map(acc => <AccountCard key={acc.client} acc={acc} />)}
                        <p className="text-[8px] text-muted-foreground pt-1">
                            💡 Expande cada cuenta para agregar notas de seguimiento (migraciones, integraciones de Ads, publicación en stores).
                        </p>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
