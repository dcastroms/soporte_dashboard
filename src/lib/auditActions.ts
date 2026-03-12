"use server";

import { prisma } from "@/lib/prisma";

const INTERCOM_APP_ID = process.env.INTERCOM_APP_ID || "here";

export interface RedFlagTicket {
  id: string;
  subject: string;
  status: string;
  priority: string | null;
  client: string | null;
  ticketType: string | null;
  module: string | null;
  teammateName: string | null;
  staleHours: number;
  isVip: boolean;
  flag: "stale" | "reopened" | "waiting";
  intercomUrl: string;
}

export interface TicketTypeInsight {
  type: string;
  category: "Type" | "Module" | "Client";
  count: number;
  pct: number;   // % of total volume
}

const STALE_THRESHOLD_MS = 4 * 60 * 60 * 1000; // 4 hours
const VIP_KEYWORDS = ["elecciones", "copa", "partido", "evento", "critical", "p1", "live", "señal"];

/**
 * Red Flag Tickets: stale open tickets (no update > 4h)
 * + any still-open ticket with high/urgent priority
 */
export async function getRedFlagTickets(): Promise<RedFlagTicket[]> {
  const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS);

  const stale = await prisma.intercomConversation.findMany({
    where: {
      status: { in: ["open", "snoozed"] },
      updatedAt: { lt: cutoff },
      intercomId: { not: "" },
    },
    orderBy: { updatedAt: "asc" },
    take: 20,
  });

  // Also grab high-priority open tickets even if recently updated
  const highPriority = await prisma.intercomConversation.findMany({
    where: {
      status: { in: ["open", "snoozed"] },
      priority: { in: ["high", "urgent"] },
      updatedAt: { gte: cutoff },
      intercomId: { not: "" },
    },
    orderBy: { updatedAt: "asc" },
    take: 10,
  });

  const seen = new Set<string>();
  const combined = [...stale, ...highPriority].filter(t => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });

  return combined.map(t => {
    const staleMs = Date.now() - t.updatedAt.getTime();
    const staleHours = parseFloat((staleMs / 3600000).toFixed(1));
    const subjectLower = (t.subject ?? "").toLowerCase();
    const isVip =
      t.priority === "urgent" ||
      VIP_KEYWORDS.some(kw => subjectLower.includes(kw));

    const flag: RedFlagTicket["flag"] =
      staleMs >= STALE_THRESHOLD_MS ? "stale" : "waiting";

    return {
      id: t.intercomId,
      subject: t.subject ?? "Sin asunto",
      status: t.status,
      priority: t.priority,
      client: t.client,
      ticketType: t.ticketType,
      module: t.module,
      teammateName: t.teammateName,
      staleHours,
      isVip,
      flag,
      // Use the stable Intercom app URL (/apps/) which works as a reliable deep link
      intercomUrl: `https://app.intercom.com/a/apps/${INTERCOM_APP_ID}/conversations/${t.intercomId}`,
    };
  });
}

/**
 * Ticket Type / Module breakdown for insights panel.
 * Uses IntercomCategoryMetric which aggregates by ticket type and module.
 */
export async function getTicketTypeInsights(): Promise<TicketTypeInsight[]> {
  const IGNORED = new Set(["no aplica", "n/a", "na", "otro", "other", "ninguno", "none", "no-aplica", "no_aplica"]);
  const ignore = (v: string) => IGNORED.has(v.trim().toLowerCase());

  const [rawTypes, rawModules] = await Promise.all([
    prisma.intercomCategoryMetric.findMany({
      where: { category: "Type" },
      orderBy: { count: "desc" },
      take: 20,
    }),
    prisma.intercomCategoryMetric.findMany({
      where: { category: "Module" },
      orderBy: { count: "desc" },
      take: 20,
    }),
  ]);

  const typeMetrics = rawTypes.filter(m => !ignore(m.value));
  const moduleMetrics = rawModules.filter(m => !ignore(m.value));

  const typeTotal = typeMetrics.reduce((s, m) => s + m.count, 0) || 1;
  const modTotal = moduleMetrics.reduce((s, m) => s + m.count, 0) || 1;

  const types: TicketTypeInsight[] = typeMetrics.slice(0, 10).map(m => ({
    type: m.value,
    category: "Type",
    count: m.count,
    pct: parseFloat(((m.count / typeTotal) * 100).toFixed(1)),
  }));

  const modules: TicketTypeInsight[] = moduleMetrics.slice(0, 5).map(m => ({
    type: m.value,
    category: "Module",
    count: m.count,
    pct: parseFloat(((m.count / modTotal) * 100).toFixed(1)),
  }));

  return [...types, ...modules];
}

/**
 * Reopen rate: % of conversations that were re-opened after being closed.
 * We approximate by counting conversations with status "open" that have
 * a closedCount from metrics vs open ones older than 1 day.
 */
export async function getReopenRate(): Promise<{ rate: number; isAlert: boolean }> {
  const [total, reopened] = await Promise.all([
    prisma.intercomConversation.count(),
    // Proxy: open tickets that are older than 1 day (likely re-opened after closure)
    prisma.intercomConversation.count({
      where: {
        status: "open",
        createdAt: { lt: new Date(Date.now() - 86400000) },
      },
    }),
  ]);

  const rate = total > 0 ? parseFloat(((reopened / total) * 100).toFixed(1)) : 0;
  return { rate, isAlert: rate > 10 };
}
