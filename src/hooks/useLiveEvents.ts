"use client";

import { useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";

export interface LiveEvent {
  type: "new_ticket" | "ticket_updated" | "vip_ticket" | "new_calendar_event" | "connected";
  data: Record<string, any>;
}

interface UseLiveEventsOptions {
  onNewTicket?: (data: Record<string, any>) => void;
  onVipTicket?: (data: Record<string, any>) => void;
  onCalendarEvent?: (data: Record<string, any>) => void;
  showToasts?: boolean;       // default true
  enablePush?: boolean;       // default true — request browser push permission
}

/**
 * Connects to the SSE stream at /api/webhooks/intercom/stream and
 * dispatches real-time events as sonner toasts and optional push notifications.
 *
 * Usage:
 * ```ts
 * useLiveEvents({ showToasts: true, enablePush: true })
 * ```
 */
export function useLiveEvents({
  onNewTicket,
  onVipTicket,
  onCalendarEvent,
  showToasts = true,
  enablePush = true,
}: UseLiveEventsOptions = {}) {
  const esRef = useRef<EventSource | null>(null);
  const swRef = useRef<ServiceWorkerRegistration | null>(null);

  // --- Browser Push notification ---
  const sendPush = useCallback(async (title: string, body: string, url?: string) => {
    if (!enablePush || typeof window === "undefined") return;

    // Register service worker on first use
    if ("serviceWorker" in navigator && !swRef.current) {
      try {
        swRef.current = await navigator.serviceWorker.register("/sw.js");
      } catch {
        // Silently fail — push is an enhancement, not critical
      }
    }

    if (Notification.permission === "default") {
      await Notification.requestPermission();
    }

    if (Notification.permission === "granted") {
      // Use SW notification so it works while tab is in background
      if (swRef.current) {
        swRef.current.showNotification(title, {
          body,
          icon: "/favicon.ico",
          badge: "/favicon.ico",
          data: { url },
          tag: "soporte-360", // collapses multiple notis
        });
      } else {
        new Notification(title, { body, icon: "/favicon.ico" });
      }
    }
  }, [enablePush]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const es = new EventSource("/api/webhooks/intercom/stream");
    esRef.current = es;

    es.addEventListener("connected", () => {
      console.log("[LiveEvents] SSE connected");
    });

    es.addEventListener("new_ticket", (e) => {
      const data = JSON.parse(e.data);
      onNewTicket?.(data);

      if (showToasts) {
        toast.success("🎫 Nuevo Ticket", {
          description: data.subject || "Ticket sin asunto",
          action: data.url ? { label: "Abrir", onClick: () => window.open(data.url, "_blank") } : undefined,
          duration: 6000,
          className: "border border-primary/20",
        });
      }

      // Pulse the ticket counter via custom event
      window.dispatchEvent(new CustomEvent("live:new_ticket", { detail: data }));
    });

    es.addEventListener("vip_ticket", (e) => {
      const data = JSON.parse(e.data);
      onVipTicket?.(data);

      if (showToasts) {
        toast.warning("⭐ Ticket VIP / Alta Prioridad", {
          description: data.subject,
          action: data.url ? { label: "Atender ahora", onClick: () => window.open(data.url, "_blank") } : undefined,
          duration: 10000,
          className: "border border-[#9E77E5]/40",
        });
      }

      // Desktop push for VIP — even if on another tab
      sendPush(
        "⭐ Ticket VIP — Acción Requerida",
        data.subject || "Un cliente VIP necesita atención inmediata.",
        data.url
      );
    });

    es.addEventListener("ticket_updated", (e) => {
      const data = JSON.parse(e.data);
      window.dispatchEvent(new CustomEvent("live:ticket_updated", { detail: data }));
    });

    es.addEventListener("new_calendar_event", (e) => {
      const data = JSON.parse(e.data);
      onCalendarEvent?.(data);

      if (showToasts) {
        toast("📅 Nuevo Evento Crítico Programado", {
          description: data.title || "Revisa el calendario de eventos.",
          duration: 8000,
          className: "border border-amber-500/30",
        });
      }

      window.dispatchEvent(new CustomEvent("live:calendar_event", { detail: data }));
    });

    es.onerror = () => {
      // Reconnect after 5s silently
      setTimeout(() => {
        esRef.current?.close();
        esRef.current = null;
        // The component will reconnect on next render — or you can trigger state update
      }, 5000);
    };

    return () => {
      es.close();
    };
  }, [onNewTicket, onVipTicket, onCalendarEvent, showToasts, sendPush]);

  return {
    /** Manually trigger a desktop push notification */
    sendPush,
  };
}
