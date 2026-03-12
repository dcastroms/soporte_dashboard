"use server";

/**
 * Slack Notification Actions for Handover & Weekly Summary
 *
 * Required env vars:
 *   SLACK_WEBHOOK_URL  — Incoming Webhook from your Slack App config
 *   SLACK_CHANNEL      — optional override (e.g. "#platform_clientes")
 */

export interface HandoverNotificationPayload {
  agentName: string;
  shiftType: string;          // "Mañana" | "Tarde" | "Noche"
  openTickets: number;
  criticalNotes: string;
  pendingIssues: string[];
  handoverTime: string;       // ISO string
}

export interface WeeklySummaryPayload {
  weekLabel: string;
  csatCurrent: number;
  csatPrev: number;
  frtMinsCurrent: number;
  frtMinsPrev: number;
  volumeCurrent: number;
  volumePrev: number;
  wins: string[];
  actions: string[];
}

function delta(current: number, prev: number, inverse = false) {
  if (!prev) return "";
  const pct = ((current - prev) / prev) * 100;
  const improved = inverse ? pct < 0 : pct > 0;
  return `${improved ? "🟢" : "🔴"} ${Math.abs(pct).toFixed(1)}%`;
}

/**
 * Sends a Slack notification when a shift handover is completed.
 * Triggered by the handover form submit.
 */
export async function notifySlackHandover(payload: HandoverNotificationPayload) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) {
    console.warn("[Slack] SLACK_WEBHOOK_URL not set — skipping notification");
    return { ok: false, reason: "No webhook configured" };
  }

  const blocks = [
    {
      type: "header",
      text: { type: "plain_text", text: `🔄 Entrega de Turno — ${payload.shiftType}`, emoji: true },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Agente:*\n${payload.agentName}` },
        { type: "mrkdwn", text: `*Hora:*\n${new Date(payload.handoverTime).toLocaleString("es")}` },
        { type: "mrkdwn", text: `*Tickets Abiertos:*\n${payload.openTickets}` },
        { type: "mrkdwn", text: `*Turno:*\n${payload.shiftType}` },
      ],
    },
    payload.criticalNotes && {
      type: "section",
      text: { type: "mrkdwn", text: `*📌 Novedades Críticas:*\n${payload.criticalNotes}` },
    },
    payload.pendingIssues.length > 0 && {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*⚠️ Issues Pendientes:*\n${payload.pendingIssues.map(i => `• ${i}`).join("\n")}`,
      },
    },
    { type: "divider" },
    {
      type: "context",
      elements: [{ type: "mrkdwn", text: "Enviado automáticamente por *Soporte 360* · Dashboard Mediastream" }],
    },
  ].filter(Boolean);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocks }),
    });
    return { ok: res.ok };
  } catch (err) {
    console.error("[Slack] Failed to send handover notification:", err);
    return { ok: false, reason: String(err) };
  }
}

/**
 * Sends a Slack weekly summary with KPI comparison.
 * Can be called from a cron job or the report generator button.
 */
export async function notifySlackWeeklySummary(payload: WeeklySummaryPayload) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) {
    console.warn("[Slack] SLACK_WEBHOOK_URL not set — skipping notification");
    return { ok: false, reason: "No webhook configured" };
  }

  const blocks = [
    {
      type: "header",
      text: { type: "plain_text", text: `📊 Resumen Semanal — ${payload.weekLabel}`, emoji: true },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: "*Rendimiento KPI vs. semana anterior:*" },
      fields: [
        { type: "mrkdwn", text: `*CSAT:* ${payload.csatCurrent.toFixed(1)}% ${delta(payload.csatCurrent, payload.csatPrev)}` },
        { type: "mrkdwn", text: `*FRT:* ${payload.frtMinsCurrent.toFixed(1)} min ${delta(payload.frtMinsCurrent, payload.frtMinsPrev, true)}` },
        { type: "mrkdwn", text: `*Volumen:* ${payload.volumeCurrent} tickets ${delta(payload.volumeCurrent, payload.volumePrev)}` },
      ],
    },
    payload.wins.length > 0 && {
      type: "section",
      text: { type: "mrkdwn", text: `*✅ Victorias:*\n${payload.wins.map(w => `• ${w}`).join("\n")}` },
    },
    payload.actions.length > 0 && {
      type: "section",
      text: { type: "mrkdwn", text: `*🎯 Acciones Próxima Semana:*\n${payload.actions.map(a => `• ${a}`).join("\n")}` },
    },
    { type: "divider" },
    {
      type: "context",
      elements: [{ type: "mrkdwn", text: "Enviado automáticamente por *Soporte 360* · Dashboard Mediastream" }],
    },
  ].filter(Boolean);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocks }),
    });
    return { ok: res.ok };
  } catch (err) {
    console.error("[Slack] Failed to send weekly summary:", err);
    return { ok: false, reason: String(err) };
  }
}

/**
 * POST /api/notifications/weekly-report
 * Cron-callable endpoint wrapper for the weekly Slack summary.
 * Protected by CRON_SECRET header check.
 */
export async function triggerWeeklyReport(secret: string, payload: WeeklySummaryPayload) {
  if (secret !== process.env.CRON_SECRET) {
    return { ok: false, reason: "Unauthorized" };
  }
  return notifySlackWeeklySummary(payload);
}
