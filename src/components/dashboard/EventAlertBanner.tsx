"use client";

import { X, Zap, Flame } from "lucide-react";
import React, { useState } from "react";

interface Event {
    id: string;
    title: string;
    description?: string | null;
    type: string;
}

interface EventAlertBannerProps {
    events: Event[];
}

const EVENT_STYLES: Record<string, {
    bar: string;
    glow: string;
    icon: React.ReactNode;
}> = {
    Maintenance: {
        bar: "bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-300",
        glow: "shadow-[0_0_60px_8px_rgba(245,158,11,0.12)] ring-1 ring-amber-500/20",
        icon: <span>🔧</span>,
    },
    Promotion: {
        bar: "bg-secondary/10 border-secondary/40 text-secondary",
        glow: "shadow-[0_0_60px_8px_rgba(158,119,229,0.15)] ring-1 ring-secondary/20",
        icon: <span>📢</span>,
    },
    Launch: {
        bar: "bg-primary/10 border-primary/40 text-primary",
        glow: "shadow-[0_0_60px_8px_rgba(103,170,9,0.18)] ring-1 ring-primary/25",
        icon: <span>🚀</span>,
    },
    Meeting: {
        bar: "bg-blue-500/10 border-blue-500/40 text-blue-600 dark:text-blue-300",
        glow: "shadow-[0_0_60px_8px_rgba(59,130,246,0.12)] ring-1 ring-blue-500/20",
        icon: <span>📅</span>,
    },
    default: {
        bar: "bg-primary/10 border-primary/40 text-primary",
        glow: "shadow-[0_0_60px_8px_rgba(103,170,9,0.20)] ring-1 ring-primary/30",
        icon: <Flame size={14} />,
    },
};

/**
 * Banner that shows at the top of the dashboard for active high-demand events.
 */
export function EventAlertBanner({ events }: EventAlertBannerProps) {
    const [dismissed, setDismissed] = useState<string[]>([]);
    const active = events.filter((e) => !dismissed.includes(e.id));
    if (active.length === 0) return null;

    return (
        <div className="space-y-2 mb-4">
            {active.map((event) => {
                const style = EVENT_STYLES[event.type] || EVENT_STYLES.default;
                return (
                    <div
                        key={event.id}
                        className={`flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border ${style.bar} animate-in slide-in-from-top-2 duration-300`}
                    >
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="flex items-center gap-1.5 shrink-0">
                                <Zap size={11} className="animate-pulse" />
                                <span className="text-[9px] font-black uppercase tracking-widest opacity-60">
                                    Alta Demanda
                                </span>
                            </div>
                            <div className="h-3 w-px bg-current opacity-20 shrink-0" />
                            <div className="flex items-center gap-1.5 min-w-0">
                                {style.icon}
                                <span className="text-[12px] font-bold truncate">{event.title}</span>
                            </div>
                            {event.description && (
                                <span className="text-[11px] opacity-60 truncate hidden md:block">
                                    — {event.description}
                                </span>
                            )}
                        </div>
                        <button
                            onClick={() => setDismissed((p) => [...p, event.id])}
                            className="shrink-0 opacity-50 hover:opacity-100 transition-opacity p-1 rounded"
                            aria-label="Cerrar"
                        >
                            <X size={13} />
                        </button>
                    </div>
                );
            })}
        </div>
    );
}


