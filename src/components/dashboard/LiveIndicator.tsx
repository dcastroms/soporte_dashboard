"use client";

import { useLiveEvents } from "@/hooks/useLiveEvents";
import { useState, useEffect } from "react";

/**
 * LiveIndicator — drops into any layout to:
 * 1. Maintain the SSE connection via useLiveEvents
 * 2. Show a pulsing LIVE dot in the header
 * 3. Pulse when a new event arrives
 */
export function LiveIndicator() {
    const [isConnected, setIsConnected] = useState(false);
    const [ticketCount, setTicketCount] = useState(0);
    const [pulse, setPulse] = useState(false);

    useLiveEvents({
        showToasts: true,
        enablePush: true,
        onNewTicket: () => {
            setTicketCount((n) => n + 1);
            setPulse(true);
            setTimeout(() => setPulse(false), 1500);
        },
        onVipTicket: () => {
            setPulse(true);
            setTimeout(() => setPulse(false), 2000);
        },
    });

    // Watch for the connected SSE event via the custom window event
    useEffect(() => {
        const onTicket = () => setIsConnected(true);
        // We mark connected after the first SSE frame arrives by setting a short timer
        const t = setTimeout(() => setIsConnected(true), 2000);
        window.addEventListener("live:new_ticket", onTicket);
        return () => {
            clearTimeout(t);
            window.removeEventListener("live:new_ticket", onTicket);
        };
    }, []);

    return (
        <div className="flex items-center gap-1.5 select-none">
            {/* Pulse ring when event arrives */}
            <div className="relative flex items-center justify-center h-5 w-5">
                {pulse && (
                    <span className="absolute inline-flex h-full w-full rounded-full bg-secondary opacity-50 animate-ping" />
                )}
                <span
                    className={`relative inline-flex h-2 w-2 rounded-full transition-colors duration-500 ${isConnected ? "bg-secondary" : "bg-muted-foreground/40"
                        }`}
                />
            </div>
            <span
                className={`text-[9px] font-black uppercase tracking-widest transition-colors duration-500 ${isConnected ? "text-secondary" : "text-muted-foreground/50"
                    }`}
            >
                {isConnected ? "LIVE" : "···"}
            </span>
            {ticketCount > 0 && (
                <span className="ml-0.5 text-[8px] font-bold bg-primary/10 text-primary px-1 rounded-full animate-in fade-in">
                    +{ticketCount}
                </span>
            )}
        </div>
    );
}
