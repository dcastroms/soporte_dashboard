"use server";

import { revalidatePath } from "next/cache";
import { google } from "googleapis";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { after } from "next/server";
import {
  findTeamLogs, createTeamLog,
  findBacklogItems, createBacklogItem, updateBacklogItem,
  findGoals, createGoal, createInitiative,
  findAutomations, createAutomation,
  findWeeklyUpdates, createWeeklyUpdate,
} from "@/lib/models/TeamModel";
import {
  findAssignmentsByDateRange, findAllAssignments, findAssignmentsByIds,
  findAssignmentById, findAssignmentsByDateAndAgent, findAssignmentsByDateAndHour,
  findAssignmentsWithGoogleEventIdInRange,
  upsertAssignment, updateAssignmentById, updateAssignmentsByIds,
  updateAssignmentsByGoogleEventId,
  deleteAssignmentById, deleteAssignmentsByDateRange,
  createShiftHandover, updateShiftHandover, findShiftHandovers,
  findShiftHandoverFirst, deleteShiftHandoverById,
  createEvent, findEvents, updateEvent, findEventById, deleteEvent,
} from "@/lib/models/SupportModel";
import {
  upsertCalendarSettings, findCalendarSettingsByUserId,
  findAccountsByUserId,
} from "@/lib/models/AuthModel";
import { findAllUsers } from "@/lib/models/UserModel";

export async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized: Authentication required for this action");
  return session;
}

// --- TEAM LOGS ---
export async function getTeamLogs() {
  return await findTeamLogs();
}

export async function createTeamLogAction(data: {
  date: string;
  shift: string;
  person: string;
  event: string;
  type: string;
}) {
  await requireAuth();
  return await createTeamLog(data);
}

// --- BACKLOG ---
export async function getBacklogItems() {
  return await findBacklogItems();
}

export async function createBacklogItemAction(data: {
  title: string;
  type: string;
  assignee: string;
  priority: string;
  status: string;
}) {
  await requireAuth();
  const item = await createBacklogItem(data);
  revalidatePath("/backlog");
  return item;
}

export async function updateBacklogItemStatus(id: string, status: string) {
  await requireAuth();
  const item = await updateBacklogItem(id, { status });
  revalidatePath("/backlog");
  return item;
}

// --- ROADMAP ---
export async function getGoals() {
  return await findGoals();
}

// --- AUTOMATIONS ---
export async function getAutomations() {
  return await findAutomations();
}

export async function createAutomationAction(data: {
  name: string;
  process: string;
  status: string;
  impact: string;
}) {
  await requireAuth();
  return await createAutomation(data);
}

export async function createGoalAction(data: { objective: string; quarter: string }) {
  await requireAuth();
  const goal = await createGoal(data);
  revalidatePath("/roadmap");
  return goal;
}

export async function createInitiativeAction(data: {
  name: string;
  status: string;
  goalId: string;
}) {
  await requireAuth();
  const initiative = await createInitiative(data);
  revalidatePath("/roadmap");
  return initiative;
}

export async function getWeeklyUpdates() {
  return await findWeeklyUpdates(5);
}

export async function createWeeklyUpdateAction(data: {
  week: number;
  quarter: string;
  done: string[];
  improved: string[];
  pending: string[];
  blockers: string[];
}) {
  await requireAuth();
  const update = await createWeeklyUpdate(data);
  revalidatePath("/");
  revalidatePath("/tracking");
  return update;
}

// --- SHIFTS ---
export async function getSupportAssignments(dateRange?: { start: string; end: string }) {
  if (dateRange) return await findAssignmentsByDateRange(dateRange.start, dateRange.end);
  return await findAllAssignments();
}

export async function saveSupportAssignment(data: {
  date: string;
  hour: number;
  agentName: string;
}) {
  const assignment = await upsertAssignment(data.date, data.hour, data.agentName, data);
  revalidatePath("/shifts");
  return assignment;
}

