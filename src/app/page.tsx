import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { formatSeconds } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Zap,
  Plus,
  CalendarDays,
  Activity
} from "lucide-react";
import {
  getAutomations,
  getBacklogItems,
  getGoals,
  getWeeklyUpdates,
  getIntercomHeatmapData,
  getIntercomLeaderboard,
  getIntercomTrendData,
} from "@/lib/actions";
import { OverviewHeatmap } from "@/components/dashboard/OverviewHeatmap";
import { AgentLeaderboard } from "@/components/dashboard/AgentLeaderboard";
import { Sparkline } from "@/components/dashboard/Sparkline";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { UpcomingEvents } from "@/components/dashboard/UpcomingEvents";
import { EfficiencyChart } from "@/components/dashboard/EfficiencyChart";
import { OperationalGoals } from "@/components/dashboard/OperationalGoals";
import { RoadmapDonut } from "@/components/dashboard/RoadmapDonut";
import { EventAlertBanner } from "@/components/dashboard/EventAlertBanner";
import { LiveWorkload } from "@/components/dashboard/LiveWorkload";
import { HealthStatusBanner } from "@/components/dashboard/HealthStatusBanner";
import { WelcomePanel } from "@/components/dashboard/WelcomePanel";
import { ExecutiveReportGenerator } from "@/components/dashboard/ExecutiveReportGenerator";
import { FocusAudit } from "@/components/dashboard/FocusAudit";
import { getRedFlagTickets, getTicketTypeInsights, getReopenRate } from "@/lib/auditActions";
import { getCriticalAccounts, getWeeklyEfficiency } from "@/lib/clientIntelActions";
import Link from "next/link";

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const resolvedParams = await searchParams;
  const range = resolvedParams.range ? parseInt(resolvedParams.range) : 7;

  // Prepare dates for active events query
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 86400000);

  const [
    automations,
    backlog,
    goals,
    updates,
    heatmapData,
    leaderboardData,
    trendData,
    rawMetrics,
    syncStatus,
    redFlagTickets,
    ticketInsights,
    reopenData,
    criticalAccounts,
    weeklyEfficiency,
    activeEvents,
  ] = await Promise.all([
    getAutomations(),
    getBacklogItems(),
    getGoals(),
    getWeeklyUpdates(),
    getIntercomHeatmapData(),
    getIntercomLeaderboard(),
    getIntercomTrendData(range),
    import('@/lib/intercom').then(mod => mod.getIntercomMetrics()),
    prisma.intercomSyncStatus.findFirst({ orderBy: { lastSync: 'desc' } }),
    getRedFlagTickets().catch(() => []),
    getTicketTypeInsights().catch(() => []),
    getReopenRate().catch(() => ({ rate: 0, isAlert: false })),
    getCriticalAccounts().catch(() => []),
    getWeeklyEfficiency().catch(() => ({ received: 0, solved: 0, efficiency: 0 })),
    prisma.event.findMany({
      where: { startDate: { lte: todayEnd }, endDate: { gte: todayStart } },
      orderBy: { startDate: 'asc' },
    }),
  ]);
  // Compute ambient glow class based on active event type (server-side)
  const glowStyles: Record<string, string> = {
    Maintenance: "rounded-2xl shadow-[0_0_60px_8px_rgba(245,158,11,0.12)] ring-1 ring-amber-500/20 transition-all duration-700",
    Promotion: "rounded-2xl shadow-[0_0_60px_8px_rgba(158,119,229,0.15)] ring-1 ring-secondary/20 transition-all duration-700",
    Launch: "rounded-2xl shadow-[0_0_60px_8px_rgba(103,170,9,0.18)] ring-1 ring-primary/25 transition-all duration-700",
    Meeting: "rounded-2xl shadow-[0_0_60px_8px_rgba(59,130,246,0.12)] ring-1 ring-info/20 transition-all duration-700",
    default: "rounded-2xl shadow-[0_0_60px_8px_rgba(103,170,9,0.20)] ring-1 ring-primary/30 transition-all duration-700",
  };
  const glowClass = activeEvents.length > 0
    ? (glowStyles[activeEvents[0].type] ?? glowStyles.default)
    : "";

  const lastSync = syncStatus?.lastSync ? new Date(syncStatus.lastSync) : null;

  const activeAutomations = automations.filter((a: any) => a.status === 'Activa').length;
  const pendingBacklog = backlog.filter((b: any) => b.status === 'Pendiente').length;
  const criticalIssues = backlog.filter((b: any) => b.priority === 'Crítica').length;

  const totalInitiatives = goals.reduce((acc: number, goal: any) => acc + (goal.initiatives?.length || 0), 0);
  const completedInitiatives = goals.reduce((acc: number, goal: any) =>
    acc + (goal.initiatives?.filter((i: any) => i.status === 'Completado').length || 0), 0);
  const roadmapProgress = totalInitiatives > 0
    ? Math.round((completedInitiatives / totalInitiatives) * 100)
    : 0;

  const latestUpdate = (updates.length > 0 ? updates[0] : null) as any;
  const latestIntercom = rawMetrics.length > 0 ? rawMetrics[rawMetrics.length - 1] : null;

  // Week-over-week split: current 7 days vs previous 7 days
  const midpoint = Math.floor(rawMetrics.length / 2);
  const currentWeekMetrics = (rawMetrics as any[]).slice(midpoint);
  const prevWeekMetrics = (rawMetrics as any[]).slice(0, midpoint);

  const avg = (arr: any[], key: string) =>
    arr.length === 0 ? 0 : arr.reduce((s: number, m: any) => s + (m[key] || 0), 0) / arr.length;

  const wowMetrics = [
    { label: "FRT", current: avg(currentWeekMetrics, "avgFirstResponseTime") / 60, previous: avg(prevWeekMetrics, "avgFirstResponseTime") / 60, unit: " min", inverse: true },
    { label: "CSAT", current: avg(currentWeekMetrics, "csatAverage"), previous: avg(prevWeekMetrics, "csatAverage"), unit: "%" },
    { label: "Volumen", current: avg(currentWeekMetrics, "totalVolume"), previous: avg(prevWeekMetrics, "totalVolume"), unit: " tickets" },
  ];

  const slaThreshold = 1800;
  const isSlaBreached = latestIntercom && (latestIntercom.avgFirstResponseTime || 0) > slaThreshold;

  const { chartData, trends } = trendData as any;

  const kpis = [
    {
      label: "Tickets Intercom (Hoy)",
      value: latestIntercom?.totalVolume.toString() || "0",
      description: "Volumen diario recibido",
      sparkline: <Sparkline data={chartData} dataKey="volume" color="#9E77E5" />,
      info: "📊 Volumen del día. Un aumento súbito puede indicar un incidente activo. Usado para calibrar la cantidad de agentes necesarios en el turno siguiente.",
      trend: trends?.volume
    },
    {
      label: "Backlog Pendiente",
      value: pendingBacklog.toString(),
      description: pendingBacklog === 0 ? "¡Todo al día!" : "Tareas técnicas en cola",
      sparkline: null,
      info: "🗂️ Toda mejora no atendida es deuda técnica que crece. Un backlog alto indica que el equipo reactivo está absorbiendo tiempo que debería usarse en procesos proactivos.",
      trend: pendingBacklog === 0 ? 0 : -pendingBacklog
    },
    {
      label: "Satisfacción (CSAT)",
      value: latestIntercom?.csatAverage ? `${latestIntercom.csatAverage.toFixed(1)}%` : "Esperando datos",
      description: "Meta: 90%",
      sparkline: <Sparkline data={chartData} dataKey="csat" color="#67AA09" />,
      info: "⭐ CSAT es tu principal indicador de éxito ante la gerencia. Un CSAT bajo > 90% anticipa churn. Cada punto perdido cuesta relaciones comerciales con clientes clave.",
      trend: trends?.csat
    },
    {
      label: "Tiempo de Respuesta",
      value: latestIntercom?.avgFirstResponseTime
        ? formatSeconds(latestIntercom.avgFirstResponseTime)
        : "N/A",
      description: "Meta: < 5 min",
      sparkline: <Sparkline data={chartData} dataKey="frt" color="#67AA09" />,
      info: "⚡ FRT (First Response Time): un FRT bajo mejora la percepción de marca y reduce el churn. Estudios muestran que clientes con respuesta < 5 min tienen 2x más probabilidad de renovar contratos.",
      trend: trends?.frt
    }
  ];

  // Custom logic for backlog KPI colors in the return
  const backlogKpi = kpis[1];
  if (pendingBacklog === 0) {
    backlogKpi.trend = 0.1; // Force green
  } else if (pendingBacklog > 10) {
    backlogKpi.trend = -0.1; // Force yellow/red logic happens in KpiCard but let's just use it
  }

  return (
    <div className={`space-y-8 p-1 ${glowClass}`}>
      {/* High-Demand Event Banner */}
      <EventAlertBanner events={activeEvents as any} />
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="page-title uppercase">Soporte 360</h1>
          <div className="flex items-center gap-3 mt-1">
            <HealthStatusBanner
              slaCompliance={latestIntercom?.avgFirstResponseTime ? Math.max(0, 100 - ((latestIntercom.avgFirstResponseTime / 1800) * 100)) : 100}
              maxAgentWorkload={0}
              avgFrtSeconds={latestIntercom?.avgFirstResponseTime ?? 0}
              totalOpenTickets={latestIntercom?.totalVolume ?? 0}
              hasActiveEvent={activeEvents.length > 0}
              workloadThreshold={5}
              slaThreshold={95}
            />
            {lastSync && (
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
                <Clock size={12} />
                Última sincronización: {lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 bg-muted/40 p-1 rounded-md">
          <div className="flex bg-card rounded-md p-0.5">
            {[7, 14, 30].map((r) => (
              <Link
                key={r}
                href={`/?range=${r}`}
                className={`
                  px-3 py-1.5 text-[10px] font-black rounded-full transition-all
                  ${range === r
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                  }
                `}
              >
                {r === 7 ? 'SEMANA' : r === 30 ? 'MES' : `${r} DÍAS`}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Executive Report button */}
      <div className="flex justify-end -mt-2 mb-2">
        <ExecutiveReportGenerator weekMetrics={wowMetrics as any} />
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-border bg-card/50 rounded-lg border border-border shadow-sm">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left col: charts only */}
        <div className="lg:col-span-2 space-y-6">
          <EfficiencyChart />
          <OverviewHeatmap data={heatmapData as any} />
        </div>

        {/* Right col: stacked snapshot cards — fills full height */}
        <div className="flex flex-col gap-6">

          {/* OKR Snapshot */}
          <Link href="/roadmap" className="group block">
            <div className="card-neumorphic rounded-2xl p-5 h-full hover:border-secondary/40 hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-secondary/10 flex items-center justify-center shrink-0">
                      <span className="text-lg">🎯</span>
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-tight text-foreground">Roadmap · OKRs</p>
                      <p className="text-[10px] text-muted-foreground">Objetivos del trimestre</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground font-bold italic">Global</p>
                    <p className="text-2xl font-black text-secondary">{roadmapProgress}%</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {[
                    { label: "Eficiencia (TTR)", progress: 62, color: "var(--color-secondary)" },
                    { label: "Autogestión", progress: 45, color: "var(--destructive)" },
                    { label: "Calidad (CSAT)", progress: 88, color: "var(--color-primary)" },
                  ].map((okr) => (
                    <div key={okr.label} className="space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-muted-foreground font-medium">{okr.label}</span>
                        <span className="font-bold">{okr.progress}%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${okr.progress}%`, backgroundColor: okr.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-[10px] text-secondary font-bold mt-4 group-hover:underline flex items-center gap-1">
                Ver Roadmap completo <Plus size={12} />
              </p>
            </div>
          </Link>

          {/* Weekly Executive Snapshot */}
          <Link href="/tracking" className="group block">
            <div className="card-neumorphic rounded-2xl p-5 h-full hover:border-primary/40 hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-lg">📋</span>
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-tight text-foreground">Informe Semanal</p>
                      <p className="text-[10px] text-muted-foreground">Métricas Intercom</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {[
                    { label: "CSAT", val: `${avg(currentWeekMetrics, "csatAverage").toFixed(1)}%`, prev: `${avg(prevWeekMetrics, "csatAverage").toFixed(1)}%`, up: avg(currentWeekMetrics, "csatAverage") >= avg(prevWeekMetrics, "csatAverage") },
                    { label: "FRT", val: `${Math.round(avg(currentWeekMetrics, "avgFirstResponseTime") / 60)} min`, prev: `${Math.round(avg(prevWeekMetrics, "avgFirstResponseTime") / 60)} min`, up: avg(currentWeekMetrics, "avgFirstResponseTime") <= avg(prevWeekMetrics, "avgFirstResponseTime") },
                  ].map((kpi) => (
                    <div key={kpi.label} className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/40">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">{kpi.label}</p>
                        <p className="text-lg font-black text-foreground">{kpi.val}</p>
                      </div>
                      <div className={`text-[10px] font-bold px-2 py-1 rounded-lg ${kpi.up ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                        {kpi.up ? "↑" : "↓"} {kpi.prev}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-[10px] text-primary font-bold mt-4 group-hover:underline flex items-center gap-1">
                Ver Informe Ejecutivo <Plus size={12} />
              </p>
            </div>
          </Link>

          {/* Upcoming Events or Branding filling the gap */}
          <div className="flex-1 min-h-[100px]">
            <UpcomingEvents />
          </div>

          {/* Status Branding Info */}
          <div className="card-neumorphic rounded-2xl p-5 bg-primary/5 flex items-center gap-4">
            <img src="/mediastream-icon.png" alt="" className="w-12 h-auto opacity-20 grayscale brightness-0 dark:invert" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-primary">System Status</p>
              <p className="text-xs font-medium text-foreground italic opacity-70">"Monitoring real-time performance for Soporte 360"</p>
            </div>
          </div>

        </div>
      </div>

      {/* Agent Leaderboard + Operational Goals */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AgentLeaderboard agents={leaderboardData as any} />
        </div>
        <OperationalGoals />
      </div>

      {/* Audit Row: Red Flags (compact) + Quick Navigation */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <FocusAudit initialTickets={redFlagTickets as any} />
        </div>

        {/* CS Intelligence summary card → links to /clients */}
        <Link href="/clients" className="group block">
          <div className="card-neumorphic rounded-2xl p-4 h-full hover:border-secondary/40 hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
                <span className="text-sm">🫀</span>
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-tight text-foreground">CS Intelligence</p>
                <p className="text-[9px] text-muted-foreground">Auditoría por cliente</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-xl bg-primary/5 border border-primary/20 text-center">
                <p className="text-lg font-black text-primary">{(weeklyEfficiency as any).efficiency}%</p>
                <p className="text-[8px] text-muted-foreground">Eficiencia semanal</p>
                <p className="text-[8px] text-muted-foreground">{(weeklyEfficiency as any).solved}/{(weeklyEfficiency as any).received} resueltos</p>
              </div>
              <div className={`p-2.5 rounded-xl border text-center ${(criticalAccounts as any).length > 0
                ? "bg-destructive/5 border-destructive/20"
                : "bg-success/5 border-success/20"
                }`}>
                <p className={`text-lg font-black ${(criticalAccounts as any).length > 0 ? "text-destructive" : "text-success"}`}>
                  {(criticalAccounts as any).length}
                </p>
                <p className="text-[8px] text-muted-foreground">Cuentas críticas</p>
                <p className="text-[8px] text-muted-foreground">
                  {(criticalAccounts as any).length > 0 ? "requieren atención" : "todo en orden"}
                </p>
              </div>
            </div>

            <p className="text-[9px] text-secondary font-bold group-hover:underline">
              Ver auditoría completa →
            </p>
          </div>
        </Link>
      </div>

    </div >
  );
}
