"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    ArrowLeft, ExternalLink, Clock, Bug, AlertOctagon,
    Target, BarChart2, Activity, History, Plus,
    TrendingUp, TrendingDown, Users, Zap
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
    BarChart, Bar, ResponsiveContainer, Tooltip as RechartsTooltip,
    XAxis, YAxis
} from "recharts";
import type { ClientAuditData, AuditTicket } from "@/lib/clientIntelActions";
import { addClientNote } from "@/lib/clientNoteActions";

interface ClientAuditViewProps {
    data: ClientAuditData;
    initialNotes?: any[];
    initialActions?: any[];
}

// ─── KPI comparison card ──────────────────────────────────────────────────────
function KPICompare({ label, value, global, unit, inverse, description }: {
    label: string;
    value: number | null;
    global: number | null;
    unit: string;
    inverse?: boolean;
    description: string;
}) {
    const fmt = (v: number | null) => v === null ? "—" : `${v.toFixed(1)}${unit}`;
    const better = value !== null && global !== null
        ? inverse ? value < global : value > global
        : null;
    const pct = value !== null && global !== null && global !== 0
        ? Math.abs(((value - global) / global) * 100).toFixed(0)
        : null;

    return (
        <div className="p-3 rounded-xl bg-muted/20 border border-[#9E77E5]/20 space-y-2">
            <div className="flex items-center justify-between">
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
                {better !== null && pct && (
                    <span className={`flex items-center gap-0.5 text-[8px] font-bold ${better ? "text-emerald-500" : "text-destructive"}`}>
                        {better ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                        {pct}% vs global
                    </span>
                )}
            </div>
            <div className="flex items-end justify-between gap-2">
                <div>
                    <p className="text-2xl font-black text-[#9E77E5]">{fmt(value)}</p>
                    <p className="text-[8px] text-muted-foreground">Esta cuenta</p>
                </div>
                <div className="text-right">
                    <p className="text-sm font-bold text-muted-foreground">{fmt(global)}</p>
                    <p className="text-[8px] text-muted-foreground">Promedio global</p>
                </div>
            </div>
            <p className="text-[8px] text-muted-foreground italic">{description}</p>
        </div>
    );
}

// ─── Ticket row ───────────────────────────────────────────────────────────────
const PRIORITY_CLS: Record<string, string> = {
    urgent: "bg-destructive text-white border-none",
    high: "bg-amber-500 text-white border-none",
    normal: "bg-muted text-muted-foreground",
    low: "bg-muted/60 text-muted-foreground",
};

function TicketRow({ ticket }: { ticket: AuditTicket }) {
    const statusIcon = ticket.status === "closed"
        ? <CheckCircle2 size={10} className="text-emerald-500" />
        : <Clock size={10} className="text-amber-500" />;

    return (
        <div className={`p-2.5 rounded-xl border flex items-start gap-2.5 ${ticket.isRedFlag ? "border-destructive/20 bg-destructive/5" : "border-border/30 bg-muted/10"} hover:border-[#9E77E5]/30 transition-colors`}>
            <span className="mt-0.5 shrink-0">{statusIcon}</span>
            <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-foreground truncate">{ticket.subject}</p>
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    {ticket.ticketType && (
                        <Badge className="text-[7px] h-3.5 px-1 bg-[#9E77E5]/10 text-[#9E77E5] border-none">{ticket.ticketType}</Badge>
                    )}
                    {ticket.module && (
                        <Badge className="text-[7px] h-3.5 px-1 bg-muted text-muted-foreground border-none">{ticket.module}</Badge>
                    )}
                    {ticket.teammateName && (
                        <span className="text-[8px] text-muted-foreground">@{ticket.teammateName}</span>
                    )}
                    {ticket.isRedFlag && (
                        <span className="text-[8px] font-bold text-destructive">{ticket.staleHours}h sin respuesta</span>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
                {ticket.priority && ticket.priority !== "normal" && (
                    <Badge className={`text-[7px] h-4 px-1.5 ${PRIORITY_CLS[ticket.priority] ?? PRIORITY_CLS.normal}`}>
                        {ticket.priority.toUpperCase()}
                    </Badge>
                )}
                <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-muted-foreground hover:text-[#9E77E5] hover:bg-[#9E77E5]/10"
                    onClick={(e) => {
                        e.stopPropagation();
                        toast.info("Reasignar ticket (Mock)", { description: "Conectando con Intercom..." });
                    }}
                >
                    <Users size={10} />
                </Button>
                <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={(e) => {
                        e.stopPropagation();
                        toast.info("Cerrar ticket (Mock)", { description: "Conectando con Intercom..." });
                    }}
                >
                    <Zap size={10} />
                </Button>
                <a href={ticket.intercomUrl} target="_blank" rel="noopener noreferrer"
                    className="text-[#9E77E5] hover:opacity-70 transition-opacity">
                    <ExternalLink size={11} />
                </a>
            </div>
        </div>
    );
}

function CheckCircle2({ size, className }: { size: number, className: string }) {
    return <Activity size={size} className={className} />; // Fallback icon
}

const TYPE_COLORS = ["#9E77E5", "#67AA09", "#3b82f6", "#f59e0b", "#ef4444", "#06b6d4"];

export function ClientAuditView({ data, initialNotes = [], initialActions = [] }: ClientAuditViewProps) {
    const [tab, setTab] = useState<"flags" | "all">("flags");
    const [notes, setNotes] = useState(initialNotes);
    const [actions, setActions] = useState(initialActions);
    const [newNote, setNewNote] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    const tickets = tab === "flags" ? data.redFlags : data.allTickets;

    const handleAddNote = async () => {
        if (!newNote.trim() || isSaving) return;
        setIsSaving(true);
        try {
            const added = await addClientNote(data.client.slug, newNote);
            setNotes([added, ...notes]);
            setNewNote("");
        } catch (error) {
            console.error("Error saving note:", error);
        } finally {
            setIsSaving(false);
        }
    };

    const timelineData = data.timeline.map(d => ({
        ...d,
        label: new Date(d.date + "T12:00:00").toLocaleDateString("es", { weekday: "short", day: "numeric" }),
    }));

    return (
        <div className="space-y-5">
            {/* ── Header ──────────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4">
                    <Link href="/clients">
                        <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs border-[#9E77E5]/30 text-[#9E77E5] hover:bg-[#9E77E5]/10">
                            <ArrowLeft size={12} /> CS Intelligence
                        </Button>
                    </Link>

                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#9E77E5] to-[#67AA09] flex items-center justify-center text-white text-xl font-black shadow-lg shadow-[#9E77E5]/25">
                            {data.client.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-black tracking-tight text-foreground">{data.client.name}</h1>
                                {data.redFlags.length > 0 && (
                                    <Badge className="bg-destructive/15 text-destructive border-destructive/20 text-[9px] h-5">
                                        {data.redFlags.length} Red {data.redFlags.length > 1 ? "Flags" : "Flag"}
                                    </Badge>
                                )}
                            </div>
                            <p className="text-[11px] text-muted-foreground">{data.country} · {data.kpis.total} tickets totales · {data.kpis.open} abiertos</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex gap-2">
                        <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                            <p className="text-xs font-black text-emerald-500">{data.kpis.closed}</p>
                            <p className="text-[8px] text-muted-foreground">Cerrados</p>
                        </div>
                        <div className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
                            <p className="text-xs font-black text-amber-500">{data.kpis.open}</p>
                            <p className="text-[8px] text-muted-foreground">Abiertos</p>
                        </div>
                        {data.kpis.bugs > 0 && (
                            <div className="px-3 py-1.5 rounded-xl bg-destructive/10 border border-destructive/20 text-center">
                                <p className="text-xs font-black text-destructive">{data.kpis.bugs}</p>
                                <p className="text-[8px] text-muted-foreground">Bugs</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── KPIs vs Global ───────────────────────────────────────────────── */}
            <div className="grid gap-3 md:grid-cols-3">
                <KPICompare
                    label="TTR — Tiempo de Resolución"
                    value={data.kpis.ttr}
                    global={data.kpis.globalTtr}
                    unit="h"
                    inverse
                    description="Menos horas = mejor. Promedio desde apertura hasta cierre del ticket."
                />
                <KPICompare
                    label="FCR — Resolución 1ª Respuesta"
                    value={data.kpis.fcr}
                    global={data.kpis.globalFcr}
                    unit="%"
                    description="% tickets cerrados dentro de las primeras 24h. Más alto = mejor."
                />
                <div className="p-3 rounded-xl bg-muted/20 border border-[#9E77E5]/20 space-y-2">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Distribución de Tipos</p>
                    <div className="space-y-1.5">
                        {data.typeBreakdown.slice(0, 3).map((t, i) => (
                            <div key={t.label} className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: TYPE_COLORS[i] }} />
                                <p className="text-[9px] text-muted-foreground truncate flex-1">{t.label}</p>
                                <p className="text-[9px] font-bold text-foreground">{t.pct}%</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Main panels grid ─────────────────────────────────────────────── */}
            <div className="grid gap-5 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-3">
                    <Card className="card-neumorphic border-none">
                        <CardHeader className="pb-2 px-4 pt-4">
                            <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-tight">
                                    <AlertOctagon size={13} className="text-[#9E77E5]" />
                                    Tickets
                                </CardTitle>
                                <div className="flex gap-1">
                                    <Button size="sm"
                                        className={`h-6 text-[9px] px-2 rounded-full ${tab === "flags" ? "bg-destructive/80 text-white hover:bg-destructive" : "variant-outline border-border/50"}`}
                                        onClick={() => setTab("flags")}
                                    >
                                        🚩 Red Flags ({data.redFlags.length})
                                    </Button>
                                    <Button size="sm" variant="outline"
                                        className={`h-6 text-[9px] px-2 rounded-full border-border/50 ${tab === "all" ? "border-[#9E77E5]/50 text-[#9E77E5]" : ""}`}
                                        onClick={() => setTab("all")}
                                    >
                                        Todos ({data.allTickets.length})
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="px-4 pb-4 space-y-1.5 max-h-[400px] overflow-y-auto scrollbar-hide">
                            {tickets.length === 0 ? (
                                <div className="py-6 text-center">
                                    <p className="text-[11px] text-muted-foreground">
                                        {tab === "flags" ? "✅ Sin tickets críticos para esta cuenta" : "Sin tickets registrados"}
                                    </p>
                                </div>
                            ) : (
                                tickets.map(t => <TicketRow key={t.intercomId} ticket={t} />)
                            )}
                        </CardContent>
                    </Card>

                    <Card className="card-neumorphic border-none">
                        <CardHeader className="pb-2 px-4 pt-4">
                            <CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-tight">
                                <Activity size={13} className="text-[#9E77E5]" />
                                Actividad — Últimos 7 días
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-4">
                            <div className="h-36">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={timelineData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                                        <XAxis dataKey="label" tick={{ fontSize: 8 }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fontSize: 8 }} axisLine={false} tickLine={false} />
                                        <RechartsTooltip
                                            contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 10 }}
                                        />
                                        <Bar dataKey="opened" name="Abiertos" fill="#9E77E5" fillOpacity={0.7} radius={[3, 3, 0, 0]} />
                                        <Bar dataKey="closed" name="Cerrados" fill="#67AA09" fillOpacity={0.8} radius={[3, 3, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-3">
                    {/* Activity Log */}
                    <Card className="card-neumorphic border-none p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <History size={16} className="text-[#9E77E5]" />
                            <h3 className="text-xs font-black uppercase tracking-wider text-foreground">Actividad Reciente</h3>
                        </div>
                        <div className="space-y-4">
                            {actions.length === 0 ? (
                                <p className="text-[10px] text-muted-foreground italic">Sin actividad reciente registrada.</p>
                            ) : (
                                actions.map((action, i) => (
                                    <div key={action.id || i} className="flex gap-3 relative pb-4 last:pb-0">
                                        {i !== actions.length - 1 && (
                                            <div className="absolute left-1.5 top-4 bottom-0 w-px bg-border/40" />
                                        )}
                                        <div className="w-3 h-3 rounded-full bg-[#9E77E5]/20 border border-[#9E77E5]/40 shrink-0 mt-0.5 z-10" />
                                        <div className="space-y-1">
                                            <p className="text-[11px] font-bold text-foreground leading-tight">{action.action}</p>
                                            <p className="text-[10px] text-muted-foreground line-clamp-2">{action.details}</p>
                                            <p className="text-[9px] text-muted-foreground/60">{action.authorName}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </Card>

                    {/* Collaborative Notes */}
                    <Card className="card-neumorphic border-none p-5">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Target size={16} className="text-[#67AA09]" />
                                <h3 className="text-xs font-black uppercase tracking-wider text-foreground">Notas Colaborativas</h3>
                            </div>
                            <Badge className="bg-[#67AA09]/10 text-[#67AA09] border-none text-[9px]">Sync DB</Badge>
                        </div>
                        <div className="space-y-3 mb-4 max-h-[250px] overflow-y-auto scrollbar-hide pr-1">
                            {notes.length === 0 ? (
                                <p className="text-[10px] text-muted-foreground italic text-center py-4">No hay notas todavía.</p>
                            ) : (
                                notes.map((note, i) => (
                                    <div key={note.id || i} className="p-3 rounded-xl bg-muted/20 border border-border/40 text-[11px] text-foreground/80">
                                        <p>{note.content}</p>
                                        <div className="mt-2 flex items-center justify-between text-[8px] text-muted-foreground font-bold">
                                            <span>{note.authorName}</span>
                                            <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="flex gap-2">
                            <textarea
                                value={newNote}
                                onChange={(e) => setNewNote(e.target.value)}
                                placeholder="Escribe una nota para el equipo..."
                                disabled={isSaving}
                                className="flex-1 bg-muted/30 border-none rounded-xl p-3 text-[11px] focus:ring-1 focus:ring-[#67AA09]/40 resize-none h-20 transition-all shadow-inner shadow-black/5"
                            />
                            <button
                                onClick={handleAddNote}
                                disabled={isSaving}
                                className="bg-[#67AA09] hover:bg-[#5da008] text-white p-3 rounded-xl self-end transition-colors disabled:opacity-50"
                            >
                                {isSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus size={18} />}
                            </button>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
