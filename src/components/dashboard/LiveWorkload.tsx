"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAllOpenConversations } from "@/lib/intercom";
import { RefreshCw, AlertTriangle, MessageCircle, Star, ExternalLink, Clock } from "lucide-react";
import { formatSeconds } from "@/lib/utils";
import Link from "next/link";

interface Ticket {
    id: string;
    subject: string;
    url: string;
    assignee: string;
    client?: string | null;
    tags?: string[];
    isVip?: boolean;
    priority?: string | null;
    createdAt?: string | null;
}

interface AgentLoad {
    name: string;
    count: number;
    tickets: Ticket[];
}

const SLA_WARN_SECONDS = 4 * 60 * 60; // 4 hours — tickets older than this are close to SLA breach
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

function SlaCountdown({ createdAt }: { createdAt: string }) {
    const slaDeadline = new Date(new Date(createdAt).getTime() + SLA_WARN_SECONDS * 1000);
    const secondsLeft = Math.floor((slaDeadline.getTime() - Date.now()) / 1000);

    if (secondsLeft > 600) return null; // Only show when < 10 minutes remain

    if (secondsLeft <= 0) {
        return (
            <span className="text-[9px] font-black text-destructive bg-destructive/10 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                <Clock size={8} /> SLA BREACH
            </span>
        );
    }

    return (
        <span className="text-[9px] font-black text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded flex items-center gap-0.5">
            <Clock size={8} /> {formatSeconds(secondsLeft)}
        </span>
    );
}

