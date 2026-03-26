import { queryProxy } from "@/lib/mongo";

// ── SupportAssignment ─────────────────────────────────────────────────────────

export interface SupportAssignmentDoc {
  id: string;
  date: string;
  hour: number;
  agentName: string;
  googleEventId?: string | null;
  createdAt: string;
}

export async function findAssignmentsByDateRange(from: string, to: string): Promise<SupportAssignmentDoc[]> {
  return queryProxy({
    collection: "SupportAssignment",
    operation: "find",
    filter: { date: { $gte: from, $lte: to } },
  });
}

export async function findAllAssignments(): Promise<SupportAssignmentDoc[]> {
  return queryProxy({ collection: "SupportAssignment", operation: "find" });
}

export async function findAssignmentsByIds(ids: string[]): Promise<SupportAssignmentDoc[]> {
  return queryProxy({
    collection: "SupportAssignment",
    operation: "find",
    filter: { _id: { $in: ids.map((id) => ({ $oid: id })) } },
  });
}

export async function findAssignmentById(id: string): Promise<SupportAssignmentDoc | null> {
  return queryProxy({ collection: "SupportAssignment", operation: "findOne", filter: { _id: { $oid: id } } });
}

export async function findAssignmentsByDateAndAgent(date: string, agentName: string): Promise<SupportAssignmentDoc[]> {
  return queryProxy({ collection: "SupportAssignment", operation: "find", filter: { date, agentName } });
}

export async function upsertAssignment(
  date: string,
  hour: number,
  agentName: string,
  data: Partial<SupportAssignmentDoc>
): Promise<SupportAssignmentDoc> {
  return queryProxy({
    collection: "SupportAssignment",
    operation: "replaceOne",
    filter: { date, hour, agentName },
    document: { date, hour, agentName, createdAt: new Date().toISOString(), ...data },
    options: { upsert: true, returnDocument: "after" },
  });
}

export async function updateAssignmentById(id: string, data: Partial<SupportAssignmentDoc>): Promise<SupportAssignmentDoc | null> {
  return queryProxy({
    collection: "SupportAssignment",
    operation: "updateOne",
    filter: { _id: { $oid: id } },
    update: { $set: data },
    options: { returnDocument: "after" },
  });
}

export async function updateAssignmentsByIds(ids: string[], data: Partial<SupportAssignmentDoc>): Promise<void> {
  await queryProxy({
    collection: "SupportAssignment",
    operation: "updateMany",
    filter: { _id: { $in: ids.map((id) => ({ $oid: id })) } },
    update: { $set: data },
  });
}

export async function deleteAssignmentById(id: string): Promise<void> {
  await queryProxy({ collection: "SupportAssignment", operation: "deleteOne", filter: { _id: { $oid: id } } });
}

export async function deleteAssignmentsByDateRange(from: string, to: string): Promise<void> {
  await queryProxy({
    collection: "SupportAssignment",
    operation: "deleteMany",
    filter: { date: { $gte: from, $lte: to } },
  });
}

export async function findAssignmentsByDateAndHour(date: string, hour: number): Promise<SupportAssignmentDoc[]> {
  return queryProxy({ collection: "SupportAssignment", operation: "find", filter: { date, hour } });
}

export async function findAssignmentsWithGoogleEventIdInRange(from: string, to: string): Promise<SupportAssignmentDoc[]> {
  return queryProxy({
    collection: "SupportAssignment",
    operation: "find",
    filter: { date: { $gte: from, $lte: to }, googleEventId: { $ne: null } },
    options: { projection: { googleEventId: 1 } },
  });
}

export async function updateAssignmentsByGoogleEventId(googleEventId: string, data: Partial<SupportAssignmentDoc>): Promise<void> {
  await queryProxy({
    collection: "SupportAssignment",
    operation: "updateMany",
    filter: { googleEventId },
    update: { $set: data },
  });
}

// ── ShiftHandover ─────────────────────────────────────────────────────────────

export interface ShiftHandoverDoc {
  id: string;
  date: string;
  shiftType: string;
  startHour?: number | null;
  endHour?: number | null;
  agentName: string;
  receiverName: string;
  pendings: string;
  incidents: string;
  generalStatus: string;
  details?: string | null;
  createdAt: string;
}

export async function createShiftHandover(data: Omit<ShiftHandoverDoc, "id" | "createdAt">): Promise<ShiftHandoverDoc> {
  return queryProxy({ collection: "ShiftHandover", operation: "insertOne", document: { ...data, createdAt: new Date().toISOString() } });
}

export async function updateShiftHandover(id: string, data: Partial<ShiftHandoverDoc>): Promise<ShiftHandoverDoc | null> {
  return queryProxy({
    collection: "ShiftHandover",
    operation: "updateOne",
    filter: { _id: { $oid: id } },
    update: { $set: data },
    options: { returnDocument: "after" },
  });
}

export async function findShiftHandovers(options?: { take?: number; skip?: number }): Promise<ShiftHandoverDoc[]> {
  return queryProxy({
    collection: "ShiftHandover",
    operation: "find",
    options: {
      sort: { createdAt: -1 },
      ...(options?.take ? { limit: options.take } : {}),
      ...(options?.skip ? { skip: options.skip } : {}),
    },
  });
}

export async function findShiftHandoverFirst(date: string, agentName: string): Promise<ShiftHandoverDoc | null> {
  return queryProxy({ collection: "ShiftHandover", operation: "findOne", filter: { date, agentName } });
}

// ── Event ─────────────────────────────────────────────────────────────────────

export interface EventDoc {
  id: string;
  title: string;
  description?: string | null;
  startDate: string;
  endDate: string;
  type: string;
  notifySlack: boolean;
  googleEventId?: string | null;
  createdAt: string;
  createdBy?: string | null;
}

export async function createEvent(data: Omit<EventDoc, "id" | "createdAt">): Promise<EventDoc> {
  return queryProxy({ collection: "Event", operation: "insertOne", document: { ...data, createdAt: new Date().toISOString() } });
}

export async function findEvents(filter?: Record<string, any>, options?: { sort?: Record<string, any> }): Promise<EventDoc[]> {
  return queryProxy({
    collection: "Event",
    operation: "find",
    filter: filter ?? {},
    options: { sort: options?.sort ?? { startDate: 1 } },
  });
}

export async function updateEvent(id: string, data: Partial<EventDoc>): Promise<EventDoc | null> {
  return queryProxy({
    collection: "Event",
    operation: "updateOne",
    filter: { _id: { $oid: id } },
    update: { $set: data },
    options: { returnDocument: "after" },
  });
}

export async function findEventById(id: string): Promise<EventDoc | null> {
  return queryProxy({ collection: "Event", operation: "findOne", filter: { _id: { $oid: id } } });
}

export async function deleteEvent(id: string): Promise<void> {
  await queryProxy({ collection: "Event", operation: "deleteOne", filter: { _id: { $oid: id } } });
}

// ── ShiftHandover extras ──────────────────────────────────────────────────────

export async function deleteShiftHandoverById(id: string): Promise<void> {
  await queryProxy({ collection: "ShiftHandover", operation: "deleteOne", filter: { _id: { $oid: id } } });
}
