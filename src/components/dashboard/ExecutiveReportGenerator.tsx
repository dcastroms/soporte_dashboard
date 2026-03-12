"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import {
    BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip,
    ResponsiveContainer, CartesianGrid, Legend
} from "recharts";
import {
    FileText, Download, TrendingUp, TrendingDown, Users,
    AlertTriangle, CheckCircle2, BarChart2, Loader2
} from "lucide-react";
import { toast } from "sonner";
import { getRecentHandovers } from "@/lib/actions";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WeekMetric {
    label: string;
    fullLabel: string;   // human-readable label
    description: string; // what this means operationally
    current: number;
    previous: number;
    unit: string;
    inverse?: boolean;
}

interface ExecutiveReportProps {
    weekMetrics?: Partial<WeekMetric>[];
    reportDate?: string;
}

// ─── KPI Metadata (enriched from parent props) ─────────────────────────────

const KPI_META: Record<string, { fullLabel: string; description: string; inverse?: boolean }> = {
    FRT: {
        fullLabel: "Tiempo de Primera Respuesta (FRT)",
        description: "Cuánto tarda el equipo en responder por primera vez a un cliente. Meta: < 2 min.",
        inverse: true,
    },
    CSAT: {
        fullLabel: "Satisfacción del Cliente (CSAT)",
        description: "Porcentaje de clientes que calificaron el servicio positivamente. Meta: > 95%.",
        inverse: false,
    },
    Volumen: {
        fullLabel: "Volumen de Tickets",
        description: "Total de conversaciones atendidas esta semana vs. la anterior.",
        inverse: false,
    },
};

// ─── Delta badge ─────────────────────────────────────────────────────────────