export function LiveWorkload({ saturationLimit = 5 }: { saturationLimit?: number }) {
    const [agentLoads, setAgentLoads] = useState<AgentLoad[]>([]);
    const [unassigned, setUnassigned] = useState<Ticket[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const tickets = await getAllOpenConversations() as Ticket[];
            const agentMap: Record<string, Ticket[]> = {};
            const unassignedTickets: Ticket[] = [];

            tickets.forEach((t) => {
                if (!t.assignee || t.assignee === "Sin asignar") {
                    unassignedTickets.push(t);
                } else {
                    if (!agentMap[t.assignee]) agentMap[t.assignee] = [];
                    agentMap[t.assignee].push(t);
                }
            });

            const loads: AgentLoad[] = Object.entries(agentMap)
                .map(([name, agentTickets]) => ({ name, count: agentTickets.length, tickets: agentTickets }))
                .sort((a, b) => b.count - a.count);

            setAgentLoads(loads);
            setUnassigned(unassignedTickets);
            setLastUpdated(new Date());
        } catch (error) {
            console.error("Error fetching live workload:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, REFRESH_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [fetchData]);

    const totalOpen = agentLoads.reduce((acc, a) => acc + a.count, 0) + unassigned.length;
    const vipCount = agentLoads.flatMap(a => a.tickets).filter(t => t.isVip).length + unassigned.filter(t => t.isVip).length;

    const AgentCard = ({ agent }: { agent: AgentLoad }) => {
        const isOverloaded = agent.count >= saturationLimit;
        const initials = agent.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
        const isExpanded = expandedAgent === agent.name;
        const hasVip = agent.tickets.some(t => t.isVip);

        return (
            <div className="col-span-1">
                <button
                    onClick={() => setExpandedAgent(isExpanded ? null : agent.name)}
                    className={`w-full relative flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all duration-300
            ${isOverloaded
                            ? "border-destructive/50 bg-destructive/5 shadow-md shadow-destructive/10"
                            : hasVip
                                ? "border-[#9E77E5]/40 bg-[#9E77E5]/8"
                                : "border-[#9E77E5]/20 bg-[#9E77E5]/5 hover:bg-[#9E77E5]/10"
                        }`}
                >
                    <div className={`h-9 w-9 rounded-full flex items-center justify-center text-[11px] font-black border-2 transition-colors
            ${isOverloaded
                            ? "bg-destructive/15 border-destructive/40 text-destructive"
                            : "bg-[#9E77E5]/15 border-[#9E77E5]/30 text-[#9E77E5]"
                        }`}
                    >
                        {initials}
                    </div>
                    <div className={`text-2xl font-black leading-none ${isOverloaded ? "text-destructive" : "text-[#9E77E5]"}`}>
                        {agent.count}
                    </div>
                    <p className="text-[9px] font-bold text-foreground uppercase tracking-tight truncate w-full text-center">
                        {agent.name.split(' ')[0]}
                    </p>
                    {hasVip && !isOverloaded && (
                        <Star size={9} className="text-[#9E77E5] absolute top-1.5 right-1.5" />
                    )}
                    {isOverloaded && (
                        <div className="absolute -top-1.5 -right-1.5">
                            <div className="h-3 w-3 rounded-full bg-destructive animate-ping opacity-75 absolute" />
                            <div className="h-3 w-3 rounded-full bg-destructive" />
                        </div>
                    )}
                </button>

                {/* Expanded ticket list */}
                {isExpanded && (
                    <div className="mt-2 space-y-1.5 animate-in slide-in-from-top-1">
                        {agent.tickets.map((ticket) => (
                            <div
                                key={ticket.id}
                                className={`flex items-start justify-between gap-2 p-2 rounded-lg border text-[10px] transition-colors
                  ${ticket.isVip
                                        ? "border-[#9E77E5]/40 bg-[#9E77E5]/5"
                                        : "border-border bg-muted/20"
                                    }`}
                            >
                                <div className="min-w-0 space-y-0.5">
                                    <div className="flex items-center gap-1.5">
                                        {ticket.isVip && <Star size={9} className="text-[#9E77E5] shrink-0" />}
                                        <p className="font-semibold text-foreground truncate">{ticket.subject}</p>
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        {ticket.client && (
                                            <Badge className="text-[8px] h-4 px-1 bg-[#9E77E5]/15 text-[#9E77E5] border-[#9E77E5]/20 font-bold">
                                                {ticket.client}
                                            </Badge>
                                        )}
                                        {ticket.createdAt && <SlaCountdown createdAt={ticket.createdAt} />}
                                    </div>
                                </div>
                                <Link href={ticket.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-muted-foreground hover:text-foreground">
                                    <ExternalLink size={11} />
                                </Link>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <Card className="card-neumorphic border-none bg-card">
            <CardHeader className="pb-3 px-4">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-sm font-bold text-foreground uppercase tracking-tight">
                            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                            Live Workload
                        </CardTitle>
                        <CardDescription className="text-[11px] text-muted-foreground">
                            Agentes en vivo · alerta en ≥{saturationLimit} tickets
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        {vipCount > 0 && (
                            <Badge className="text-[9px] font-bold bg-[#9E77E5]/15 text-[#9E77E5] border-[#9E77E5]/20 px-1.5">
                                <Star size={9} className="mr-0.5" />
                                {vipCount} VIP
                            </Badge>
                        )}
                        <Badge className="bg-foreground/10 text-foreground border-none text-[10px] px-2 font-bold">
                            {totalOpen} abiertos
                        </Badge>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fetchData} disabled={isLoading}>
                            <RefreshCw size={12} className={isLoading ? "animate-spin text-muted-foreground" : "text-muted-foreground"} />
                        </Button>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="px-4 pb-4">
                {isLoading && agentLoads.length === 0 ? (
                    <div className="flex flex-col items-center py-8 gap-2">
                        <RefreshCw size={20} className="animate-spin text-muted-foreground" />
                        <p className="text-[11px] text-muted-foreground">Consultando Intercom...</p>
                    </div>
                ) : agentLoads.length === 0 && unassigned.length === 0 ? (
                    <div className="flex flex-col items-center py-8 gap-2 text-center">
                        <MessageCircle size={22} className="text-emerald-500" />
                        <p className="text-[11px] text-foreground font-bold">¡Sin tickets abiertos!</p>
                        <p className="text-[10px] text-muted-foreground max-w-[180px]">
                            El equipo está al día. Aprovecha para revisar el backlog o documentar.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        <div className="grid grid-cols-3 gap-2">
                            {agentLoads.map((agent) => (
                                <AgentCard key={agent.name} agent={agent} />
                            ))}
                        </div>

                        {unassigned.length > 0 && (
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/5">
                                    <div className="flex items-center gap-2">
                                        <AlertTriangle size={14} className="text-amber-500" />
                                        <span className="text-[11px] font-bold text-foreground">Sin asignar</span>
                                    </div>
                                    <Badge className="text-[10px] font-black bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30">
                                        {unassigned.length} tickets
                                    </Badge>
                                </div>
                                {unassigned.slice(0, 3).map(ticket => (
                                    <div key={ticket.id} className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg border border-amber-500/20 bg-amber-500/5 text-[10px]">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            {ticket.isVip && <Star size={9} className="text-[#9E77E5] shrink-0" />}
                                            {ticket.client && (
                                                <Badge className="text-[8px] h-4 px-1 bg-[#9E77E5]/15 text-[#9E77E5] border-none shrink-0">
                                                    {ticket.client}
                                                </Badge>
                                            )}
                                            <span className="text-foreground/80 truncate">{ticket.subject}</span>
                                        </div>
                                        <Link href={ticket.url} target="_blank" className="shrink-0 text-muted-foreground hover:text-foreground">
                                            <ExternalLink size={10} />
                                        </Link>
                                    </div>
                                ))}
                            </div>
                        )}

                        {lastUpdated && (
                            <p className="text-[9px] text-muted-foreground text-right pt-1">
                                Actualizado: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
