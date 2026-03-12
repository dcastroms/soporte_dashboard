"use server";

import { prisma } from "@/lib/prisma";

// ─── Static region mapping for known Mediastream clients ─────────────────────
const CLIENT_REGION: Record<string, { country: string; flag: string }> = {
  caracol: { country: "Colombia", flag: "🇨🇴" },
  rcn: { country: "Colombia", flag: "🇨🇴" },
  canal1: { country: "Colombia", flag: "🇨🇴" },
  canalrc: { country: "Colombia", flag: "🇨🇴" },
  mega: { country: "Chile", flag: "🇨🇱" },
  "canal 13": { country: "Chile", flag: "🇨🇱" },
  tvn: { country: "Chile", flag: "🇨🇱" },
  chilevisión: { country: "Chile", flag: "🇨🇱" },
  multimedios: { country: "México", flag: "🇲🇽" },
  azteca: { country: "México", flag: "🇲🇽" },
  "tv azteca": { country: "México", flag: "🇲🇽" },
  televisa: { country: "México", flag: "🇲🇽" },
  latina: { country: "Perú", flag: "🇵🇪" },
  panamericana: { country: "Perú", flag: "🇵🇪" },
  telemundo: { country: "EEUU", flag: "🇺🇸" },
  univision: { country: "EEUU", flag: "🇺🇸" },
  willax: { country: "Perú", flag: "🇵🇪" },
  win: { country: "Colombia", flag: "🇨🇴" },
  tigo: { country: "Colombia", flag: "🇨🇴" },
};

function getRegion(client: string): { country: string; flag: string } {
  const lower = client.toLowerCase();
  for (const [key, val] of Object.entries(CLIENT_REGION)) {
    if (lower.includes(key)) return val;
  }
  return { country: "Otro", flag: "🌎" };
}

// Values that are placeholders / internal threads — excluded from all reports
const IGNORED_VALUES = new Set([
  "no aplica", "n/a", "na", "otro", "other", "ninguno", "none",
  "no aplica", "no-aplica", "no_aplica",
]);

