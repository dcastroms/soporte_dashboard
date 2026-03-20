"use server";

import { prisma } from "./prisma";
import { revalidatePath } from "next/cache";
import { google } from "googleapis";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { after } from "next/server";

export async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized: Authentication required for this action");
  return session;
}

// --- TEAM LOGS ---
export async function getTeamLogs() {
  return await prisma.teamLog.findMany({
    orderBy: { createdAt: 'desc' }
  });
}

export async function createTeamLog(data: {
  date: string,
  shift: string,
  person: string,
  event: string,
  type: string
}) {
  await requireAuth();
  const log = await prisma.teamLog.create({
    data
  });
  return log;
}

// --- BACKLOG ---
export async function getBacklogItems() {
  return await prisma.backlogItem.findMany({
    orderBy: { createdAt: 'desc' }
  });
}

export async function createBacklogItem(data: {
  title: string,
  type: string,
  assignee: string,
  priority: string,
  status: string
}) {
  await requireAuth();
  const item = await prisma.backlogItem.create({
    data
  });
  revalidatePath('/backlog');
  return item;
}

export async function updateBacklogItemStatus(id: string, status: string) {
  await requireAuth();
  const item = await prisma.backlogItem.update({
    where: { id },
    data: { status }
  });
  revalidatePath('/backlog');
  return item;
}

// --- ROADMAP ---
export async function getGoals() {
  return await prisma.goal.findMany({
    include: { initiatives: true }
  });
}

// --- AUTOMATIONS ---
export async function getAutomations() {
  return await prisma.automation.findMany({
    orderBy: { createdAt: 'desc' }
  });
}
export async function createAutomation(data: {
  name: string,
  process: string,
  status: string,
  impact: string
}) {
  await requireAuth();
  const automation = await prisma.automation.create({
    data
  });
  return automation;
}
export async function createGoal(data: {
  objective: string,
  quarter: string,
}) {
  await requireAuth();
  const goal = await prisma.goal.create({
    data
  });
  revalidatePath('/roadmap');
  return goal;
}

export async function createInitiative(data: {
  name: string,
  status: string,
  goalId: string
}) {
  await requireAuth();
  const initiative = await prisma.initiative.create({
    data
  });
  revalidatePath('/roadmap');
  return initiative;
}

export async function getWeeklyUpdates() {
  return await prisma.weeklyUpdate.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
}

export async function createWeeklyUpdate(data: {
  week: number,
  quarter: string,
  done: string[],
  improved: string[],
  pending: string[],
  blockers: string[]
}) {
  await requireAuth();
  const update = await prisma.weeklyUpdate.create({
    data
  });
  revalidatePath('/');
  revalidatePath('/tracking');
  return update;
}

// --- SHIFTS ---
export async function getSupportAssignments(dateRange?: { start: string, end: string }) {
  if (dateRange) {
    return await prisma.supportAssignment.findMany({
      where: {
        date: { gte: dateRange.start, lte: dateRange.end }
      }
    });
  }
  return await prisma.supportAssignment.findMany();
}

export async function saveSupportAssignment(data: {
  date: string,
  hour: number,
  agentName: string
}) {
  const assignment = await prisma.supportAssignment.upsert({
    where: {
      date_hour_agentName: {
        date: data.date,
        hour: data.hour,
        agentName: data.agentName
      }
    },
    update: {},
    create: data
  });

  revalidatePath('/shifts');
  return assignment;
}

export async function deleteSupportAssignment(id: string) {
    const assignment = await prisma.supportAssignment.findUnique({ where: { id } });

    if (!assignment) {
        console.log(`Assignment ${id} not found, skipping deletion`);
        return;
    }

    if (assignment.googleEventId) {
        try {
            const eventIdToDelete = assignment.googleEventId;
            after(async () => {
                await deleteFromGoogleCalendar(eventIdToDelete);
            });

            // Limpiar el googleEventId de otras asignaciones que compartían el mismo evento (bloque merged)
            await prisma.supportAssignment.updateMany({
                where: { googleEventId: assignment.googleEventId },
                data: { googleEventId: null }
            });
        } catch (error) {
            console.error("Error deleting from Google Calendar:", error);
        }
    }

    await prisma.supportAssignment.delete({ where: { id } });
    revalidatePath('/shifts');
}

