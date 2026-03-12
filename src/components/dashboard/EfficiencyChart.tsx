"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

const data = [
    { name: 'Lun', received: 45, resolved: 42, meta: 40 },
    { name: 'Mar', received: 52, resolved: 48, meta: 40 },
    { name: 'Mié', received: 48, resolved: 50, meta: 40 },
    { name: 'Jue', received: 61, resolved: 58, meta: 40 },
    { name: 'Vie', received: 55, resolved: 54, meta: 40 },
    { name: 'Sáb', received: 32, resolved: 35, meta: 40 },
    { name: 'Dom', received: 28, resolved: 30, meta: 40 },
];

export function EfficiencyChart() {
    return (
        <Card className="overflow-x-auto">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-sm font-bold text-foreground tracking-tight uppercase">Métrica de Eficiencia Semanal</CardTitle>
                        <CardDescription className="text-[11px] text-muted-foreground">Comparativa de tickets recibidos vs resueltos.</CardDescription>
                    </div>
                    <Badge className="bg-primary/10 text-primary border-none text-[10px] px-2 py-0">
                        +12% eficiencia
                    </Badge>
                </div>
            </CardHeader>
            <CardContent>
                <div className="h-[200px] w-full mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                            <XAxis
                                dataKey="name" // Kept 'name' as per original data structure, instruction had 'day' but no data change
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                                dy={10}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'var(--popover)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '12px',
                                    fontSize: '10px',
                                    fontWeight: 'bold',
                                    color: 'var(--popover-foreground)'
                                }}
                            />
                            <Legend
                                verticalAlign="top"
                                align="right"
                                iconType="circle"
                                wrapperStyle={{ fontSize: '10px', paddingBottom: '20px' }}
                            />
                            <Line
                                type="monotone"
                                dataKey="received"
                                name="Recibidos"
                                stroke="#9E77E5"
                                strokeWidth={3}
                                dot={{ fill: '#9E77E5', r: 4 }}
                                activeDot={{ r: 6 }}
                            />
                            <Line
                                type="monotone"
                                dataKey="resolved"
                                name="Resueltos"
                                stroke="#67AA09"
                                strokeWidth={3}
                                dot={{ fill: '#67AA09', r: 4 }}
                                activeDot={{ r: 6 }}
                            />
                            <Line
                                type="monotone"
                                dataKey="meta"
                                name="Meta"
                                stroke="#9099A2"
                                strokeWidth={1}
                                strokeDasharray="5 5"
                                dot={false}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
