"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Target, Zap, Users, ArrowRight } from "lucide-react";

interface OKR {
    objective: string;         // Human-readable goal
    kpi: string;               // Metric description
    current: number;           // Current real value
    target: number;            // Goal value
    progress: number;          // 0-100 manual or computed
    unit: string;
    inverse?: boolean;         // lower is better (e.g. TTR)
    trend?: "up" | "down" | "flat";
    trendLabel?: string;
}

interface IntercomMetric {
    date: string;
    totalVolume: number;
    avgFirstResponseTime: number;
    avgResolutionTime?: number;
    csatAverage?: number;
}

interface StrategicRoadmapProps {
    metrics?: IntercomMetric[];      // live Intercom data
    prevMetrics?: IntercomMetric[];  // previous period for trend
}

// ── Static OKRs (enriched with live data in the component) ──────────────────
const BASE_OKRS: OKR[] = [
    {
        objective: "Eficiencia de Respuesta",
        kpi: "Reducir TTR un 15% mensual",
        current: 4.2,
        target: 3.5,
        progress: 62,
        unit: "h",
        inverse: true,
        trend: "down",
        trendLabel: "−8% vs mes anterior",
    },
    {
        objective: "Autogestión (Deflection)",
        kpi: "Aumentar solución vía Centro de Ayuda al 30%",
        current: 12,
        target: 30,
        progress: 45,
        unit: "%",
        trend: "up",
        trendLabel: "+3pp este mes",
    },
    {
        objective: "Calidad de Servicio (CSAT)",
        kpi: "Mantener CSAT > 95%",
        current: 92,
        target: 96,
        progress: 88,
        unit: "%",
        trend: "up",
        trendLabel: "+2pp vs semana anterior",
    },
];

const OKR_ICONS = [Target, Zap, Users];

function ProgressBar({ progress, inverse }: { progress: number; inverse?: boolean }) {
    // Color logic: green ≥ 80%, purple 50-79%, red < 50%
    const color =
        progress >= 80 ? "#67AA09" :
            progress >= 50 ? "#9E77E5" :
                "#ef4444";

    return (
        <div className="relative h-2.5 bg-muted rounded-full overflow-hidden">
            <div
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                style={{ width: `${Math.min(100, progress)}%`, background: `linear-gradient(90deg, ${color}cc, ${color})` }}
            />
            {/* Target marker at 100% */}
            <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-foreground/20 rounded" />
        </div>
    );
}

export function StrategicRoadmap({ metrics = [], prevMetrics = [] }: StrategicRoadmapProps) {
    // Enrich CSAT OKR with live Intercom data if available
    const enrichedOkrs = BASE_OKRS.map((okr, i) => {
        if (i === 2 && metrics.length > 0) {
            const liveCsat = metrics.filter(m => m.csatAverage).reduce((s, m) => s + (m.csatAverage || 0), 0)
                / (metrics.filter(m => m.csatAverage).length || 1);
            if (liveCsat > 0) {
                const prevCsat = prevMetrics.filter(m => m.csatAverage).reduce((s, m) => s + (m.csatAverage || 0), 0)
                    / (prevMetrics.filter(m => m.csatAverage).length || 1);
                const diff = prevCsat > 0 ? ((liveCsat - prevCsat) / prevCsat) * 100 : 0;
                return {
                    ...okr,
                    current: parseFloat(liveCsat.toFixed(1)),
                    progress: Math.round((liveCsat / okr.target) * 100),
                    trend: diff > 0 ? "up" as const : diff < 0 ? "down" as const : "flat" as const,
                    trendLabel: diff !== 0 ? `${diff > 0 ? "+" : ""}${diff.toFixed(1)}% vs período anterior` : "Sin cambio",
                };
            }
        }
        return okr;
    });

    const overallProgress = Math.round(enrichedOkrs.reduce((s, o) => s + o.progress, 0) / enrichedOkrs.length);

    return (
        <Card className="card-neumorphic border-none">
            <CardHeader className="pb-3 px-5">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-tight">
                            <Target size={14} className="text-[#9E77E5]" />
                            Roadmap · OKRs Estratégicos
                        </CardTitle>
                        <CardDescription className="text-[11px] mt-0.5">Objetivos clave del trimestre · Datos reales Intercom</CardDescription>
                    </div>
                    <div className="text-right">
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Progreso global</p>
                        <span className={`text-xl font-black ${overallProgress >= 80 ? "text-[#67AA09]" : overallProgress >= 50 ? "text-[#9E77E5]" : "text-destructive"}`}>
                            {overallProgress}%
                        </span>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="px-5 pb-5 space-y-5">
                {enrichedOkrs.map((okr, i) => {
                    const Icon = OKR_ICONS[i];
                    const statusColor = okr.progress >= 80 ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
                        : okr.progress >= 50 ? "text-[#9E77E5] bg-[#9E77E5]/10 border-[#9E77E5]/20"
                            : "text-destructive bg-destructive/10 border-destructive/20";
                    const statusLabel = okr.progress >= 80 ? "En camino" : okr.progress >= 50 ? "Progresando" : "En riesgo";

                    return (
                        <div key={i} className="p-4 rounded-2xl border border-border bg-muted/10 space-y-3 hover:bg-muted/20 transition-colors">
                            {/* Header row */}
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-xl bg-[#9E77E5]/10 flex items-center justify-center shrink-0">
                                        <Icon size={13} className="text-[#9E77E5]" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-black text-foreground leading-tight">{okr.objective}</p>
                                        <p className="text-[9px] text-muted-foreground mt-0.5">{okr.kpi}</p>
                                    </div>
                                </div>
                                <Badge className={`text-[8px] h-5 px-2 border shrink-0 ${statusColor}`}>{statusLabel}</Badge>
                            </div>

                            {/* Progress bar */}
                            <ProgressBar progress={okr.progress} inverse={okr.inverse} />

                            {/* Footer row */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 text-[9px] text-muted-foreground">
                                    <span className="font-bold text-foreground">
                                        {okr.inverse ? "Actual:" : "Actual:"} {okr.current}{okr.unit}
                                    </span>
                                    <ArrowRight size={9} />
                                    <span>Meta: {okr.target}{okr.unit}</span>
                                </div>
                                {okr.trend && (
                                    <span className={`flex items-center gap-0.5 text-[9px] font-bold ${okr.trend === "up" ? "text-emerald-500" : okr.trend === "down" && okr.inverse ? "text-emerald-500" : "text-destructive"}`}>
                                        {(okr.trend === "up" && !okr.inverse) || (okr.trend === "down" && okr.inverse)
                                            ? <TrendingUp size={9} />
                                            : <TrendingDown size={9} />}
                                        {okr.trendLabel}
                                    </span>
                                )}
                            </div>

                            {/* Progress percentage */}
                            <div className="flex items-center justify-between text-[9px]">
                                <span className="text-muted-foreground">{okr.progress}% del objetivo completado</span>
                                <span className="text-muted-foreground">{Math.max(0, 100 - okr.progress)}% restante</span>
                            </div>
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
}
