"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Star, Clock, CheckCircle2 } from "lucide-react";

export function AgentBenchmarking({ agents }: { agents: any[] }) {
    return (
        <Card className="col-span-full">
            <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    Rendimiento por Agente (Benchmarking)
                </CardTitle>
                <CardDescription>Métricas individuales para identificar mejores prácticas y carga de trabajo.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50 hover:bg-slate-50">
                            <TableHead>Agente</TableHead>
                            <TableHead className="text-right">Resueltos</TableHead>
                            <TableHead className="text-right">Respuesta Media</TableHead>
                            <TableHead className="text-right">CSAT (0-5)</TableHead>
                            <TableHead className="text-right">Estado</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {agents.map((agent) => (
                            <TableRow key={agent.id} className="hover:bg-slate-50/50">
                                <TableCell className="font-semibold">{agent.name}</TableCell>
                                <TableCell className="text-right">{agent.totalSolved}</TableCell>
                                <TableCell className="text-right flex items-center justify-end gap-2">
                                    <Clock size={14} className="text-slate-400" />
                                    {Math.round(agent.avgResponseTime / 60)} min
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1 font-bold text-amber-600">
                                        <Star size={14} fill="currentColor" />
                                        {agent.csatScore}
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">
                                    <Badge variant={agent.csatScore >= 4.5 ? "default" : "secondary"}>
                                        {agent.csatScore >= 4.5 ? "Excelente" : "Buen Nivel"}
                                    </Badge>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
