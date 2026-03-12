import { prisma } from "@/lib/prisma";
import { WeeklyHealth } from "@/components/dashboard/WeeklyHealth";
import { Activity } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TrackingPage() {
    // Fetch last 60 days of Intercom metrics for WoW comparison
    const raw = await prisma.intercomMetric.findMany({
        orderBy: { date: "asc" },
        take: 60,
    });

    const mid = Math.floor(raw.length / 2);
    const current = raw.slice(mid);
    const prev = raw.slice(0, mid);

    const avg = (arr: typeof raw, key: keyof typeof raw[0]) =>
        arr.length === 0
            ? 0
            : arr.reduce((s, m) => s + ((m[key] as number) || 0), 0) / arr.length;

    const kpiRows = [
        {
            label: "CSAT",
            current: parseFloat(avg(current, "csatAverage").toFixed(1)),
            previous: parseFloat(avg(prev, "csatAverage").toFixed(1)),
            unit: "%",
        },
        {
            label: "FRT",
            current: Math.round(avg(current, "avgFirstResponseTime") / 60),
            previous: Math.round(avg(prev, "avgFirstResponseTime") / 60),
            unit: " min",
            inverse: true,
        },
        {
            label: "Volumen",
            current: Math.round(avg(current, "totalVolume")),
            previous: Math.round(avg(prev, "totalVolume")),
            unit: " tickets",
        },
    ];

    return (
        <div className="space-y-6">
            {/* Page header */}
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#67AA09] to-[#9E77E5] flex items-center justify-center">
                    <Activity size={18} className="text-white" strokeWidth={2.5} />
                </div>
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-foreground">Seguimiento Semanal</h1>
                    <p className="text-[11px] text-muted-foreground">Informe ejecutivo de operaciones · Editable desde el dashboard</p>
                </div>
            </div>

            {/* Executive 4-section report — full width */}
            <WeeklyHealth kpiRows={kpiRows} />
        </div>
    );
}
