"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    ShieldAlert, Clock, RefreshCw, ExternalLink,
    AlertOctagon, Star, Zap, Users
} from "lucide-react";
import { toast } from "sonner";
import type { RedFlagTicket } from "@/lib/auditActions";

interface FocusAuditProps {
    initialTickets?: RedFlagTicket[];
}

const FLAG_STYLES: Record<RedFlagTicket["flag"], { label: string; color: string; icon: any }> = {
    stale: { label: "Sin actualización > 4h", color: "bg-alert/10 text-alert border-alert/20", icon: Clock },
    waiting: { label: "Esperando respuesta", color: "bg-destructive/10 text-destructive border-destructive/20", icon: AlertOctagon },
    reopened: { label: "Reabierto", color: "bg-secondary/10 text-secondary border-secondary/20", icon: RefreshCw },
};

const PRIORITY_BADGE: Record<string, string> = {
    urgent: "bg-critical text-critical-foreground border-none",
    high: "bg-alert text-alert-foreground border-none",
    normal: "bg-muted text-muted-foreground",
    low: "bg-muted text-muted-foreground",
};

export function FocusAudit({ initialTickets = [] }: FocusAuditProps) {
    const [tickets, setTickets] = useState<RedFlagTicket[]>(initialTickets);
    const [loading, setLoading] = useState(false);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

    // Fire VIP alerts on load
    useEffect(() => {
        const vipTickets = tickets.filter(t => t.isVip);
        vipTickets.forEach(t => {
            toast.warning(`🚨 Ticket VIP en Red Flag: ${t.subject}`, {
                description: `Cliente: ${t.client ?? "—"} · Sin actualización: ${t.staleHours}h`,
                duration: 8000,
                action: {
                    label: "Ver en Intercom",
                    onClick: () => window.open(t.intercomUrl, "_blank"),
                },
            });
        });
    }, []);  // only on mount

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const resp = await fetch("/api/audit/red-flags");
            if (resp.ok) {
                const data: RedFlagTicket[] = await resp.json();
                const newVip = data.filter(t =>
                    t.isVip && !tickets.some(old => old.id === t.id)
                );
                newVip.forEach(t => {
                    toast.warning(`🚨 Nuevo Red Flag VIP: ${t.subject}`, {
                        description: `Sin actualización: ${t.staleHours}h`,
                        duration: 8000,
                        action: {
                            label: "Abrir",
                            onClick: () => window.open(t.intercomUrl, "_blank"),
                        },
                    });
                });
                setTickets(data);
                setLastRefresh(new Date());
                toast.success(`Auditoría actualizada — ${data.length} tickets en revisión`);
            }
        } catch {
            toast.error("No se pudo actualizar la auditoría");
        } finally {
            setLoading(false);
        }
    }, [tickets]);

    const vipCount = tickets.filter(t => t.isVip).length;

    return (
        <Card className="card-neumorphic border-none">
            <CardHeader className="pb-3 px-5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-xl bg-[#9E77E5]/10 flex items-center justify-center">
                            <ShieldAlert size={13} className="text-[#9E77E5]" />
                        </div>
                        <div>
                            <CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-tight text-[#9E77E5]">
                                Foco de Auditoría
                                {tickets.length > 0 && (
                                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#9E77E5] text-white text-[8px] font-black">
                                        {tickets.length}
                                    </span>
                                )}
                            </CardTitle>
                            <p className="text-[9px] text-muted-foreground">
                                Tickets que necesitan atención inmediata
                                {vipCount > 0 && (
                                    <span className="ml-1 text-amber-500 font-bold">· {vipCount} VIP activos</span>
                                )}
                            </p>
                        </div>
                    </div>
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-[9px] px-2 gap-1 border-[#9E77E5]/30 text-[#9E77E5] hover:bg-[#9E77E5]/10"
                        onClick={refresh}
                        disabled={loading}
                    >
                        <RefreshCw size={9} className={loading ? "animate-spin" : ""} />
                        Actualizar
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="px-5 pb-5">
                {tickets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 gap-2">
                        <Zap size={20} className="text-[#67AA09]" />
                        <p className="text-[11px] text-muted-foreground font-medium">✅ Sin tickets en estado crítico</p>
                        <p className="text-[9px] text-muted-foreground">Todos los tickets están siendo atendidos a tiempo</p>
                    </div>
                ) : (
                    <div className="space-y-2 max-h-[320px] overflow-y-auto scrollbar-hide pr-1">
                        {tickets.map((t) => {
                            const flagInfo = FLAG_STYLES[t.flag];
                            const FlagIcon = flagInfo.icon;
                            const isCritical = t.isVip || t.priority === 'urgent' || t.flag === 'waiting';
                            return (
                                <div
                                    key={t.id}
                                    className={`p-3 rounded-md border ${isCritical ? "border-critical/20 bg-gradient-to-r from-critical/10 to-transparent" : "border-border bg-card"} space-y-1.5 transition-all duration-75 hover:border-signal/50`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            {t.isVip ? <Star size={9} className="text-alert shrink-0 fill-current" /> : null}
                                            <p className="text-[10px] font-bold text-foreground truncate">{t.subject}</p>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            {t.priority ? (
                                                <Badge className={`text-[7px] h-4 px-1.5 ${PRIORITY_BADGE[t.priority] ?? PRIORITY_BADGE.normal}`}>
                                                    {t.priority.toUpperCase()}
                                                </Badge>
                                            ) : null}
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-5 w-5 text-muted-foreground hover:text-[#9E77E5] hover:bg-[#9E77E5]/10"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toast.info("Reasignar ticket (Mock)", { description: "Conectando con Intercom..." });
                                                }}
                                            >
                                                <Users size={9} />
                                            </Button>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-5 w-5 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toast.info("Cerrar ticket (Mock)", { description: "Conectando con Intercom..." });
                                                }}
                                            >
                                                <Zap size={9} />
                                            </Button>
                                            <a
                                                href={t.intercomUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-[#9E77E5] hover:text-[#9E77E5]/70 transition-colors"
                                                onClick={e => e.stopPropagation()}
                                            >
                                                <ExternalLink size={10} />
                                            </a>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 text-[8px] text-muted-foreground">
                                        <span className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded border ${flagInfo.color}`}>
                                            <FlagIcon size={8} />
                                            {flagInfo.label}
                                        </span>
                                        <span className="flex items-center gap-0.5">
                                            <Clock size={8} />
                                            {t.staleHours}h sin actualización
                                        </span>
                                        {t.client ? <span className="truncate max-w-[80px]">{t.client}</span> : null}
                                        {t.teammateName ? <span className="text-[#9E77E5]">@{t.teammateName}</span> : null}
                                    </div>
                                    {(t.ticketType || t.module) && (
                                        <div className="flex gap-1">
                                            {t.ticketType && (
                                                <Badge className="text-[7px] h-4 px-1.5 bg-muted text-muted-foreground border-none">{t.ticketType}</Badge>
                                            )}
                                            {t.module && (
                                                <Badge className="text-[7px] h-4 px-1.5 bg-[#9E77E5]/10 text-[#9E77E5] border-none">{t.module}</Badge>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        <p className="text-[8px] text-muted-foreground text-right pt-1">
                            Última revisión: {lastRefresh.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
