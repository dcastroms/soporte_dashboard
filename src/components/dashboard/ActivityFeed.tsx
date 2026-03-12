"use client";

import { useEffect, useState } from "react";
import { getActivityLogs } from "@/lib/notifications";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Activity, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // Assuming these components are available

export function ActivityFeed() {
    const [logs, setLogs] = useState<any[]>([]);

    useEffect(() => {
        const fetchLogs = async () => {
            const data = await getActivityLogs(5);
            setLogs(data);
        };
        fetchLogs();
    }, []);

    // Modificar estilos para que se vean bien en el Sidebar oscuro
    return (
        <Card>
            <CardHeader className="pb-3 px-4">
                <CardTitle className="flex items-center gap-2 text-sm font-bold text-foreground uppercase tracking-tight">
                    <Activity className="h-4 w-4 text-primary" />
                    Actividad Reciente
                </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
                {logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-border rounded-xl">
                        <Clock size={24} className="text-muted-foreground mb-2" strokeWidth={1} />
                        <p className="text-[10px] text-muted-foreground italic font-medium">Monitoring operativo en tiempo real...</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {logs.map((log: any) => (
                            <div key={log.id} className="relative pl-5 border-l border-border pb-4 last:pb-0">
                                <div className="absolute -left-[3px] top-1.5 w-1.5 h-1.5 rounded-full bg-primary" />
                                <p className="text-[11px] text-foreground leading-relaxed">
                                    <span className="font-bold text-secondary">{log.userName}</span> {getActionText(log.action)} <span className="font-medium">{log.target}</span>
                                </p>
                                <p className="text-[9px] text-muted-foreground mt-1 flex items-center gap-1">
                                    <Clock size={10} className="opacity-50 shrink-0" />
                                    {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true, locale: es })}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function getActionText(action: string) {
    switch (action.toLowerCase()) {
        case 'created': return 'cre?';
        case 'updated': return 'actualiz?';
        case 'deleted': return 'elimin?';
        case 'completed': return 'complet?';
        default: return 'modific?';
    }
}
