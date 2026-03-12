"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Users, Filter, ExternalLink, TrendingDown,
    Clock, Bug, Headphones, AlertTriangle, ChevronRight
} from "lucide-react";
import Link from "next/link";
import type { ClientRow } from "@/lib/clientIntelActions";

interface CustomerSupportBreakdownProps {
    clients: ClientRow[];
    received?: number;
    solved?: number;
    efficiency?: number;
}

const COUNTRIES = ["Todos", "Colombia", "Chile", "México", "Perú", "EEUU", "Otro"];

const INTERCOM_APP_ID = "msxvtmeq";

function intercomUrl(ticketId: string | null) {
    if (!ticketId) return null;
    return `https://app.intercom.com/a/apps/${INTERCOM_APP_ID}/conversations/${ticketId}`;
}

export function CustomerSupportBreakdown({
    clients,
    received = 0,
    solved = 0,
    efficiency = 0,
}: CustomerSupportBreakdownProps) {
    const [countryFilter, setCountryFilter] = useState("Todos");
    const [sortKey, setSortKey] = useState<keyof ClientRow>("total");

    const filtered = useMemo(() => {
        let rows = countryFilter === "Todos"
            ? clients
            : clients.filter(c => c.country === countryFilter);
        return [...rows].sort((a, b) => (b[sortKey] as number) - (a[sortKey] as number));
    }, [clients, countryFilter, sortKey]);

    const columns: Array<{ key: keyof ClientRow; label: string; icon: any; color: string; tip: string }> = [
        { key: "total", label: "Total", icon: Headphones, color: "text-foreground", tip: "Todos los tickets del período" },
        { key: "open", label: "Abiertos", icon: Clock, color: "text-amber-500", tip: "Tickets pendientes de resolución" },
        { key: "closed", label: "Cerrados", icon: TrendingDown, color: "text-emerald-500", tip: "Tickets resueltos" },
        { key: "consultas", label: "Consultas", icon: Headphones, color: "text-blue-400", tip: "Consultas generales / primer nivel" },
        { key: "escalaciones", label: "Escalamientos", icon: AlertTriangle, color: "text-amber-600", tip: "Tickets técnicos o escalados" },
        { key: "bugs", label: "Bugs", icon: Bug, color: "text-destructive", tip: "Tickets tipo Bug / Error reportado" },
        { key: "stale9", label: ">9 días", icon: Clock, color: "text-orange-400", tip: "Sin resolución por más de 9 días" },
        { key: "stale15", label: ">15 días", icon: AlertTriangle, color: "text-destructive", tip: "Sin resolución por más de 15 días — Crítico" },
    ];

    return (
        <Card className="card-neumorphic border-none">
            <CardHeader className="pb-3 px-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-xl bg-[#9E77E5]/10 flex items-center justify-center">
                            <Users size={13} className="text-[#9E77E5]" />
                        </div>
                        <div>
                            <CardTitle className="text-sm font-black uppercase tracking-tight">
                                Tickets por Cliente (CS View)
                            </CardTitle>
                            <p className="text-[9px] text-muted-foreground">Datos del período sincronizado · Agrupa por cuenta Intercom</p>
                        </div>
                    </div>

                    {/* Efficiency KPI */}
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl border border-[#67AA09]/20 bg-[#67AA09]/5 text-center min-w-[90px]">
                            <p className="text-[8px] text-muted-foreground uppercase font-bold">Eficiencia semanal</p>
                            <p className="text-lg font-black text-[#67AA09]">{efficiency}%</p>
                            <p className="text-[8px] text-muted-foreground">{solved}/{received} resueltos</p>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <Filter size={10} className="text-muted-foreground" />
                    {COUNTRIES.map(c => (
                        <Button
                            key={c}
                            size="sm"
                            variant={countryFilter === c ? "default" : "outline"}
                            className={`h-5 text-[9px] px-2 rounded-full ${countryFilter === c ? "bg-[#9E77E5] text-white border-none" : "border-border/50"}`}
                            onClick={() => setCountryFilter(c)}
                        >
                            {c}
                        </Button>
                    ))}
                </div>
            </CardHeader>

            <CardContent className="px-5 pb-5 overflow-x-auto">
                {filtered.length === 0 ? (
                    <div className="py-8 text-center">
                        <p className="text-[11px] text-muted-foreground italic">
                            Sin datos de cliente. Sincroniza Intercom para poblar esta vista.
                        </p>
                        <p className="text-[9px] text-muted-foreground mt-1">
                            El campo "Clientes" debe estar configurado como atributo personalizado en Intercom.
                        </p>
                    </div>
                ) : (
                    <table className="w-full text-[10px] min-w-[640px]">
                        <thead>
                            <tr className="border-b border-border/40">
                                <th className="text-left py-2 pr-3 font-black text-muted-foreground uppercase tracking-wider text-[8px]">Cliente</th>
                                {columns.map(col => (
                                    <th
                                        key={col.key}
                                        className={`text-center py-2 px-2 font-black text-muted-foreground uppercase tracking-wider text-[8px] cursor-pointer hover:text-foreground transition-colors ${sortKey === col.key ? "text-[#9E77E5]" : ""}`}
                                        onClick={() => setSortKey(col.key)}
                                        title={col.tip}
                                    >
                                        <span className="flex flex-col items-center gap-0.5">
                                            <col.icon size={9} />
                                            {col.label}
                                        </span>
                                    </th>
                                ))}
                                <th className="text-center py-2 px-2 text-[8px] text-muted-foreground">↗</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20">
                            {filtered.map(row => {
                                const url = intercomUrl(row.latestTicketId);
                                const isCritical = row.stale15 > 0 || row.bugs >= 3;
                                return (
                                    <tr
                                        key={row.client}
                                        className={`hover:bg-muted/20 transition-colors ${isCritical ? "bg-destructive/4" : ""}`}
                                    >
                                        <td className="py-2.5 pr-3">
                                            <Link
                                                href={`/clients/${encodeURIComponent(row.client)}`}
                                                className="flex items-center gap-2 group"
                                            >
                                                <div className="w-6 h-6 rounded-lg bg-[#9E77E5]/10 flex items-center justify-center text-[10px]">
                                                    {row.flag}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-foreground leading-none group-hover:text-[#9E77E5] transition-colors flex items-center gap-1">
                                                        {row.client}
                                                        <ChevronRight size={9} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    </p>
                                                    <p className="text-[8px] text-muted-foreground">{row.country}</p>
                                                </div>
                                                {isCritical && (
                                                    <AlertTriangle size={9} className="text-destructive" />
                                                )}
                                            </Link>
                                        </td>

                                        {/* Total */}
                                        <td className="text-center px-2">
                                            <span className="font-black text-foreground">{row.total}</span>
                                        </td>
                                        {/* Open */}
                                        <td className="text-center px-2">
                                            <span className={`font-bold ${row.open > 0 ? "text-amber-500" : "text-muted-foreground"}`}>{row.open}</span>
                                        </td>
                                        {/* Closed */}
                                        <td className="text-center px-2">
                                            <span className="font-bold text-emerald-500">{row.closed}</span>
                                        </td>
                                        {/* Consultas */}
                                        <td className="text-center px-2">
                                            <span className="text-blue-400 font-medium">{row.consultas}</span>
                                        </td>
                                        {/* Escalaciones */}
                                        <td className="text-center px-2">
                                            <span className={`font-medium ${row.escalaciones > 5 ? "text-amber-600 font-bold" : "text-muted-foreground"}`}>{row.escalaciones}</span>
                                        </td>
                                        {/* Bugs */}
                                        <td className="text-center px-2">
                                            <span className={`font-bold ${row.bugs >= 3 ? "text-destructive" : row.bugs > 0 ? "text-orange-400" : "text-muted-foreground"}`}>
                                                {row.bugs}
                                                {row.bugs >= 3 && " ⚠️"}
                                            </span>
                                        </td>
                                        {/* Stale 9d */}
                                        <td className="text-center px-2">
                                            <span className={`font-medium ${row.stale9 > 0 ? "text-orange-400 font-bold" : "text-muted-foreground"}`}>{row.stale9}</span>
                                        </td>
                                        {/* Stale 15d */}
                                        <td className="text-center px-2">
                                            <span className={`font-bold ${row.stale15 > 0 ? "text-destructive" : "text-muted-foreground"}`}>{row.stale15}</span>
                                        </td>

                                        {/* Intercom link */}
                                        <td className="text-center px-2">
                                            {url ? (
                                                <a href={url} target="_blank" rel="noopener noreferrer" className="text-[#9E77E5] hover:opacity-70 transition-opacity">
                                                    <ExternalLink size={10} />
                                                </a>
                                            ) : (
                                                <span className="text-muted-foreground/30">—</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}

                <p className="text-[8px] text-muted-foreground mt-3">
                    💡 Haz clic en el <strong>nombre del cliente</strong> para abrir su auditoría individual. Haz clic en los encabezados para ordenar. ⚠️ = Cuenta crítica.
                </p>
            </CardContent>
        </Card>
    );
}