export async function deleteAssignmentsForWeek(start: string, end: string) {
  await requireAuth();

  // Recoger event IDs únicos antes de borrar
  const withEvents = await prisma.supportAssignment.findMany({
    where: { date: { gte: start, lte: end }, googleEventId: { not: null } },
    select: { googleEventId: true },
  });
  const uniqueEventIds = [...new Set(withEvents.map(a => a.googleEventId!))];

  await prisma.supportAssignment.deleteMany({
    where: { date: { gte: start, lte: end } },
  });

  // Eliminar eventos de GCal en background
  if (uniqueEventIds.length > 0) {
    after(async () => {
      for (const eventId of uniqueEventIds) {
        await deleteFromGoogleCalendar(eventId);
      }
    });
  }

  revalidatePath('/shifts');
}

// --- GOOGLE CALENDAR HELPERS ---

export async function getGoogleCalendars() {
    const auth = await getGoogleAuthClient();
    if (!auth) return [];

    const calendar = google.calendar({ version: 'v3', auth });
    try {
        const res = await calendar.calendarList.list();
        return res.data.items || [];
    } catch (error) {
        console.error("Error fetching Google Calendars:", error);
        return [];
    }
}

export async function updateCalendarSettings(data: { targetCalendarId: string }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return;

    await prisma.calendarSettings.upsert({
        where: { userId: session.user.id },
        update: { targetCalendarId: data.targetCalendarId },
        create: { 
            userId: session.user.id,
            targetCalendarId: data.targetCalendarId
        }
    });
}

export async function getCalendarSettings() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return null;

    return await prisma.calendarSettings.findUnique({
        where: { userId: session.user.id }
    });
}

