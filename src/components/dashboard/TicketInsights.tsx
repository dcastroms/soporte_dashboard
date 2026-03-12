"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip,
    ResponsiveContainer, Cell
} from "recharts";
import { BarChart2, Info } from "lucide-react";
import type { TicketTypeInsight } from "@/lib/auditActions";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface TicketInsightsProps {
    insights: TicketTypeInsight[];
    reopenRate?: number;
    reopenAlert?: boolean;
}

const COLORS = ["#9E77E5", "#67AA09", "#3b82f6", "#f59e0b", "#ef4444", "#06b6d4"];

const CATEGORY_LABEL: Record<string, string> = {
    Type: "Tipo de Ticket",
    Module: "Módulo del Producto",
    Client: "Cliente",
};

function InfoTooltip({ text }: { text: string }) {
    return (
        <TooltipProvider delayDuration={200}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Info size={10} className="text-muted-foreground cursor-help inline-block ml-1 shrink-0" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-[220px] text-[10px]">
                    {text}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

export { InfoTooltip };

export function TicketInsights({ insights, reopenRate = 0, reopenAlert = false }: TicketInsightsProps) {
    // Group by category
    const byCategory = insights.reduce<Record<string, TicketTypeInsight[]>>((acc, ins) => {
        if (!acc[ins.category]) acc[ins.category] = [];
        acc[ins.category].push(ins);
        return acc;
    }, {});

    const hasData = insights.length > 0;

    return (
        <Card className="card-neumorphic border-none">
            <CardHeader className="pb-3 px-5">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-tight">
                        <BarChart2 size={14} className="text-[#9E77E5]" />
                        Insights de Tickets
                        <InfoTooltip text="Distribución del volumen por tipo de ticket y módulo del producto. Identifica qué categorías generan más carga operativa." />
                    </CardTitle>

                    {/* Reopen Rate badge */}
                    <div className="flex items-center gap-1.5">
                        <span className="text-[9px] text-muted-foreground">Tasa de reapertura</span>
                        <Badge
                            className={`text-[9px] h-5 px-2 border ${reopenAlert
                                    ? "bg-destructive/15 text-destructive border-destructive/20"
                                    : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                }`}
                        >
                            {reopenRate.toFixed(1)}%
                            {reopenAlert && " ⚠️"}
                        </Badge>
                        <InfoTooltip text="% de tickets actualmente abiertos que llevan más de 24h en ese estado (proxy de re-apertura). Si supera el 10% se marca como alerta." />
                    </div>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                    Volumen por categoría · Últimos 30 días sincronizados
                </p>
            </CardHeader>

            <CardContent className="px-5 pb-5 space-y-5">
                {!hasData ? (
                    <div className="py-6 text-center">
                        <p className="text-[11px] text-muted-foreground italic">Sincroniza Intercom para ver los insights por tipo de ticket y módulo.</p>
                    </div>
                ) : (
                    Object.entries(byCategory).map(([category, items]) => (
                        <div key={category} className="space-y-2">
                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                                {CATEGORY_LABEL[category] ?? category}
                            </p>
                            <div className="h-28">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={items.slice(0, 6)}
                                        layout="vertical"
                                        margin={{ top: 0, right: 24, left: 0, bottom: 0 }}
                                    >
                                        <XAxis type="number" tick={{ fontSize: 8 }} axisLine={false} tickLine={false} unit="%" domain={[0, 100]} />
                                        <YAxis
                                            type="category"
                                            dataKey="type"
                                            tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }}
                                            axisLine={false}
                                            tickLine={false}
                                            width={90}
                                            tickFormatter={(v: string) => v.length > 14 ? v.slice(0, 13) + "…" : v}
                                        />
                                        <RechartsTooltip
                                            contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 10 }}
                                            formatter={(val: any, _name: any, props: any) => [
                                                `${val}% (${props.payload.count} tickets)`,
                                                "Volumen"
                                            ]}
                                        />
                                        <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
                                            {items.slice(0, 6).map((_, i) => (
                                                <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.85} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Top insight callout */}
                            {items[0] && (
                                <p className="text-[9px] text-muted-foreground px-1">
                                    📌 <strong>{items[0].type}</strong> genera el <strong className="text-[#9E77E5]">{items[0].pct}%</strong> del volumen total de {CATEGORY_LABEL[category]?.toLowerCase() ?? category}.
                                    {items[0].pct > 40 && (
                                        <span className="text-amber-600"> Alta concentración — revisar si requiere macro o automatización.</span>
                                    )}
                                </p>
                            )}
                        </div>
                    ))
                )}
            </CardContent>
        </Card>
    );
}
