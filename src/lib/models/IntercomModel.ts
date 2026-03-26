import { queryProxy } from "@/lib/mongo";

// ── IntercomConversation ──────────────────────────────────────────────────────

export interface IntercomConversationDoc {
  id: string;
  intercomId: string;
  subject?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  teammateId?: string | null;
  teammateName?: string | null;
  tags: string[];
  priority?: string | null;
  firstResponseTime?: number | null;
  client?: string | null;
  ticketType?: string | null;
  module?: string | null;
}

export async function findConversations(filter?: Record<string, any>, options?: Record<string, any>): Promise<IntercomConversationDoc[]> {
  return queryProxy({ collection: "IntercomConversation", operation: "find", filter: filter ?? {}, options: options ?? {} });
}

export async function findConversationFirst(filter: Record<string, any>): Promise<IntercomConversationDoc | null> {
  return queryProxy({ collection: "IntercomConversation", operation: "findOne", filter });
}

export async function countConversations(filter?: Record<string, any>): Promise<number> {
  return queryProxy({ collection: "IntercomConversation", operation: "countDocuments", filter: filter ?? {} });
}

export async function deleteAllConversations(): Promise<void> {
  await queryProxy({ collection: "IntercomConversation", operation: "deleteMany", filter: {} });
}

export async function insertManyConversations(docs: Omit<IntercomConversationDoc, "id">[]): Promise<void> {
  if (docs.length === 0) return;
  await queryProxy({ collection: "IntercomConversation", operation: "insertMany", documents: docs });
}

// ── IntercomMetric ────────────────────────────────────────────────────────────

export interface IntercomMetricDoc {
  id: string;
  date: string;
  totalVolume: number;
  avgFirstResponseTime?: number | null;
  medianResponseTime?: number | null;
  closedCount: number;
  csatAverage?: number | null;
}

export async function findMetrics(filter?: Record<string, any>, options?: Record<string, any>): Promise<IntercomMetricDoc[]> {
  return queryProxy({ collection: "IntercomMetric", operation: "find", filter: filter ?? {}, options: options ?? {} });
}

export async function deleteAllMetrics(): Promise<void> {
  await queryProxy({ collection: "IntercomMetric", operation: "deleteMany", filter: {} });
}

export async function insertManyMetrics(docs: Omit<IntercomMetricDoc, "id">[]): Promise<void> {
  if (docs.length === 0) return;
  await queryProxy({ collection: "IntercomMetric", operation: "insertMany", documents: docs });
}

// ── IntercomCategoryMetric ────────────────────────────────────────────────────

export interface IntercomCategoryMetricDoc {
  id: string;
  date: string;
  category: string;
  value: string;
  count: number;
}

export async function findCategoryMetrics(filter?: Record<string, any>): Promise<IntercomCategoryMetricDoc[]> {
  return queryProxy({ collection: "IntercomCategoryMetric", operation: "find", filter: filter ?? {} });
}

export async function deleteAllCategoryMetrics(): Promise<void> {
  await queryProxy({ collection: "IntercomCategoryMetric", operation: "deleteMany", filter: {} });
}

export async function insertManyCategoryMetrics(docs: Omit<IntercomCategoryMetricDoc, "id">[]): Promise<void> {
  if (docs.length === 0) return;
  await queryProxy({ collection: "IntercomCategoryMetric", operation: "insertMany", documents: docs });
}

// ── IntercomHeatmap ───────────────────────────────────────────────────────────

export interface IntercomHeatmapDoc {
  id: string;
  dayOfWeek: number;
  hour: number;
  count: number;
}

export async function findHeatmap(): Promise<IntercomHeatmapDoc[]> {
  return queryProxy({ collection: "IntercomHeatmap", operation: "find" });
}

export async function deleteAllHeatmap(): Promise<void> {
  await queryProxy({ collection: "IntercomHeatmap", operation: "deleteMany", filter: {} });
}

export async function insertManyHeatmap(docs: Omit<IntercomHeatmapDoc, "id">[]): Promise<void> {
  if (docs.length === 0) return;
  await queryProxy({ collection: "IntercomHeatmap", operation: "insertMany", documents: docs });
}

// ── IntercomAgent ─────────────────────────────────────────────────────────────

export interface IntercomAgentDoc {
  id: string;
  intercomId: string;
  name: string;
  totalSolved: number;
  avgResponseTime?: number | null;
  csatScore?: number | null;
}

export async function findAgents(options?: Record<string, any>): Promise<IntercomAgentDoc[]> {
  return queryProxy({ collection: "IntercomAgent", operation: "find", options: options ?? {} });
}

export async function deleteAllAgents(): Promise<void> {
  await queryProxy({ collection: "IntercomAgent", operation: "deleteMany", filter: {} });
}

export async function insertManyAgents(docs: Omit<IntercomAgentDoc, "id">[]): Promise<void> {
  if (docs.length === 0) return;
  await queryProxy({ collection: "IntercomAgent", operation: "insertMany", documents: docs });
}

// ── IntercomSyncStatus ────────────────────────────────────────────────────────

export async function findSyncStatusFirst(filter: Record<string, any> = {}, options: Record<string, any> = {}): Promise<{ lastSync: string } | null> {
  return queryProxy({ collection: "IntercomSyncStatus", operation: "findOne", filter, options });
}

export async function createSyncStatus(): Promise<void> {
  await queryProxy({
    collection: "IntercomSyncStatus",
    operation: "insertOne",
    document: { lastSync: new Date().toISOString() },
  });
}
