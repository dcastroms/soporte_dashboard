"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, CalendarDays, Inbox, Sparkles } from "lucide-react";
import Link from "next/link";

interface WelcomePanelProps {
    agentName?: string | null;
}

const STEPS = [
    {
        icon: CheckCircle2,
        color: "text-primary",
        bg: "bg-primary/10",
        label: "1. Check-in de Turno",
        description: "Confirma tu turno activo en el calendario de Turnos para que el equipo sepa quién está disponible.",
        href: "/shifts",
        cta: "Ir a Turnos →",
    },
    {
        icon: CalendarDays,
        color: "text-secondary",
        bg: "bg-secondary/10",
        label: "2. Revisar Eventos Críticos",
        description: "Verifica si hay partidos, mantenimientos o lanzamientos activos hoy que pongan al equipo en Modo Alta Demanda.",
        href: "/events",
        cta: "Ver Eventos →",
    },
    {
        icon: Inbox,
        color: "text-warning",
        bg: "bg-warning/10",
        label: "3. Live Workload",
        description: "Revisa los tickets abiertos y asegúrate de que ningún agente esté sobrecargado. Redistribuye si es necesario.",
        href: "/shifts",
        cta: "Ver Carga →",
    },
];

export function WelcomePanel({ agentName }: WelcomePanelProps) {
    const first = agentName?.split(' ')[0] ?? "Agente";

    return (
        <Card>
            <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                    <Sparkles size={16} className="text-primary" />
                    <div>
                        <p className="text-sm font-black text-foreground">¡Hola, {first}!</p>
                        <p className="text-[10px] text-muted-foreground">Guía de inicio de turno — 3 pasos clave</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-2">
                    {STEPS.map((step) => (
                        <Link
                            key={step.label}
                            href={step.href}
                            className="flex items-start gap-3 p-2.5 rounded-lg border border-border hover:bg-muted/40 transition-colors group"
                        >
                            <div className={`p-1.5 rounded-lg ${step.bg} shrink-0`}>
                                <step.icon size={13} className={step.color} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-[10px] font-black text-foreground uppercase tracking-tight">{step.label}</p>
                                <p className="text-[9px] text-muted-foreground leading-relaxed mt-0.5">{step.description}</p>
                            </div>
                            <span className={`text-[9px] font-bold shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ${step.color}`}>
                                {step.cta}
                            </span>
                        </Link>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
