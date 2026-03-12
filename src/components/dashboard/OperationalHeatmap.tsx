"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function OperationalHeatmap({ data }: { data: any[] }) {
    const days = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const hours = Array.from({ length: 24 }, (_, i) => i);

    // Mapear datos a una matriz [dia][hora]
    const matrix = Array.from({ length: 7 }, () => Array(24).fill(0));
    data.forEach(item => {
        matrix[item.dayOfWeek][item.hour] = item.count;
    });

    const maxCount = Math.max(...data.map(d => d.count), 1);

    const getColor = (count: number) => {
        if (count === 0) return "bg-slate-50";
        const intensity = count / maxCount;
        if (intensity < 0.2) return "bg-blue-100";
        if (intensity < 0.4) return "bg-blue-300";
        if (intensity < 0.6) return "bg-blue-500";
        if (intensity < 0.8) return "bg-blue-700";
        return "bg-blue-900";
    };

    return (
        <Card className="col-span-full">
            <CardHeader>
                <CardTitle className="text-sm font-medium">Mapa de Calor Operativo (Densidad de Tickets por Hora)</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <div className="min-w-[800px]">
                        {/* Cabecera de horas */}
                        <div className="flex mb-2">
                            <div className="w-12" />
                            {hours.map(h => (
                                <div key={h} className="flex-1 text-[10px] text-center text-slate-400">
                                    {h}h
                                </div>
                            ))}
                        </div>

                        {/* Filas de días */}
                        {matrix.map((row, dayIdx) => (
                            <div key={dayIdx} className="flex gap-1 mb-1">
                                <div className="w-12 text-xs font-medium text-slate-500 flex items-center">
                                    {days[dayIdx]}
                                </div>
                                {row.map((count, hourIdx) => (
                                    <div
                                        key={hourIdx}
                                        className={`flex-1 h-8 rounded-sm transition-all hover:ring-2 hover:ring-slate-300 relative group cursor-pointer ${getColor(count)}`}
                                    >
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50">
                                            <div className="bg-slate-900 text-white text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap">
                                                {days[dayIdx]} {hourIdx}:00 - {count} tickets
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
                <div className="mt-4 flex items-center justify-end gap-2 text-[10px] text-slate-500">
                    <span>Menos</span>
                    <div className="flex gap-1">
                        <div className="w-3 h-3 bg-blue-100 rounded-sm" />
                        <div className="w-3 h-3 bg-blue-300 rounded-sm" />
                        <div className="w-3 h-3 bg-blue-500 rounded-sm" />
                        <div className="w-3 h-3 bg-blue-700 rounded-sm" />
                        <div className="w-3 h-3 bg-blue-900 rounded-sm" />
                    </div>
                    <span>Más Tickets</span>
                </div>
            </CardContent>
        </Card>
    );
}
