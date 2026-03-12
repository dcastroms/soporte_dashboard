"use client";

import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    Legend
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function MetricsCharts({ data }: { data: any[] }) {
    const formattedData = data.map(m => ({
        ...m,
        fecha: new Date(m.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
        volumen: m.totalVolume,
        cerrados: m.closedCount,
        respuesta: Math.round(m.avgFirstResponseTime / 60), // mins
        satisfaccion: m.csatAverage
    }));

    return (
        <div className="grid gap-6 md:grid-cols-2">
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-medium">Volumen de Conversaciones</CardTitle>
                </CardHeader>
                <CardContent className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={formattedData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="fecha" fontSize={12} />
                            <YAxis fontSize={12} />
                            <Tooltip
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                            />
                            <Legend />
                            <Bar dataKey="volumen" fill="#3b82f6" name="Total Recibidos" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="cerrados" fill="#10b981" name="Cerrados" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-medium">Tiempo de Respuesta (Minutos)</CardTitle>
                </CardHeader>
                <CardContent className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={formattedData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="fecha" fontSize={12} />
                            <YAxis fontSize={12} />
                            <Tooltip
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                            />
                            <Legend />
                            <Line
                                type="monotone"
                                dataKey="respuesta"
                                stroke="#f59e0b"
                                name="Primera Respuesta (min)"
                                strokeWidth={2}
                                dot={{ r: 4 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            <Card className="md:col-span-2">
                <CardHeader>
                    <CardTitle className="text-sm font-medium">Satisfacción del Cliente (CSAT)</CardTitle>
                </CardHeader>
                <CardContent className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={formattedData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="fecha" fontSize={12} />
                            <YAxis domain={[0, 5]} fontSize={12} />
                            <Tooltip
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                            />
                            <Line
                                type="monotone"
                                dataKey="satisfaccion"
                                stroke="#8b5cf6"
                                name="Puntaje CSAT (0-5)"
                                strokeWidth={3}
                                dot={{ r: 6 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
    );
}
