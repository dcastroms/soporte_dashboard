"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, Clock, Star, MessageSquare } from "lucide-react";

interface Agent {
    id: string; // Changed from intercomId to match new usage
    name: string;
    avatar: string;
    tickets: number; // Changed from totalSolved
    avgResponseTime: string;
    csat: number; // Changed from csatScore
}

export function AgentLeaderboard({ agents }: { agents: Agent[] }) {
    // Ordenar por tickets resueltos (memoizado para evitar re-sort en cada render)
    const sortedAgents = useMemo(
        () => [...agents].sort((a, b) => b.tickets - a.tickets).slice(0, 5),
        [agents]
    );

    return (
        <Card>
            <CardHeader className="pb-3 px-4">
                <CardTitle className="flex items-center gap-2 text-sm font-bold text-foreground uppercase tracking-tight">
                    <Trophy className="h-4 w-4 text-primary" />
                    Rendimiento del Equipo
                </CardTitle>
                <CardDescription className="text-[11px] text-muted-foreground">Top performance semanal (Intercom)</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4">
                <div className="space-y-4">
                    {sortedAgents.map((agent, index) => {
                        const isTop = index === 0;
                        return (
                            <div key={agent.id} className="flex items-center justify-between group">
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        <div className={`
                                            flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-black
                                            ${isTop ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}
                                        `}>
                                            {index + 1}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Avatar className={`h-8 w-8 border ${isTop ? 'border-primary' : 'border-border'}`}>
                                            <AvatarImage src={agent.avatar} alt={agent.name} />
                                            <AvatarFallback>{agent.name.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <div className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">{agent.name}</div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <div className="flex items-center text-[9px] text-muted-foreground">
                                                    <Clock className="w-2.5 h-2.5 mr-1" />
                                                    {agent.avgResponseTime}
                                                </div>
                                                <div className="flex items-center text-[9px] text-muted-foreground">
                                                    <Trophy className="w-2.5 h-2.5 mr-1" />
                                                    {agent.csat}%
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs font-black text-primary">{agent.tickets}</div>
                                    <div className="text-[8px] font-bold text-muted-foreground uppercase tracking-tighter">Tickets</div>
                                </div>
                            </div>
                        );
                    })}

                    {sortedAgents.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground text-sm italic">
                            Esperando datos de sincronización...
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
