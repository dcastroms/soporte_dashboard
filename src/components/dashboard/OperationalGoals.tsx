"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Info } from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

export function OperationalGoals() {
    const ttrData = [
        { value: 85, color: 'var(--primary)' },
        { value: 15, color: 'var(--muted)' }
    ];

    const slaData = [
        { value: 98, color: 'var(--secondary)' },
        { value: 2, color: 'var(--muted)' }
    ];

    return (
        <Card>
            <CardHeader className="pb-4 px-4">
                <CardTitle className="text-sm font-bold text-foreground tracking-tight uppercase">Metas Operativas</CardTitle>
                <CardDescription className="text-[11px] text-muted-foreground">Objetivos estratégicos del equipo</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-6">
                <TooltipProvider>
                    <div>
                        <div className="flex items-center gap-4 mb-2">
                            <div className="h-12 w-12 relative shrink-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={ttrData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={15}
                                            outerRadius={20}
                                            startAngle={90}
                                            endAngle={450}
                                            dataKey="value"
                                            stroke="none"
                                        >
                                            <Cell fill="var(--primary)" />
                                            <Cell fill="var(--muted)" />
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-[8px] font-black text-foreground">2.4h</span>
                                </div>
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-1.5">
                                    <p className="text-[10px] font-black text-foreground uppercase tracking-tight">TTR Semanal</p>
                                    <Tooltip>
                                        <TooltipTrigger>
                                            <Info size={10} className="text-muted-foreground cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent side="right" className="text-[10px]">
                                            Time To Resolve: Tiempo promedio para cerrar tickets.
                                        </TooltipContent>
                                    </Tooltip>
                                </div>
                                <div className="flex items-center gap-2">
                                    <p className="text-[9px] text-primary font-bold">Meta: &lt; 24.0h</p>
                                    <div className="h-1 w-1 rounded-full bg-primary" />
                                    <p className="text-[9px] text-muted-foreground font-medium">A tiempo</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-1.5">
                                <p className="text-[10px] font-black text-foreground uppercase tracking-tight">First Contact Resolution</p>
                                <Tooltip>
                                    <TooltipTrigger>
                                        <Info size={10} className="text-muted-foreground cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent side="right" className="text-[10px]">
                                        % de tickets resueltos en la primera interacción.
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                            <span className="text-[10px] font-black text-primary">78%</span>
                        </div>
                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: '78%' }} />
                        </div>
                        <p className="text-[9px] text-muted-foreground mt-1 font-medium italic">Meta: &gt; 70%</p>
                    </div>

                    <div>
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 relative shrink-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={slaData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={15}
                                            outerRadius={20}
                                            startAngle={90}
                                            endAngle={450}
                                            dataKey="value"
                                            stroke="none"
                                        >
                                            <Cell fill="var(--secondary)" />
                                            <Cell fill="var(--muted)" />
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-[8px] font-black text-foreground">98%</span>
                                </div>
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-1.5">
                                    <p className="text-[10px] font-black text-foreground uppercase tracking-tight">SLA Compliance</p>
                                    <Tooltip>
                                        <TooltipTrigger>
                                            <Info size={10} className="text-muted-foreground cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent side="right" className="text-[10px]">
                                            Cumplimiento de acuerdos de nivel de servicio.
                                        </TooltipContent>
                                    </Tooltip>
                                </div>
                                <div className="flex items-center gap-2">
                                    <p className="text-[9px] text-secondary font-bold">Meta: &gt; 95%</p>
                                    <div className="h-1 w-1 rounded-full bg-secondary" />
                                    <p className="text-[9px] text-muted-foreground font-medium">SLA Cumplido</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </TooltipProvider>
            </CardContent>
        </Card>
    );
}
