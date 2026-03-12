import { prisma } from "@/lib/prisma";
import { StrategicRoadmap } from "@/components/dashboard/StrategicRoadmap";
import { Target } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function RoadmapPage() {
    // Fetch last 60 days of Intercom metrics for WoW comparison
    const raw = await prisma.intercomMetric.findMany({
        orderBy: { date: "asc" },
        take: 60,
    });

    const mid = Math.floor(raw.length / 2);
    const currentMetrics = raw.slice(mid);
    const prevMetrics = raw.slice(0, mid);

    return (
        <div className="space-y-8">
            {/* Page header */}
            <div>
                <div className="flex items-center gap-3 mb-1">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#9E77E5] to-[#67AA09] flex items-center justify-center">
                        <Target size={18} className="text-white" strokeWidth={2.5} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-foreground">Roadmap · OKRs Estratégicos</h1>
                        <p className="text-[11px] text-muted-foreground">Objetivos de negocio del trimestre · Datos reales de Intercom</p>
                    </div>
                </div>
            </div>

            {/* OKR component — full width */}
            <StrategicRoadmap
                metrics={currentMetrics as any}
                prevMetrics={prevMetrics as any}
            />

            {/* Methodology note — full width */}
            <div className="rounded-2xl border border-border bg-muted/20 px-5 py-4 space-y-2">
                <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Metodología OKR</p>
                <ul className="space-y-1.5 text-[11px] text-foreground/80">
                    <li className="flex gap-2"><span className="text-[#67AA09] font-bold mt-0.5">•</span><span><strong>Verde (≥80%)</strong> — En camino. Mantener ritmo actual.</span></li>
                    <li className="flex gap-2"><span className="text-[#9E77E5] font-bold mt-0.5">•</span><span><strong>Púrpura (50–79%)</strong> — Progresando. Requiere atención.</span></li>
                    <li className="flex gap-2"><span className="text-destructive font-bold mt-0.5">•</span><span><strong>Rojo (&lt;50%)</strong> — En riesgo. Escalar a Gerencia.</span></li>
                </ul>
                <p className="text-[10px] text-muted-foreground pt-1">El OKR de CSAT se actualiza automáticamente con los datos de Intercom. TTR y Deflection usan los valores objetivo de operaciones Q1-2026.</p>
            </div>
        </div>
    );
}
