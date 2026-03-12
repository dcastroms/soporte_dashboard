"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899'];

interface CategoryMetric {
    category: string;
    value: string;
    count: number;
}

export function CategoricalBreakdown({ data }: { data: CategoryMetric[] }) {
    const clients = data.filter(d => d.category === 'Client').slice(0, 10);
    const modules = data.filter(d => d.category === 'Module').slice(0, 10);
    const types = data.filter(d => d.category === 'Type').slice(0, 10);

    return (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Clientes */}
            <Card className="flex flex-col">
                <CardHeader>
                    <CardTitle className="text-sm font-medium">Top 10 Clientes</CardTitle>
                    <CardDescription>Distribución por volumen de tickets</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px] flex-1 min-h-[300px]">
                    <div style={{ width: '100%', height: '100%', minWidth: 0 }}>
                        <ResponsiveContainer>
                            <PieChart>
                                <Pie
                                    data={clients}
                                    dataKey="count"
                                    nameKey="value"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={80}
                                    label={({ value, name }) => name ? `${String(name).substring(0, 10)}...` : ""}
                                >
                                    {clients.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* Módulos */}
            <Card className="flex flex-col">
                <CardHeader>
                    <CardTitle className="text-sm font-medium">Módulos / Áreas</CardTitle>
                    <CardDescription>Categorización por producto</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px] flex-1 min-h-[300px]">
                    <div style={{ width: '100%', height: '100%', minWidth: 0 }}>
                        <ResponsiveContainer>
                            <BarChart data={modules} layout="vertical" margin={{ left: 20, right: 30 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                <XAxis type="number" fontSize={10} hide />
                                <YAxis
                                    type="category"
                                    dataKey="value"
                                    fontSize={10}
                                    width={100}
                                    tickFormatter={(val) => val ? (String(val).length > 15 ? `${String(val).substring(0, 15)}...` : String(val)) : ""}
                                />
                                <Tooltip
                                    cursor={{ fill: 'transparent' }}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                />
                                <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} name="Tickets" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* Tipos de Ticket */}
            <Card className="flex flex-col md:col-span-2 lg:col-span-1">
                <CardHeader>
                    <CardTitle className="text-sm font-medium">Tipos de Ticket</CardTitle>
                    <CardDescription>Naturaleza de la consulta</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px] flex-1 min-h-[300px]">
                    <div style={{ width: '100%', height: '100%', minWidth: 0 }}>
                        <ResponsiveContainer>
                            <BarChart data={types}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis
                                    dataKey="value"
                                    fontSize={10}
                                    interval={0}
                                    tickFormatter={(val) => val ? (String(val).length > 10 ? `${String(val).substring(0, 10)}.` : String(val)) : ""}
                                />
                                <YAxis fontSize={10} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                />
                                <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Tickets" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
