"use client";

import { AlertTriangle, CheckCircle2, Zap, AlertCircle } from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

type HealthLevel = "green" | "yellow" | "purple" | "red";

interface HealthRule {
    level: HealthLevel;
    label: string;
    sublabel: string;
    reason: string;
}

interface HealthStatusBannerProps {
    slaCompliance: number;       // 0-100
    maxAgentWorkload: number;    // tickets open for busiest agent
    totalOpenTickets?: number;   // total open tickets (for yellow threshold)
    avgFrtSeconds?: number;      // average FRT in seconds (for yellow warning)
    hasActiveEvent?: boolean;    // active high-demand event
    workloadThreshold?: number;  // default 5
    slaThreshold?: number;       // default 95
}

function computeHealth(props: Required<HealthStatusBannerProps>): HealthRule {
    const {
        slaCompliance, maxAgentWorkload, totalOpenTickets,
        avgFrtSeconds, hasActiveEvent, workloadThreshold, slaThreshold
    } = props;

    const slaOk = slaCompliance >= slaThreshold;
    const workloadOk = maxAgentWorkload < workloadThreshold;
    const frtOk = avgFrtSeconds < 300; // < 5 min
    const ticketsOk = totalOpenTickets < 10;

    // 🔴 Red — both SLA and workload failing
    if (!slaOk && !workloadOk) {
        return {
            level: "red",
            label: "Alerta Crítica",
            sublabel: `SLA ${slaCompliance.toFixed(0)}% · Sobrecarga`,
            reason: `SLA por debajo del ${slaThreshold}% Y ${maxAgentWorkload} tickets en el agente más cargado. Requiere acción inmediata.`,
        };
    }

    // 🔴 Red — SLA breached alone while tickets are very high
    if (!slaOk && totalOpenTickets >= 15) {
        return {
            level: "red",
            label: "SLA en Riesgo",
            sublabel: `SLA ${slaCompliance.toFixed(0)}% · ${totalOpenTickets} tickets abiertos`,
            reason: "SLA incumplido con alta carga de tickets. Escala al jefe de turno.",
        };
    }

    // 🟣 Purple — active high-demand event
    if (hasActiveEvent) {
        return {
            level: "purple",
            label: "Alta Demanda — Activa",
            sublabel: "Evento crítico en curso",
            reason: "Hay un evento especial activo que pone al equipo en modo de alta demanda. Monitorea el Live Workload cada 15 min.",
        };
    }

    // 🟡 Yellow — FRT or total tickets approaching warning zone
    if (!frtOk || !ticketsOk) {
        const cause = !frtOk
            ? `FRT promedio: ${Math.round(avgFrtSeconds / 60)}m`
            : `${totalOpenTickets} tickets abiertos`;
        return {
            level: "yellow",
            label: "Atención Requerida",
            sublabel: cause,
            reason: !frtOk
                ? `El FRT supera los 5 min. Revisa si hay tickets sin respuesta inicial. Meta: < 5 min.`
                : `Más de 10 tickets abiertos. Considera redistribuir la carga entre agentes.`,
        };
    }

    // 🟢 Green — everything nominal
    return {
        level: "green",
        label: "Operación Saludable",
        sublabel: `SLA ${slaCompliance.toFixed(0)}% · Todo nominal`,
        reason: "Todos los indicadores dentro de los rangos óptimos. ¡Buen trabajo, equipo!",
    };
}

const HEALTH_STYLES: Record<HealthLevel, {
    bar: string;
    icon: React.ReactNode;
    dot: string;
    textColor: string;
}> = {
    green: {
        bar: "bg-emerald-500/10 border-emerald-500/30",
        icon: <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />,
        dot: "bg-emerald-500",
        textColor: "text-emerald-600 dark:text-emerald-400",
    },
    yellow: {
        bar: "bg-amber-500/10 border-amber-500/30",
        icon: <AlertCircle size={15} className="text-amber-500 shrink-0" />,
        dot: "bg-amber-500",
        textColor: "text-amber-600 dark:text-amber-400",
    },
    purple: {
        bar: "bg-[#9E77E5]/10 border-[#9E77E5]/30",
        icon: <Zap size={15} className="text-[#9E77E5] shrink-0" />,
        dot: "bg-[#9E77E5]",
        textColor: "text-[#9E77E5]",
    },
    red: {
        bar: "bg-destructive/10 border-destructive/30",
        icon: <AlertTriangle size={15} className="text-destructive shrink-0" />,
        dot: "bg-destructive",
        textColor: "text-destructive",
    },
};

export function HealthStatusBanner({
    slaCompliance,
    maxAgentWorkload,
    totalOpenTickets = 0,
    avgFrtSeconds = 0,
    hasActiveEvent = false,
    workloadThreshold = 5,
    slaThreshold = 95,
}: HealthStatusBannerProps) {
    const health = computeHealth({
        slaCompliance, maxAgentWorkload, totalOpenTickets,
        avgFrtSeconds, hasActiveEvent, workloadThreshold, slaThreshold,
    });
    const style = HEALTH_STYLES[health.level];

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className={`flex items-center gap-3 px-3 py-1.5 rounded-full border cursor-help transition-all duration-500 ${style.bar}`}>
                        {style.icon}
                        <div className="flex items-center gap-2">
                            <div className={`h-1.5 w-1.5 rounded-full animate-pulse ${style.dot}`} />
                            <span className={`text-[10px] font-black uppercase tracking-wider ${style.textColor}`}>
                                {health.label}
                            </span>
                            <span className="text-[9px] text-muted-foreground hidden sm:block">
                                · {health.sublabel}
                            </span>
                        </div>
                    </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[260px] text-[11px] leading-snug">
                    <p className="font-bold mb-1">Semáforo Operativo</p>
                    <p>{health.reason}</p>
                    <div className="mt-2 space-y-1 text-[10px] text-muted-foreground border-t pt-1">
                        <p>🟢 Verde: SLA ≥{slaThreshold}% + FRT &lt;5min + &lt;10 tickets</p>
                        <p>🟡 Amarillo: FRT &gt;5min o más de 10 tickets abiertos</p>
                        <p>🟣 Púrpura: Evento de Alta Demanda activo</p>
                        <p>🔴 Rojo: SLA &lt;{slaThreshold}% Y sobrecarga crítica</p>
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