export async function syncSupportAssignmentsBatch(assignmentIds: string[]) {
    const settings = await getCalendarSettings();
    const calendarId = settings?.targetCalendarId || 'primary';

    // 1. Obtener todas las asignaciones
    const assignments = await prisma.supportAssignment.findMany({
        where: { id: { in: assignmentIds } }
    });

    // 2. Agrupar por Agente y Fecha
    const groups: Record<string, any[]> = {};
    assignments.forEach(a => {
        const key = `${a.date}_${a.agentName}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(a);
    });

    // 3. Procesar cada grupo para encontrar bloques contiguos
    for (const key in groups) {
        const sorted = groups[key].sort((a, b) => a.hour - b.hour);
        const blocks: any[][] = [];
        let currentBlock: any[] = [];

        sorted.forEach((a, i) => {
            if (i === 0 || a.hour === sorted[i - 1].hour + 1) {
                currentBlock.push(a);
            } else {
                blocks.push(currentBlock);
                currentBlock = [a];
            }
        });
        if (currentBlock.length > 0) blocks.push(currentBlock);

        // 4. Sincronizar cada bloque como un único evento
        for (const block of blocks) {
            try {
                await syncSupportAssignmentBlockToGoogle(block, calendarId);
            } catch (error) {
                console.error(`Error syncing block for ${key}:`, error);
            }
        }
    }

    revalidatePath('/shifts');
}

async function getGoogleAuthClient() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return null;

    const allAccounts = await prisma.account.findMany({
        where: { userId: session.user.id }
    });
    
    console.log(`DEBUG: User ${session.user.id} has ${allAccounts.length} linked accounts:`, 
        allAccounts.map((a: any) => a.provider).join(', ') || 'NONE'
    );

    const account = allAccounts.find((a: any) => a.provider === 'google');

    if (!account) {
        console.log("DEBUG: No Google Account found for user");
        return null;
    }
    if (!account.access_token) {
        console.log("DEBUG: Google Account has no access_token");
        return null;
    }

    console.log("DEBUG: Found Google Account. Token expiry:", account.expires_at ? new Date(account.expires_at * 1000) : 'Never');

    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.NEXTAUTH_URL + "/api/auth/callback/google"
    );

    oauth2Client.setCredentials({
        access_token: account.access_token,
        refresh_token: account.refresh_token,
        expiry_date: account.expires_at ? account.expires_at * 1000 : undefined
    });

    return oauth2Client;
}

// Esta función ahora puede usarse para un solo bloque (que puede ser de 1 hora o más)
export async function syncSupportAssignmentBlockToGoogle(assignments: any[], calendarId: string = 'primary') {
    if (assignments.length === 0) return;
    
    // El bloque debe ser del mismo agente y fecha (asumido por el llamador)
    const first = assignments[0];
    const last = assignments[assignments.length - 1];

    const auth = await getGoogleAuthClient();
    if (!auth) {
        console.log("DEBUG: Auth client could not be created");
        return;
    }

    const calendar = google.calendar({ version: 'v3', auth });
    console.log(`DEBUG: Syncing ${assignments.length} hours to Calendar ID: ${calendarId}`);

    const startTime = new Date(`${first.date}T${String(first.hour).padStart(2,'0')}:00:00`);
    const endTime = new Date(`${first.date}T${String(last.hour).padStart(2,'0')}:00:00`);
    endTime.setHours(endTime.getHours() + 1); // Sumar 1 hora al final

    const event = {
        summary: `Soporte: ${first.agentName}`,
        description: 'Turno de soporte asignado desde el Dashboard',
        start: {
            dateTime: startTime.toISOString(),
            timeZone: 'America/Bogota',
        },
        end: {
            dateTime: endTime.toISOString(),
            timeZone: 'America/Bogota',
        },
    };

    // Buscar si alguno del bloque ya tiene un EventID
    const existingEventId = assignments.find(a => a.googleEventId)?.googleEventId;

    try {
        if (existingEventId) {
            console.log(`DEBUG: Updating existing event ${existingEventId}`);
            await calendar.events.update({
                calendarId: calendarId,
                eventId: existingEventId,
                requestBody: event,
            });
            
            // Asegurar que todos los items en DB tengan este ID
            await prisma.supportAssignment.updateMany({
                where: { id: { in: assignments.map(a => a.id) } },
                data: { googleEventId: existingEventId }
            });
        } else {
            console.log("DEBUG: Creating new merged event in Google Calendar");
            const res = await calendar.events.insert({
                calendarId: calendarId,
                requestBody: event,
            });

            if (res.data.id) {
                console.log(`DEBUG: Event created successfully. ID: ${res.data.id}`);
                await prisma.supportAssignment.updateMany({
                    where: { id: { in: assignments.map(a => a.id) } },
                    data: { googleEventId: res.data.id }
                });
            }
        }
    } catch (error: any) {
        console.error("DEBUG: Google Calendar API Error:", error.message || error);
    }
}

export async function syncSupportAssignmentToGoogle(assignmentId: string, calendarId: string = 'primary') {
    const assignment = await prisma.supportAssignment.findUnique({ where: { id: assignmentId } });
    if (!assignment) return;

    const auth = await getGoogleAuthClient();
    if (!auth) {
        console.log("DEBUG: Auth client could not be created");
        return;
    }

    const calendar = google.calendar({ version: 'v3', auth });
    console.log(`DEBUG: Syncing to Calendar ID: ${calendarId}`);

    const startTime = new Date(`${assignment.date}T${String(assignment.hour).padStart(2,'0')}:00:00`);
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hora después

    const event = {
        summary: `Soporte: ${assignment.agentName}`,
        description: 'Turno de soporte asignado desde el Dashboard',
        start: {
            dateTime: startTime.toISOString(),
            timeZone: 'America/Bogota', // Ajustar según zona horaria del usuario
        },
        end: {
            dateTime: endTime.toISOString(),
            timeZone: 'America/Bogota',
        },
    };

    try {
        if (assignment.googleEventId) {
            console.log(`DEBUG: Updating existing event ${assignment.googleEventId}`);
            // Actualizar existente
            await calendar.events.update({
                calendarId: calendarId,
                eventId: assignment.googleEventId,
                requestBody: event,
            });
        } else {
            console.log("DEBUG: Creating new event in Google Calendar");
            // Crear nuevo
            const res = await calendar.events.insert({
                calendarId: calendarId,
                requestBody: event,
            });

            if (res.data.id) {
                console.log(`DEBUG: Event created successfully. ID: ${res.data.id}`);
                await prisma.supportAssignment.update({
                    where: { id: assignmentId },
                    data: { googleEventId: res.data.id }
                });
            }
        }
    } catch (error: any) {
        console.error("DEBUG: Google Calendar API Error:", error.message || error);
    }
}

export async function createGoogleCalendarEvent({
    title,
    date,
    fromHour,
    toHour,
    calendarId: calendarIdOverride,
}: {
    title: string;
    date: string;       // yyyy-MM-dd
    fromHour: number;   // 0-23
    toHour: number;     // 1-24 (exclusive end)
    calendarId?: string;
}) {
    await requireAuth();
    const settings = await getCalendarSettings();
    const calendarId = calendarIdOverride ?? settings?.targetCalendarId ?? 'primary';
    const auth = await getGoogleAuthClient();
    if (!auth) throw new Error('No hay cuenta de Google vinculada');

    const calendar = google.calendar({ version: 'v3', auth });

    const endHour = toHour === 24 ? 0 : toHour;
    const endDate = toHour === 24
        ? new Date(new Date(date + 'T00:00:00').getTime() + 86400000).toISOString().slice(0, 10)
        : date;

    console.log(`[createGCal] calendarId=${calendarId} date=${date} from=${fromHour} to=${toHour} title="${title}"`);

    const res = await calendar.events.insert({
        calendarId,
        requestBody: {
            summary: title,
            start: { dateTime: `${date}T${String(fromHour).padStart(2, '0')}:00:00`, timeZone: 'America/Bogota' },
            end:   { dateTime: `${endDate}T${String(endHour).padStart(2, '0')}:00:00`, timeZone: 'America/Bogota' },
        },
    });

    console.log(`[createGCal] OK id=${res.data.id} link=${res.data.htmlLink}`);
    return { id: res.data.id, htmlLink: res.data.htmlLink, calendarId };
}

async function deleteFromGoogleCalendar(eventId: string) {
    const auth = await getGoogleAuthClient();
    if (!auth) return;

    const settings = await getCalendarSettings();
    const calendarId = settings?.targetCalendarId || 'primary';

    const calendar = google.calendar({ version: 'v3', auth });
    await calendar.events.delete({
        calendarId: calendarId,
        eventId: eventId,
    });
}

// --- SHIFT HANDOVER ---
export async function saveShiftHandover(data: {
    date: string,
    shiftType: string,
    startHour: number,
    endHour: number,
    agentName: string,
    receiverName: string,
    pendings: string,
    incidents: string,
    generalStatus: string,
    details?: string
}) {
    await requireAuth();
    const handover = await prisma.shiftHandover.create({ data });
    revalidatePath('/shifts');
    revalidatePath('/handovers');
    return handover;
}

export async function updateShiftHandover(id: string, data: {
    shiftType?: string,
    receiverName?: string,
    pendings?: string,
    incidents?: string,
    generalStatus?: string,
    details?: string
}) {
    const handover = await prisma.shiftHandover.update({ where: { id }, data });
    revalidatePath('/handovers');
    revalidatePath('/shifts');
    return handover;
}

export async function getRecentHandovers(limit: number = 10, skip: number = 0) {
    return await prisma.shiftHandover.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: skip
    });
}

export async function getUsers() {
    return await prisma.user.findMany({
        select: {
            id: true,
            name: true,
            email: true
        },
        orderBy: { name: 'asc' }
    });
}

export async function checkPendingHandover(agentName: string) {
    const today = new Date().toISOString().split('T')[0];
    const currentHour = new Date().getHours();

    // 1. Buscar si tiene turnos hoy
    const assignments = await prisma.supportAssignment.findMany({
        where: {
            date: today,
            agentName: agentName
        },
        orderBy: { hour: 'asc' }
    });

    if (assignments.length === 0) return false;

    // 2. Buscar si ya hizo entrega hoy
    const handover = await prisma.shiftHandover.findFirst({
        where: {
            date: today,
            agentName: agentName
        }
    });

    if (handover) return false;

    // 3. Si tiene turno y no ha entregado, verificar si ya es hora de entregar
    // (Consideramos pendiente si estamos en la misma hora de fin o ya pasó)
    const lastHour = assignments[assignments.length - 1].hour;
    
    // Si la hora actual es >= a la última hora del turno, debería entregar
    return currentHour >= lastHour;
}

export async function deleteShiftHandover(id: string) {
    await requireAuth();
    await prisma.shiftHandover.delete({ where: { id } });
    revalidatePath('/shifts');
}

export async function fetchIntercomHandoverData(agentName: string) {
    const { getAgentDailyMetrics, getAgentStatus, getAllOpenConversations } = await import('./intercom');
    
    // Ejecutar en paralelo para velocidad
    const [metrics, status, openTickets] = await Promise.all([
        getAgentDailyMetrics(agentName),
        getAgentStatus(agentName),
        getAllOpenConversations()
    ]);

    return { metrics, status, openTickets };
}

export async function getIntercomHeatmapData() {
    const { getIntercomHeatmap } = await import('./intercom');
    return await getIntercomHeatmap();
}

export async function getIntercomLeaderboard() {
    const { getIntercomAgents } = await import('./intercom');
    return await getIntercomAgents();
}

export async function getIntercomTrendData(days: number = 7) {
    const { getTrendMetrics } = await import('./intercom');
    return await getTrendMetrics(days);
}

export async function getIntercomMetrics(limit: number = 30, filters?: { agentId?: string; category?: string }) {
    const { getIntercomMetrics } = await import('./intercom');
    return await getIntercomMetrics(limit, filters);
}

// --- EVENTS ---

const EVENTS_CALENDAR_ID = 'mediastream.cl_lkq6aii5aai7eb6edpdj213158@group.calendar.google.com';

function buildGcalEventBody(title: string, description: string | undefined, startDate: Date, endDate: Date) {
    const tz = 'America/Bogota';
    return {
        summary: title,
        description: description || '',
        start: { dateTime: startDate.toISOString(), timeZone: tz },
        end:   { dateTime: endDate.toISOString(),   timeZone: tz },
    };
}

export async function createEvent(data: {
    title: string;
    description?: string;
    startDate: Date;
    endDate: Date;
    type: string;
    notifySlack: boolean;
    syncToGcal?: boolean;
}) {
    const session = await getServerSession(authOptions);
    let googleEventId: string | undefined;

    if (data.syncToGcal) {
        try {
            const auth = await getGoogleAuthClient();
            if (auth) {
                const cal = google.calendar({ version: 'v3', auth });
                const res = await cal.events.insert({
                    calendarId: EVENTS_CALENDAR_ID,
                    requestBody: buildGcalEventBody(data.title, data.description, data.startDate, data.endDate),
                });
                googleEventId = res.data.id ?? undefined;
            }
        } catch (e) {
            console.error('[createEvent] GCal error:', e);
        }
    }

    const event = await prisma.event.create({
        data: {
            title: data.title,
            description: data.description,
            startDate: data.startDate,
            endDate: data.endDate,
            type: data.type,
            notifySlack: data.notifySlack,
            createdBy: session?.user?.name || "Sistema",
            ...(googleEventId ? { googleEventId } : {}),
        }
    });

    if (data.notifySlack) {
        // Find agents on shift at the event's start time
        const dateStr = data.startDate.toISOString().split('T')[0];
        const startHour = data.startDate.getHours();
        const assignments = await prisma.supportAssignment.findMany({
            where: { date: dateStr, hour: startHour },
        });
        const agentNames = assignments.map((a: any) => a.agentName);

        const { sendSlackNotification } = await import('./slack');
        after(async () => { await sendSlackNotification(data, agentNames); });
    }

    revalidatePath('/');
    return event;
}

export async function updateEvent(id: string, data: {
    title: string;
    description?: string;
    startDate: Date;
    endDate: Date;
    type: string;
    notifySlack: boolean;
    syncToGcal?: boolean;
}) {
    await requireAuth();

    // Sync to Google Calendar if requested
    if (data.syncToGcal) {
        try {
            const auth = await getGoogleAuthClient();
            if (auth) {
                const cal = google.calendar({ version: 'v3', auth });
                const existing = await prisma.event.findUnique({ where: { id }, select: { googleEventId: true } });
                const body = buildGcalEventBody(data.title, data.description, data.startDate, data.endDate);

                if (existing?.googleEventId) {
                    // Update existing GCal event
                    await cal.events.patch({
                        calendarId: EVENTS_CALENDAR_ID,
                        eventId: existing.googleEventId,
                        requestBody: body,
                    });
                } else {
                    // No GCal event yet — create one and store its ID
                    const res = await cal.events.insert({
                        calendarId: EVENTS_CALENDAR_ID,
                        requestBody: body,
                    });
                    await prisma.event.update({ where: { id }, data: { googleEventId: res.data.id ?? undefined } });
                }
            }
        } catch (e) {
            console.error('[updateEvent] GCal error:', e);
        }
    }

    const event = await prisma.event.update({
        where: { id },
        data: {
            title: data.title,
            description: data.description,
            startDate: data.startDate,
            endDate: data.endDate,
            type: data.type,
            notifySlack: data.notifySlack,
        },
    });
    revalidatePath('/events');
    return event;
}

export async function getEvents(todayOnly: boolean = false) {
    if (todayOnly) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        return await prisma.event.findMany({
            where: {
                OR: [
                    { startDate: { gte: today, lt: tomorrow } }, // Empieza hoy
                    {   // En curso hoy
                        startDate: { lte: today },
                        endDate: { gte: today }
                    }
                ]
            },
            orderBy: { startDate: 'asc' }
        });
    }

    // Default: Proximos y recientes
    return await prisma.event.findMany({
        orderBy: { startDate: 'asc' }
    });
}

export async function deleteEvent(id: string) {
    await prisma.event.delete({ where: { id } });
    revalidatePath('/');
}

export async function sendEventNotification(eventId: string) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new Error("Evento no encontrado");

    // Get current time in Bogota/Local (Adjust as needed, using server time for now)
    // Assuming format YYYY-MM-DD and integer hour for SupportAssignment
    const now = new Date();
    // Offset for Colombia/Local if server is UTC. Assuming server is local or we simple take ISO date part.
    // For simplicity in this env, taking simple string split.
    const dateStr = now.toISOString().split('T')[0];
    const currentHour = now.getHours();

    const assignments = await prisma.supportAssignment.findMany({
        where: {
            date: dateStr,
            hour: currentHour
        }
    });

    const agentNames = assignments.map(a => a.agentName);

    const { sendStylePreview } = await import('./slack');
    
    const { sendSlackNotification } = await import('./slack');
    after(async () => {
        await sendSlackNotification({
            title: event.title,
            description: event.description || undefined,
            startDate: event.startDate,
            endDate: event.endDate,
            type: event.type
        }, agentNames);
    });

    return { success: true };
}

export async function previewSlackStyles() {
    await requireAuth();
    const { sendStylePreview } = await import('./slack');
    after(async () => { await sendStylePreview(); });
    return { ok: true };
}