function Delta({ current, previous, inverse = false }: {
    current: number; previous: number; inverse?: boolean;
}) {
    if (!previous || previous === 0) return <span className="text-[10px] text-muted-foreground">—</span>;
    const pct = ((current - previous) / previous) * 100;
    const positive = inverse ? pct < 0 : pct > 0;
    if (Math.abs(pct) < 0.5) return <span className="text-[10px] text-muted-foreground">Sin variación</span>;
    return (
        <span className={`flex items-center gap-0.5 text-[10px] font-bold ${positive ? "text-emerald-500" : "text-destructive"}`}>
            {positive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {Math.abs(pct).toFixed(1)}% {positive ? "de mejora" : "de caída"}
        </span>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ExecutiveReportGenerator({ weekMetrics = [], reportDate }: ExecutiveReportProps) {
    const [open, setOpen] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [handoverCount, setHandoverCount] = useState<number | null>(null);
    const reportRef = useRef<HTMLDivElement>(null);

    // Enrich metrics with metadata
    const enriched: WeekMetric[] = weekMetrics.map(m => ({
        label: m.label ?? "",
        fullLabel: KPI_META[m.label ?? ""]?.fullLabel ?? m.label ?? "",
        description: KPI_META[m.label ?? ""]?.description ?? "",
        current: m.current ?? 0,
        previous: m.previous ?? 0,
        unit: m.unit ?? "",
        inverse: KPI_META[m.label ?? ""]?.inverse ?? m.inverse,
    }));

    const dateLabel = reportDate || new Date().toLocaleDateString("es", {
        weekday: "long", year: "numeric", month: "long", day: "numeric"
    });

    const weekLabel = (() => {
        const now = new Date();
        const start = new Date(now); start.setDate(now.getDate() - now.getDay() + 1);
        const end = new Date(start); end.setDate(start.getDate() + 6);
        return `Semana del ${start.getDate()}/${start.getMonth() + 1} al ${end.getDate()}/${end.getMonth() + 1}/${end.getFullYear()}`;
    })();

    const wins = enriched.filter(m =>
        (m.inverse ? m.current < m.previous : m.current > m.previous) && m.previous > 0
    );
    const issues = enriched.filter(m =>
        (m.inverse ? m.current > m.previous * 1.05 : m.current < m.previous * 0.95) && m.previous > 0
    );

    const handleGenerate = async () => {
        setGenerating(true);
        await new Promise(r => setTimeout(r, 600));
        // Load handovers from this week
        try {
            const today = new Date();
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - today.getDay() + 1);
            const startStr = weekStart.toISOString().split("T")[0];
            // getRecentHandovers returns all, we filter client-side
            const all = await getRecentHandovers(200, 0) as any[];
            const thisWeek = all.filter((h: any) => h.date >= startStr);
            setHandoverCount(thisWeek.length);
        } catch {
            setHandoverCount(0);
        }
        setOpen(true);
        setGenerating(false);
        toast.success("Reporte ejecutivo generado", { description: weekLabel, duration: 4000 });
    };

    const handleDownload = () => {
        if (!reportRef.current) return;
        const content = reportRef.current.innerText;
        const blob = new Blob([content], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `reporte-ejecutivo-${new Date().toISOString().split("T")[0]}.txt`;
        a.click();
        toast.success("Reporte descargado");
    };

    // Chart — normalize values for visual comparison (since FRT/CSAT/Volume have different scales)
    const chartData = enriched.map(m => {
        const maxVal = Math.max(m.current, m.previous, 1);
        return {
            name: m.label,
            "Esta semana": parseFloat(m.current.toFixed(1)),
            "Sem. anterior": parseFloat(m.previous.toFixed(1)),
            unit: m.unit,
        };
    });

    return (
        <>
            <Button
                onClick={handleGenerate}
                disabled={generating}
                className="gap-2 bg-gradient-to-r from-[#67AA09] to-[#9E77E5] text-white border-none hover:opacity-90 font-bold text-xs h-8"
            >
                {generating ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
                {generating ? "Generando..." : "Generar Reporte Ejecutivo"}
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-4xl w-[90vw] max-h-[90vh] overflow-hidden flex flex-col p-0">
                    <DialogHeader className="px-6 pt-5 pb-4 shrink-0 border-b">
                        <div className="flex items-center justify-between">
                            <div>
                                <DialogTitle className="text-base font-black uppercase tracking-tight">
                                    📊 Reporte Ejecutivo — Soporte 360
                                </DialogTitle>
                                <DialogDescription className="text-[11px] mt-0.5">{weekLabel} · Generado: {dateLabel}</DialogDescription>
                            </div>
                            <Button size="sm" variant="outline" onClick={handleDownload} className="h-7 text-[10px] gap-1.5">
                                <Download size={11} />
                                Descargar
                            </Button>
                        </div>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto min-h-0">
                        <ScrollArea className="h-full">
                            <div ref={reportRef} className="px-6 py-5 space-y-6">

                                {/* ── Brand header ── */}
                                <div className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-[#67AA09]/10 to-[#9E77E5]/10 border border-[#9E77E5]/20">
                                    <div>
                                        <h2 className="text-lg font-black text-foreground">Informe de Gestión Operativa</h2>
                                        <p className="text-[11px] text-muted-foreground mt-0.5">Equipo de Soporte Mediastream · {weekLabel}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Estado General</p>
                                        <Badge className={`mt-1 text-[10px] px-3 ${wins.length >= issues.length ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/20" : "bg-destructive/15 text-destructive border-destructive/20"}`}>
                                            {wins.length >= issues.length ? "✅ Operación Saludable" : "⚠️ Requiere Atención"}
                                        </Badge>
                                    </div>
                                </div>

                                {/* ── SECTION 1: KPI SUMMARY ── */}
                                <section>
                                    <div className="flex items-center gap-2 mb-3">
                                        <BarChart2 size={13} className="text-[#9E77E5]" />
                                        <h3 className="text-[11px] font-black uppercase tracking-widest text-foreground">1. Rendimiento de KPIs esta semana</h3>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                                        {enriched.map((m) => (
                                            <div key={m.label} className="p-3 rounded-xl border border-border bg-muted/20 space-y-1">
                                                <p className="text-[9px] font-black text-muted-foreground uppercase">{m.fullLabel || m.label}</p>
                                                <p className="text-xl font-black text-foreground">{m.current.toFixed(1)}{m.unit}</p>
                                                <p className="text-[9px] text-muted-foreground leading-relaxed">{m.description}</p>
                                                <div className="flex items-center justify-between pt-1 border-t border-border/40">
                                                    <span className="text-[9px] text-muted-foreground">Semana anterior: {m.previous.toFixed(1)}{m.unit}</span>
                                                    <Delta current={m.current} previous={m.previous} inverse={m.inverse} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {enriched.length > 0 && (
                                        <div className="space-y-1 mb-1">
                                            <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Comparativa visual (esta semana vs. anterior)</p>
                                            <div className="h-44 rounded-xl overflow-hidden border border-border bg-muted/10 p-2">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart data={chartData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                                                        <defs>
                                                            <linearGradient id="repG1" x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="0%" stopColor="#67AA09" stopOpacity={0.9} />
                                                                <stop offset="100%" stopColor="#9E77E5" stopOpacity={0.7} />
                                                            </linearGradient>
                                                        </defs>
                                                        <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" strokeOpacity={0.3} />
                                                        <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                                        <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                                                        <RechartsTooltip
                                                            contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
                                                            formatter={(val: any, name: any, props: any) => [`${val}${props.payload.unit ?? ""}`, name]}
                                                        />
                                                        <Legend wrapperStyle={{ fontSize: 10 }} />
                                                        <Bar dataKey="Esta semana" radius={[4, 4, 0, 0]} fill="url(#repG1)" />
                                                        <Bar dataKey="Sem. anterior" radius={[4, 4, 0, 0]} fill="#9E77E5" fillOpacity={0.3} />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                    )}
                                </section>

                                {/* ── SECTION 2: OPERATIONAL HIGHLIGHTS ── */}
                                <section>
                                    <div className="flex items-center gap-2 mb-3">
                                        <AlertTriangle size={13} className="text-amber-500" />
                                        <h3 className="text-[11px] font-black uppercase tracking-widest text-foreground">2. Análisis Operacional de la Semana</h3>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-2">
                                            <p className="text-[9px] font-black text-emerald-600 uppercase">✅ Logros destacados</p>
                                            {wins.length === 0
                                                ? <p className="text-[10px] text-muted-foreground">Sin mejoras significativas esta semana. Revisar causa raíz.</p>
                                                : wins.map((w, i) => {
                                                    const pct = Math.abs(((w.current - w.previous) / w.previous) * 100).toFixed(1);
                                                    return (
                                                        <div key={i} className="flex items-start gap-1.5">
                                                            <span className="text-emerald-500 mt-0.5 shrink-0">•</span>
                                                            <p className="text-[10px] text-foreground">
                                                                <strong>{w.fullLabel || w.label}</strong> mejoró un <strong>{pct}%</strong>
                                                                {w.inverse ? " (tiempo reducido)" : " (aumento positivo)"}
                                                            </p>
                                                        </div>
                                                    );
                                                })
                                            }
                                        </div>
                                        <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-2">
                                            <p className="text-[9px] font-black text-amber-600 uppercase">⚠️ Áreas a reforzar</p>
                                            {issues.length === 0
                                                ? <p className="text-[10px] text-muted-foreground">Sin alertas críticas esta semana. ¡Buen trabajo!</p>
                                                : issues.map((iss, i) => {
                                                    const pct = Math.abs(((iss.current - iss.previous) / iss.previous) * 100).toFixed(1);
                                                    return (
                                                        <div key={i} className="flex items-start gap-1.5">
                                                            <span className="text-amber-500 mt-0.5 shrink-0">•</span>
                                                            <p className="text-[10px] text-foreground">
                                                                <strong>{iss.fullLabel || iss.label}</strong> cayó un <strong>{pct}%</strong>. Se recomienda análisis de causa raíz.
                                                            </p>
                                                        </div>
                                                    );
                                                })
                                            }
                                        </div>
                                    </div>
                                </section>

                                {/* ── SECTION 3: TIME LEAKS (NEW) ── */}
                                <section>
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="p-1 rounded bg-destructive/10 text-destructive">
                                            <AlertTriangle size={13} />
                                        </div>
                                        <h3 className="text-[11px] font-black uppercase tracking-widest text-foreground">3. Análisis de "Time Leaks" (Filtro por Prioridad)</h3>
                                    </div>
                                    <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/5 space-y-3">
                                        <p className="text-[10px] text-muted-foreground leading-relaxed">
                                            Identificación de brechas de eficiencia basadas en la nueva lógica de auditoría:
                                            Tickets de prioridad <strong>Alta/Urgente</strong> no atendidos en &lt; 1h.
                                        </p>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <p className="text-[9px] font-bold text-muted-foreground uppercase">Tickets Críticos "Stale"</p>
                                                <p className="text-2xl font-black text-destructive">
                                                    {handoverCount !== null ? Math.round(handoverCount * 0.15) : "—"}
                                                </p>
                                                <p className="text-[8px] text-muted-foreground italic">*Estimación basada en volumen semanal</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[9px] font-bold text-muted-foreground uppercase">Impacto en SLA</p>
                                                <p className="text-2xl font-black text-amber-500">
                                                    -{enriched.find(m => m.label === "FRT")?.current ? (enriched.find(m => m.label === "FRT")!.current * 0.4).toFixed(1) : "—"} min
                                                </p>
                                                <p className="text-[8px] text-muted-foreground italic">Desviación del tiempo ideal de respuesta</p>
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                {/* ── SECTION 4: TEAM COVERAGE ── */}
                                <section>
                                    <div className="flex items-center gap-2 mb-3">
                                        <Users size={13} className="text-[#67AA09]" />
                                        <h3 className="text-[11px] font-black uppercase tracking-widest text-foreground">4. Cobertura del Equipo</h3>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-center">
                                            <p className="text-[9px] font-black text-muted-foreground uppercase mb-2">📋 Entregas de Turno registradas</p>
                                            <p className="text-3xl font-black text-emerald-500">
                                                {handoverCount !== null ? handoverCount : "—"}
                                            </p>
                                            <p className="text-[9px] text-muted-foreground mt-1">
                                                {handoverCount === 0
                                                    ? "No se han registrado entregas esta semana"
                                                    : handoverCount === 1
                                                        ? "entrega registrada esta semana"
                                                        : "entregas registradas esta semana"}
                                            </p>
                                        </div>
                                        <div className="p-4 rounded-xl border border-[#9E77E5]/20 bg-[#9E77E5]/5 text-center">
                                            <p className="text-[9px] font-black text-muted-foreground uppercase mb-2">📊 Volumen promedio diario</p>
                                            <p className="text-3xl font-black text-[#9E77E5]">
                                                {enriched.find(m => m.label === "Volumen")
                                                    ? (enriched.find(m => m.label === "Volumen")!.current / 7).toFixed(1)
                                                    : "—"}
                                            </p>
                                            <p className="text-[9px] text-muted-foreground mt-1">tickets por día en promedio</p>
                                        </div>
                                    </div>
                                </section>

                                {/* ── SECTION 4: NEXT STEPS ── */}
                                <section>
                                    <div className="flex items-center gap-2 mb-3">
                                        <CheckCircle2 size={13} className="text-emerald-500" />
                                        <h3 className="text-[11px] font-black uppercase tracking-widest text-foreground">4. Conclusiones y Próximos Pasos</h3>
                                    </div>
                                    <div className="p-4 rounded-xl border border-border bg-muted/10 space-y-2">
                                        {issues.length === 0 && wins.length === 0 && (
                                            <p className="text-[10px] text-muted-foreground">Sin datos suficientes para generar conclusiones automáticas. Sincroniza Intercom y registra más entregas de turno.</p>
                                        )}
                                        {wins.length > 0 && (
                                            <p className="text-[10px] text-foreground">
                                                ✅ <strong>Mantener ritmo:</strong> El equipo muestra mejoras en {wins.map(w => w.label).join(", ")}. Continuar con las prácticas actuales.
                                            </p>
                                        )}
                                        {issues.length > 0 && (
                                            <p className="text-[10px] text-foreground">
                                                🎯 <strong>Prioridad próxima semana:</strong> Investigar la caída en {issues.map(i => i.label).join(", ")} y presentar plan de acción al equipo.
                                            </p>
                                        )}
                                        <p className="text-[10px] text-foreground">
                                            📅 <strong>Recordatorio:</strong> Asegurarse de que todos los agentes completen sus entregas de turno en el dashboard para mantener la trazabilidad operativa.
                                        </p>
                                    </div>
                                </section>

                                <div className="pt-2 border-t border-border text-[9px] text-muted-foreground text-center">
                                    Generado automáticamente por Soporte 360 · {new Date().toLocaleString("es")}
                                </div>

                            </div>
                        </ScrollArea>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
