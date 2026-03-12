"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

interface HeatmapProps {
    data: { dayOfWeek: number; hour: number; count: number }[];
}

export function OverviewHeatmap({ data }: HeatmapProps) {
    // 1. Transformar data para acceso rápido
    const map = new Map<string, number>();
    let max = 0;

    data.forEach(d => {
        const key = `${d.dayOfWeek}-${d.hour}`;
        map.set(key, d.count);
        if (d.count > max) max = d.count;
    });

    const getIntensityStyle = (count: number) => {
        if (count === 0) return { backgroundColor: 'var(--muted)', opacity: 0.3 };
        const ratio = count / (max || 1);
        // Gradient from dark grey to Mediastream Green
        return {
            backgroundColor: '#67AA09',
            opacity: 0.2 + ratio * 0.8,
            borderRadius: '4px'
        };
    };

    return (
        <Card className="overflow-x-auto">
            <CardHeader>
                <CardTitle>Actividad Semanal (Heatmap)</CardTitle>
                <CardDescription>Concentración de volumen por día y hora. (Verde oscuro = Mayor tráfico)</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex gap-2 text-xs text-slate-400 mb-2 pl-8">
                    {/* Hours Header (Simplificado) */}
                    {HOURS.filter(h => h % 3 === 0).map(h => (
                        <div key={h} className="flex-1 text-center" style={{ width: 'calc(100% / 8)' }}>{h}:00</div>
                    ))}
                </div>

                <div className="grid grid-cols-[30px_1fr_40px] gap-2">
                    {/* Days Column */}
                    <div className="flex flex-col justify-around text-xs font-bold text-slate-500">
                        {DAYS.map(d => <div key={d} className="h-4 leading-4">{d}</div>)}
                    </div>

                    {/* Grid */}
                    <div className="grid grid-rows-7 gap-1">
                        {DAYS.map((_, dayIndex) => (
                            <div key={dayIndex} className="grid grid-cols-24 gap-1 h-4">
                                {HOURS.map(hour => {
                                    const count = map.get(`${dayIndex}-${hour}`) || 0;
                                    return (
                                        <TooltipProvider key={hour}>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div
                                                        className="w-full h-full transition-all hover:scale-125 cursor-pointer"
                                                        style={getIntensityStyle(count)}
                                                    />
                                                </TooltipTrigger>
                                                <TooltipContent className="bg-popover border-border text-popover-foreground">
                                                    <p className="text-xs font-bold">{DAYS[dayIndex]} {hour}:00</p>
                                                    <p className="text-xs">{count} tickets</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    );
                                })}
                            </div>
                        ))}
                    </div>

                    {/* Meta Column: FRT Avg (Mock/Simulated to match visual) */}
                    <div className="flex flex-col justify-around text-[9px] font-bold text-slate-500 pl-2 border-l border-white/5">
                        {DAYS.map(d => <div key={d} className="h-4 leading-4 text-[#9E77E5]">~4m</div>)}
                    </div>
                </div>

                <div className="flex justify-between items-center mt-6">
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#9E77E5]" />
                        <span>Columna derecha: Promedio FRT por hora (Meta: &lt;5m)</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <span>Menos</span>
                        <div className="flex gap-1">
                            {[0.2, 0.4, 0.6, 0.8, 1].map(o => (
                                <div key={o} className="w-3 h-3 rounded-sm bg-[#67AA09]" style={{ opacity: o }} />
                            ))}
                        </div>
                        <span>Más</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