function isIgnored(value: string | null | undefined): boolean {
  if (!value) return true;
  return IGNORED_VALUES.has(value.trim().toLowerCase());
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ClientRow {
  client: string;
  country: string;
  flag: string;
  total: number;
  open: number;
  closed: number;
  consultas: number;   // ticketType = consulta/general/query
  escalaciones: number; // ticketType = bug/error/escalamento/técnico
  bugs: number;
  stale9: number;      // open >9 days
  stale15: number;     // open >15 days
  latestTicketId: string | null;
  latestTicketDate: Date | null;
}

export interface CriticalAccount {
  client: string;
  country: string;
  flag: string;
  staleDays: number;
  staleCount: number;
  bugCount: number;
  alertType: "stale" | "bug_regression" | "both";
  latestTicketId: string | null;
}

const ESCALATION_TYPES = ["bug", "error", "escalamiento", "técnico", "tecnico", "technical"];
const CONSULT_TYPES = ["consulta", "general", "pregunta", "query", "información", "info"];
const BUG_TYPES = ["bug", "error", "falla", "falla técnica"];

function categorize(ticketType: string | null): "bug" | "escalacion" | "consulta" | "skip" | "other" {
  if (isIgnored(ticketType)) return "skip"; // Ignore 'No Aplica', 'Otro', etc.
  const t = (ticketType ?? "").toLowerCase();
  if (BUG_TYPES.some(k => t.includes(k))) return "bug";
  if (ESCALATION_TYPES.some(k => t.includes(k))) return "escalacion";
  if (CONSULT_TYPES.some(k => t.includes(k))) return "consulta";
  return "other";
}

/**
 * Returns per-client ticket breakdown grouped from the DB.
 */
export async function getClientBreakdown(): Promise<ClientRow[]> {
  const conversations = await prisma.intercomConversation.findMany({
    where: {
      client: { not: null },
    },
    select: {
      client: true,
      status: true,
      ticketType: true,
      createdAt: true,
      updatedAt: true,
      intercomId: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const now = Date.now();
  const MAP = new Map<string, ClientRow>();

  for (const conv of conversations) {
    // Skip placeholder client values ("No Aplica", "N/A", "Otro", etc.)
    if (isIgnored(conv.client)) continue;
    const client = conv.client!;
    const key = client.toLowerCase();
    if (!MAP.has(key)) {
      const region = getRegion(client);
      MAP.set(key, {
        client,
        country: region.country,
        flag: region.flag,
        total: 0,
        open: 0,
        closed: 0,
        consultas: 0,
        escalaciones: 0,
        bugs: 0,
        stale9: 0,
        stale15: 0,
        latestTicketId: null,
        latestTicketDate: null,
      });
    }
    const row = MAP.get(key)!;
    row.total++;

    const isOpen = conv.status === "open" || conv.status === "snoozed";
    if (isOpen) {
      row.open++;
      const ageDays = (now - conv.updatedAt.getTime()) / 86400000;
      if (ageDays >= 15) { row.stale15++; row.stale9++; }
      else if (ageDays >= 9) row.stale9++;
    } else {
      row.closed++;
    }

    const cat = categorize(conv.ticketType);
    if (cat === "bug") row.bugs++;
    if (cat === "bug" || cat === "escalacion") row.escalaciones++;
    if (cat === "consulta") row.consultas++;

    if (!row.latestTicketDate || conv.createdAt > row.latestTicketDate) {
      row.latestTicketDate = conv.createdAt;
      row.latestTicketId = conv.intercomId;
    }
  }

  return Array.from(MAP.values())
    .sort((a, b) => b.total - a.total);
}

/**
 * Returns accounts flagged as critical (stale >9d or >=3 bugs).
 */
export async function getCriticalAccounts(): Promise<CriticalAccount[]> {
  const rows = await getClientBreakdown();
  const critical: CriticalAccount[] = [];

  for (const row of rows) {
    const hasStale = row.stale9 > 0;
    const hasBugs = row.bugs >= 3;
    if (!hasStale && !hasBugs) continue;

    // Find worst stale ticket age
    let staleDays = 0;
    if (row.stale15 > 0) staleDays = 15;
    else if (row.stale9 > 0) staleDays = 9;

    const alertType: CriticalAccount["alertType"] =
      hasStale && hasBugs ? "both" : hasStale ? "stale" : "bug_regression";

    critical.push({
      client: row.client,
      country: row.country,
      flag: row.flag,
      staleDays,
      staleCount: row.stale9,
      bugCount: row.bugs,
      alertType,
      latestTicketId: row.latestTicketId,
    });
  }

  return critical.sort((a, b) => {
    // Sort: "both" first, then stale, then bug
    const order = { both: 0, stale: 1, bug_regression: 2 };
    return order[a.alertType] - order[b.alertType];
  });
}

/**
 * Weekly efficiency: received vs solved this week.
 */
export async function getWeeklyEfficiency(): Promise<{ received: number; solved: number; efficiency: number }> {
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
  weekStart.setHours(0, 0, 0, 0);

  const [received, solved] = await Promise.all([
    prisma.intercomConversation.count({
      where: { createdAt: { gte: weekStart } },
    }),
    prisma.intercomConversation.count({
      where: { createdAt: { gte: weekStart }, status: "closed" },
    }),
  ]);

  const efficiency = received > 0 ? Math.round((solved / received) * 100) : 0;
  return { received, solved, efficiency };
}

// ─── Types for Client Audit ──────────────────────────────────────────────────

export interface AuditTicket {
  intercomId: string;
  subject: string;
  status: string;
  priority: string | null;
  ticketType: string | null;
  module: string | null;
  teammateName: string | null;
  createdAt: Date;
  updatedAt: Date;
  staleHours: number;
  isRedFlag: boolean;
  intercomUrl: string;
}

export interface DayActivity {
  date: string; // YYYY-MM-DD
  opened: number;
  closed: number;
  updated: number;
}

export interface TypeCount {
  label: string;
  count: number;
  pct: number;
}

export interface ClientKPIs {
  ttr: number | null;        // avg hours to close (client)
  fcr: number | null;        // % closed within 24h (client)
  total: number;
  open: number;
  closed: number;
  bugs: number;
  globalTtr: number | null;  // avg hours to close (all clients)
  globalFcr: number | null;  // % closed within 24h (all clients)
}

export interface ClientAuditData {
  client: {
    name: string;
    slug: string;
  };
  country: string;
  flag: string;
  kpis: ClientKPIs;
  redFlags: AuditTicket[];
  allTickets: AuditTicket[];
  typeBreakdown: TypeCount[];
  timeline: DayActivity[];
}

const INTERCOM_APP_ID = process.env.INTERCOM_APP_ID || "here";
const STALE_HOURS_DEFAULT = 9 * 3600000; // 9h
const STALE_HOURS_PRIORITY = 1 * 3600000; // 1h for High/Urgent

function toAuditTicket(conv: any): AuditTicket {
  const staleMs = Date.now() - new Date(conv.updatedAt).getTime();
  const staleHours = parseFloat((staleMs / 3600000).toFixed(1));
  const isOpen = conv.status === "open" || conv.status === "snoozed";
  
  // Logic: >9h for everyone OR >1h for High/Urgent
  const isPriority = conv.priority === "high" || conv.priority === "urgent";
  const threshold = isPriority ? STALE_HOURS_PRIORITY : STALE_HOURS_DEFAULT;
  const isRedFlag = isOpen && staleMs >= threshold;

  return {
    intercomId: conv.intercomId,
    subject: conv.subject ?? "Sin asunto",
    status: conv.status,
    priority: conv.priority,
    ticketType: conv.ticketType,
    module: conv.module,
    teammateName: conv.teammateName,
    createdAt: new Date(conv.createdAt),
    updatedAt: new Date(conv.updatedAt),
    staleHours,
    isRedFlag,
    intercomUrl: `https://app.intercom.com/a/apps/${INTERCOM_APP_ID}/conversations/${conv.intercomId}`,
  };
}

/**
 * Full audit data for an individual client.
 * `slug` is the URL-encoded client name (decoded before querying).
 */
export async function getClientAudit(slug: string): Promise<any | null> {
  const clientName = decodeURIComponent(slug);

  // Fetch all conversations for this client (case-insensitive partial match)
  const [clientConvs, allConvs] = await Promise.all([
    prisma.intercomConversation.findMany({
      where: {
        client: { contains: clientName, mode: "insensitive" },
      },
      orderBy: { createdAt: "desc" },
    }),
    // Light global sample for average comparison
    prisma.intercomConversation.findMany({
      select: {
        status: true,
        createdAt: true,
        updatedAt: true,
        firstResponseTime: true,
      },
      where: { client: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 1000,
    }),
  ]);

  if (clientConvs.length === 0) return null;

  const region = getRegion(clientName);

  // ... (previous KPI logic)
  const closed = clientConvs.filter(c => c.status === "closed");
  const open = clientConvs.filter(c => c.status === "open" || c.status === "snoozed");

  const ttr = closed.length > 0
    ? closed.reduce((s, c) => s + (new Date(c.updatedAt).getTime() - new Date(c.createdAt).getTime()), 0) / closed.length / 3600000
    : null;

  const closedFast = closed.filter(c =>
    (new Date(c.updatedAt).getTime() - new Date(c.createdAt).getTime()) < 86400000
  );
  const fcr = closed.length > 0 ? (closedFast.length / closed.length) * 100 : null;

  const globalClosed = allConvs.filter(c => c.status === "closed");
  const globalTtr = globalClosed.length > 0
    ? globalClosed.reduce((s, c) => s + (new Date(c.updatedAt).getTime() - new Date(c.createdAt).getTime()), 0) / globalClosed.length / 3600000
    : null;
  const globalClosedFast = globalClosed.filter(c =>
    (new Date(c.updatedAt).getTime() - new Date(c.createdAt).getTime()) < 86400000
  );
  const globalFcr = globalClosed.length > 0 ? (globalClosedFast.length / globalClosed.length) * 100 : null;

  const bugs = clientConvs.filter(c => (c.ticketType ?? "").toLowerCase().includes("bug") || (c.ticketType ?? "").toLowerCase().includes("error")).length;

  const kpis: ClientKPIs = {
    ttr: ttr !== null ? parseFloat(ttr.toFixed(1)) : null,
    fcr: fcr !== null ? parseFloat(fcr.toFixed(1)) : null,
    total: clientConvs.length,
    open: open.length,
    closed: closed.length,
    bugs,
    globalTtr: globalTtr !== null ? parseFloat(globalTtr.toFixed(1)) : null,
    globalFcr: globalFcr !== null ? parseFloat(globalFcr.toFixed(1)) : null,
  };

  const allTickets = clientConvs.map(toAuditTicket);
  const redFlags = allTickets.filter(t => t.isRedFlag);

  const typeCounts: Record<string, number> = {};
  for (const conv of clientConvs) {
    const t = conv.ticketType?.trim() || "Sin clasificar";
    if (isIgnored(t)) continue;
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  }
  const typeTotal = Object.values(typeCounts).reduce((s, v) => s + v, 0) || 1;
  const typeBreakdown: TypeCount[] = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, count]) => ({
      label,
      count,
      pct: parseFloat(((count / typeTotal) * 100).toFixed(1)),
    }));

  const since = new Date(Date.now() - 7 * 86400000);
  const dayMap: Record<string, DayActivity> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    dayMap[key] = { date: key, opened: 0, closed: 0, updated: 0 };
  }
  for (const conv of clientConvs) {
    const crKey = new Date(conv.createdAt).toISOString().slice(0, 10);
    const upKey = new Date(conv.updatedAt).toISOString().slice(0, 10);
    if (dayMap[crKey]) dayMap[crKey].opened++;
    if (dayMap[upKey] && conv.status === "closed") dayMap[upKey].closed++;
    else if (dayMap[upKey] && new Date(conv.updatedAt) > since) dayMap[upKey].updated++;
  }

  return {
    client: {
        name: clientConvs[0].client ?? clientName,
        slug: clientName,
    },
    country: region.country,
    flag: region.flag,
    kpis,
    redFlags: redFlags.slice(0, 15),
    allTickets: allTickets.slice(0, 30),
    typeBreakdown,
    timeline: Object.values(dayMap),
  };
}
