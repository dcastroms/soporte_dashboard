import { MetricsCharts } from "@/components/dashboard/MetricsCharts";
import { SyncIntercomButton } from "@/components/dashboard/SyncIntercomButton";
import { OperationalHeatmap } from "@/components/dashboard/OperationalHeatmap";
import { AgentBenchmarking } from "@/components/dashboard/AgentBenchmarking";
import { CategoricalBreakdown } from "@/components/dashboard/CategoricalBreakdown";
import { getIntercomMetrics, getIntercomHeatmap, getIntercomAgents, getIntercomCategoryMetrics } from "@/lib/intercom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart3, TrendingUp, Users, MessageSquare } from "lucide-react";

import Link from "next/link";
import { ReportFilters } from "@/components/dashboard/ReportFilters";

export default async function ReportsPage({
    searchParams,
}: {
    searchParams: Promise<{ range?: string }>;
}) {
    const params = await searchParams;
    const range = params.range ? parseInt(params.range) : 7;
    const agentId = params.range ? undefined : undefined; // Just initialization logic
    const filterAgent = (params as any).agentId;
    const filterCategory = (params as any).category;

    const [data, heatmapData, agents, categories] = await Promise.all([
        getIntercomMetrics(range, { agentId: filterAgent, category: filterCategory }),
        getIntercomHeatmap(),
        getIntercomAgents(),
        getIntercomCategoryMetrics()
    ]);

    // Si no hay datos, mostrar estado vacío o mensaje
    if (data.length === 0) {
        return (
            <div className="space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="page-title">Reportes de Intercom</h1>
                        <p className="page-subtitle">Métricas de rendimiento y volumen de tickets.</p>
                    </div>
                    <SyncIntercomButton />
                </div>
                <Card className="p-12 text-center flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                        <BarChart3 size={32} className="text-muted-foreground" />
                    </div>
                    <h3 className="font-semibold text-xl text-foreground">Sin datos de Intercom</h3>
                    <p className="text-muted-foreground max-w-sm">
                        Haz clic en el botón de sincronización para cargar las métricas más recientes de Intercom.
                    </p>
                </Card>
            </div>
        );
    }

    const latestDay = data[data.length - 1];
    const avgVolume = Math.round(data.reduce((acc: number, d: any) => acc + d.totalVolume, 0) / data.length);
    const avgCSAT = (data.reduce((acc: number, d: any) => acc + (d.csatAverage || 0), 0) / data.length).toFixed(1);

    return (
        <div className="space-y-8 pb-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="page-title">Reportes Avanzados</h1>
                    <p className="page-subtitle">Inteligencia operativa basada en la data de Intercom.</p>
                </div>

                <div className="flex flex-col md:flex-row items-end md:items-center gap-4">
                    <ReportFilters agents={agents} categories={categories as any[]} />

                    <div className="flex items-center gap-4">
                        <div className="flex bg-muted/40 border border-border rounded-lg p-1">
                            {[7, 14, 30].map((r) => (
                                <Link
                                    key={r}
                                    href={`/reports?range=${r}`}
                                    className={`
                                    px-3 py-1 text-xs rounded-md transition-colors font-medium
                                    ${range === r
                                            ? 'bg-primary text-primary-foreground'
                                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                        }
                                    `}
                                >
                                    {r === 7 ? 'Semana' : r === 30 ? 'Mes' : `${r} días`}
                                </Link>
                            ))}
                        </div>
                        <SyncIntercomButton />
                    </div>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-foreground">Volumen Diario (Hoy)</CardTitle>
                        <MessageSquare className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-foreground">{latestDay.totalVolume}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Promedio: {avgVolume} tickets/día
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-foreground">Tiempo de Respuesta</CardTitle>
                        <TrendingUp className="h-4 w-4 text-warning" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-foreground">
                            {latestDay.avgFirstResponseTime != null ? `${Math.round(latestDay.avgFirstResponseTime / 60)} min` : 'N/A'}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Tiempo de primera respuesta promedio
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-foreground">Satisfacción (CSAT)</CardTitle>
                        <Users className="h-4 w-4 text-success" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-foreground">{latestDay.csatAverage || 'N/A'}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Promedio de satisfacción: {avgCSAT}
                        </p>
                    </CardContent>
                </Card>
            </div>

            <MetricsCharts data={data} />

            <div className="space-y-4">
                <h2 className="text-xl font-bold tracking-tight text-foreground">Distribución Categórica</h2>
                <CategoricalBreakdown data={categories} />
            </div>

            <OperationalHeatmap data={heatmapData} />

            <AgentBenchmarking agents={agents} />
        </div>
    );
}