export async function deleteSupportAssignment(id: string) {
  const assignment = await findAssignmentById(id);
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
      await updateAssignmentsByGoogleEventId(assignment.googleEventId, { googleEventId: null });
    } catch (error) {
      console.error("Error deleting from Google Calendar:", error);
    }
  }

  await deleteAssignmentById(id);
  revalidatePath("/shifts");
}

export async function deleteAssignmentsForWeek(start: string, end: string) {
  await requireAuth();
  const withEvents = await findAssignmentsWithGoogleEventIdInRange(start, end);
  const uniqueEventIds = [...new Set(withEvents.map((a) => a.googleEventId!))];

  await deleteAssignmentsByDateRange(start, end);

  if (uniqueEventIds.length > 0) {
    after(async () => {
      for (const eventId of uniqueEventIds) {
        await deleteFromGoogleCalendar(eventId);
      }
    });
  }

  revalidatePath("/shifts");
}

// --- GOOGLE CALENDAR HELPERS ---

export async function getGoogleCalendars() {
  const auth = await getGoogleAuthClient();
  if (!auth) return [];

  const calendar = google.calendar({ version: "v3", auth });
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
  await upsertCalendarSettings(session.user.id, { targetCalendarId: data.targetCalendarId });
}

export async function getCalendarSettings() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return await findCalendarSettingsByUserId(session.user.id);
}

export async function syncSupportAssignmentsBatch(assignmentIds: string[]) {
  const settings = await getCalendarSettings();
  const calendarId = settings?.targetCalendarId || "primary";

  const assignments = await findAssignmentsByIds(assignmentIds);

  const groups: Record<string, any[]> = {};
  assignments.forEach((a) => {
    const key = `${a.date}_${a.agentName}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(a);
  });

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

    for (const block of blocks) {
      try {
        await syncSupportAssignmentBlockToGoogle(block, calendarId);
      } catch (error) {
        console.error(`Error syncing block for ${key}:`, error);
      }
    }
  }

  revalidatePath("/shifts");
}

async function getGoogleAuthClient() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const allAccounts = await findAccountsByUserId(session.user.id);

  console.log(
    `DEBUG: User ${session.user.id} has ${allAccounts.length} linked accounts:`,
    allAccounts.map((a: any) => a.provider).join(", ") || "NONE"
  );

  const account = allAccounts.find((a: any) => a.provider === "google");

  if (!account) {
    console.log("DEBUG: No Google Account found for user");
    return null;
  }
  if (!account.access_token) {
    console.log("DEBUG: Google Account has no access_token");
    return null;
  }

  console.log(
    "DEBUG: Found Google Account. Token expiry:",
    account.expires_at ? new Date(account.expires_at * 1000) : "Never"
  );

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.NEXTAUTH_URL + "/api/auth/callback/google"
  );

  oauth2Client.setCredentials({
    access_token: account.access_token,
    refresh_token: account.refresh_token,
    expiry_date: account.expires_at ? account.expires_at * 1000 : undefined,
  });

  return oauth2Client;
}

export async function syncSupportAssignmentBlockToGoogle(
  assignments: any[],
  calendarId: string = "primary"
) {
  if (assignments.length === 0) return;

  const first = assignments[0];
  const last = assignments[assignments.length - 1];

  const auth = await getGoogleAuthClient();
  if (!auth) {
    console.log("DEBUG: Auth client could not be created");
    return;
  }

  const calendar = google.calendar({ version: "v3", auth });
  console.log(`DEBUG: Syncing ${assignments.length} hours to Calendar ID: ${calendarId}`);

  const startTime = new Date(`${first.date}T${String(first.hour).padStart(2, "0")}:00:00`);
  const endTime = new Date(`${first.date}T${String(last.hour).padStart(2, "0")}:00:00`);
  endTime.setHours(endTime.getHours() + 1);

  const event = {
    summary: `Soporte: ${first.agentName}`,
    description: "Turno de soporte asignado desde el Dashboard",
    start: { dateTime: startTime.toISOString(), timeZone: "America/Bogota" },
    end: { dateTime: endTime.toISOString(), timeZone: "America/Bogota" },
  };

  const existingEventId = assignments.find((a) => a.googleEventId)?.googleEventId;

  try {
    if (existingEventId) {
      console.log(`DEBUG: Updating existing event ${existingEventId}`);
      await calendar.events.update({
        calendarId,
        eventId: existingEventId,
        requestBody: event,
      });
      await updateAssignmentsByIds(
        assignments.map((a) => a.id),
        { googleEventId: existingEventId }
      );
    } else {
      console.log("DEBUG: Creating new merged event in Google Calendar");
      const res = await calendar.events.insert({ calendarId, requestBody: event });
      if (res.data.id) {
        console.log(`DEBUG: Event created successfully. ID: ${res.data.id}`);
        await updateAssignmentsByIds(
          assignments.map((a) => a.id),
          { googleEventId: res.data.id }
        );
      }
    }
  } catch (error: any) {
    console.error("DEBUG: Google Calendar API Error:", error.message || error);
  }
}

export async function syncSupportAssignmentToGoogle(
  assignmentId: string,
  calendarId: string = "primary"
) {
  const assignment = await findAssignmentById(assignmentId);
  if (!assignment) return;

  const auth = await getGoogleAuthClient();
  if (!auth) {
    console.log("DEBUG: Auth client could not be created");
    return;
  }

  const calendar = google.calendar({ version: "v3", auth });
  console.log(`DEBUG: Syncing to Calendar ID: ${calendarId}`);

  const startTime = new Date(
    `${assignment.date}T${String(assignment.hour).padStart(2, "0")}:00:00`
  );
  const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

  const event = {
    summary: `Soporte: ${assignment.agentName}`,
    description: "Turno de soporte asignado desde el Dashboard",
    start: { dateTime: startTime.toISOString(), timeZone: "America/Bogota" },
    end: { dateTime: endTime.toISOString(), timeZone: "America/Bogota" },
  };

  try {
    if (assignment.googleEventId) {
      console.log(`DEBUG: Updating existing event ${assignment.googleEventId}`);
      await calendar.events.update({
        calendarId,
        eventId: assignment.googleEventId,
        requestBody: event,
      });
    } else {
      console.log("DEBUG: Creating new event in Google Calendar");
      const res = await calendar.events.insert({ calendarId, requestBody: event });
      if (res.data.id) {
        console.log(`DEBUG: Event created successfully. ID: ${res.data.id}`);
        await updateAssignmentById(assignmentId, { googleEventId: res.data.id });
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
  date: string;
  fromHour: number;
  toHour: number;
  calendarId?: string;
}) {
  await requireAuth();
  const settings = await getCalendarSettings();
  const calendarId = calendarIdOverride ?? settings?.targetCalendarId ?? "primary";
  const auth = await getGoogleAuthClient();
  if (!auth) throw new Error("No hay cuenta de Google vinculada");

  const calendar = google.calendar({ version: "v3", auth });

  const endHour = toHour === 24 ? 0 : toHour;
  const endDate =
    toHour === 24
      ? new Date(new Date(date + "T00:00:00").getTime() + 86400000).toISOString().slice(0, 10)
      : date;

  console.log(
    `[createGCal] calendarId=${calendarId} date=${date} from=${fromHour} to=${toHour} title="${title}"`
  );

  const res = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary: title,
      start: {
        dateTime: `${date}T${String(fromHour).padStart(2, "0")}:00:00`,
        timeZone: "America/Bogota",
      },
      end: {
        dateTime: `${endDate}T${String(endHour).padStart(2, "0")}:00:00`,
        timeZone: "America/Bogota",
      },
    },
  });

  console.log(`[createGCal] OK id=${res.data.id} link=${res.data.htmlLink}`);
  return { id: res.data.id, htmlLink: res.data.htmlLink, calendarId };
}

async function deleteFromGoogleCalendar(eventId: string) {
  const auth = await getGoogleAuthClient();
  if (!auth) return;

  const settings = await getCalendarSettings();
  const calendarId = settings?.targetCalendarId || "primary";

  const calendar = google.calendar({ version: "v3", auth });
  await calendar.events.delete({ calendarId, eventId });
}

// --- SHIFT HANDOVER ---
export async function saveShiftHandover(data: {
  date: string;
  shiftType: string;
  startHour: number;
  endHour: number;
  agentName: string;
  receiverName: string;
  pendings: string;
  incidents: string;
  generalStatus: string;
  details?: string;
}) {
  await requireAuth();
  const handover = await createShiftHandover(data);
  revalidatePath("/shifts");
  revalidatePath("/handovers");
  return handover;
}

export async function updateShiftHandoverAction(
  id: string,
  data: {
    shiftType?: string;
    receiverName?: string;
    pendings?: string;
    incidents?: string;
    generalStatus?: string;
    details?: string;
  }
) {
  const handover = await updateShiftHandover(id, data);
  revalidatePath("/handovers");
  revalidatePath("/shifts");
  return handover;
}

export async function getRecentHandovers(limit: number = 10, skip: number = 0) {
  return await findShiftHandovers({ take: limit, skip });
}

export async function getUsers() {
  return await findAllUsers({ orderBy: { name: 1 } });
}

export async function checkPendingHandover(agentName: string) {
  const today = new Date().toISOString().split("T")[0];
  const currentHour = new Date().getHours();

  const assignments = await findAssignmentsByDateAndAgent(today, agentName);
  if (assignments.length === 0) return false;

  const handover = await findShiftHandoverFirst(today, agentName);
  if (handover) return false;

  const sorted = assignments.sort((a, b) => a.hour - b.hour);
  const lastHour = sorted[sorted.length - 1].hour;
  return currentHour >= lastHour;
}

export async function deleteShiftHandoverAction(id: string) {
  await requireAuth();
  await deleteShiftHandoverById(id);
  revalidatePath("/shifts");
}

export async function fetchIntercomHandoverData(agentName: string) {
  const { getAgentDailyMetrics, getAgentStatus, getAllOpenConversations } = await import(
    "./intercom"
  );
  const [metrics, status, openTickets] = await Promise.all([
    getAgentDailyMetrics(agentName),
    getAgentStatus(agentName),
    getAllOpenConversations(),
  ]);
  return { metrics, status, openTickets };
}

export async function getIntercomHeatmapData() {
  const { getIntercomHeatmap } = await import("./intercom");
  return await getIntercomHeatmap();
}

export async function getIntercomLeaderboard() {
  const { getIntercomAgents } = await import("./intercom");
  return await getIntercomAgents();
}

export async function getIntercomTrendData(days: number = 7) {
  const { getTrendMetrics } = await import("./intercom");
  return await getTrendMetrics(days);
}

export async function getIntercomMetrics(
  limit: number = 30,
  filters?: { agentId?: string; category?: string }
) {
  const { getIntercomMetrics } = await import("./intercom");
  return await getIntercomMetrics(limit, filters);
}

// --- EVENTS ---

const EVENTS_CALENDAR_ID =
  "mediastream.cl_lkq6aii5aai7eb6edpdj213158@group.calendar.google.com";

function buildGcalEventBody(
  title: string,
  description: string | undefined,
  startDate: Date,
  endDate: Date
) {
  const tz = "America/Bogota";
  return {
    summary: title,
    description: description || "",
    start: { dateTime: startDate.toISOString(), timeZone: tz },
    end: { dateTime: endDate.toISOString(), timeZone: tz },
  };
}

export async function createEventAction(data: {
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
        const cal = google.calendar({ version: "v3", auth });
        const res = await cal.events.insert({
          calendarId: EVENTS_CALENDAR_ID,
          requestBody: buildGcalEventBody(data.title, data.description, data.startDate, data.endDate),
        });
        googleEventId = res.data.id ?? undefined;
      }
    } catch (e) {
      console.error("[createEvent] GCal error:", e);
    }
  }

  const event = await createEvent({
    title: data.title,
    description: data.description,
    startDate: data.startDate.toISOString(),
    endDate: data.endDate.toISOString(),
    type: data.type,
    notifySlack: data.notifySlack,
    createdBy: session?.user?.name || "Sistema",
    ...(googleEventId ? { googleEventId } : {}),
  });

  if (data.notifySlack) {
    const dateStr = data.startDate.toISOString().split("T")[0];
    const startHour = data.startDate.getHours();
    const assignments = await findAssignmentsByDateAndHour(dateStr, startHour);
    const agentNames = assignments.map((a) => a.agentName);
    const { sendSlackNotification } = await import("./slack");
    after(async () => {
      await sendSlackNotification(data, agentNames);
    });
  }

  revalidatePath("/");
  return event;
}

export async function updateEventAction(
  id: string,
  data: {
    title: string;
    description?: string;
    startDate: Date;
    endDate: Date;
    type: string;
    notifySlack: boolean;
    syncToGcal?: boolean;
  }
) {
  await requireAuth();

  if (data.syncToGcal) {
    try {
      const auth = await getGoogleAuthClient();
      if (auth) {
        const cal = google.calendar({ version: "v3", auth });
        const existing = await findEventById(id);
        const body = buildGcalEventBody(
          data.title,
          data.description,
          data.startDate,
          data.endDate
        );

        if (existing?.googleEventId) {
          await cal.events.patch({
            calendarId: EVENTS_CALENDAR_ID,
            eventId: existing.googleEventId,
            requestBody: body,
          });
        } else {
          const res = await cal.events.insert({
            calendarId: EVENTS_CALENDAR_ID,
            requestBody: body,
          });
          await updateEvent(id, { googleEventId: res.data.id ?? undefined });
        }
      }
    } catch (e) {
      console.error("[updateEvent] GCal error:", e);
    }
  }

  const event = await updateEvent(id, {
    title: data.title,
    description: data.description,
    startDate: data.startDate.toISOString(),
    endDate: data.endDate.toISOString(),
    type: data.type,
    notifySlack: data.notifySlack,
  });
  revalidatePath("/events");
  return event;
}

export async function getEvents(todayOnly: boolean = false) {
  if (todayOnly) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return await findEvents({
      $or: [
        { startDate: { $gte: today.toISOString(), $lt: tomorrow.toISOString() } },
        { startDate: { $lte: today.toISOString() }, endDate: { $gte: today.toISOString() } },
      ],
    });
  }
  return await findEvents();
}

export async function deleteEventAction(id: string) {
  await deleteEvent(id);
  revalidatePath("/");
}

export async function sendEventNotification(eventId: string) {
  const event = await findEventById(eventId);
  if (!event) throw new Error("Evento no encontrado");

  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];
  const currentHour = now.getHours();

  const assignments = await findAssignmentsByDateAndHour(dateStr, currentHour);
  const agentNames = assignments.map((a) => a.agentName);

  const { sendSlackNotification } = await import("./slack");
  after(async () => {
    await sendSlackNotification(
      {
        title: event.title,
        description: event.description || undefined,
        startDate: new Date(event.startDate),
        endDate: new Date(event.endDate),
        type: event.type,
      },
      agentNames
    );
  });

  return { success: true };
}

export async function previewSlackStyles() {
  await requireAuth();
  const { sendStylePreview } = await import("./slack");
  after(async () => {
    await sendStylePreview();
  });
  return { ok: true };
}
