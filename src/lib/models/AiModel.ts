import { queryProxy } from "@/lib/mongo";

export interface AiConfigDoc {
  id: string;
  key: string;
  value: string;
  updatedAt: string;
}

export interface AiSuggestionLogDoc {
  id: string;
  conversationId: string;
  suggestion: string;
  accepted?: boolean | null;
  agentEmail: string;
  usedKnowledge: boolean;
  createdAt: string;
}

// ── AiConfig ──────────────────────────────────────────────────────────────────

export async function findAiConfigByKey(key: string): Promise<AiConfigDoc | null> {
  return queryProxy({ collection: "AiConfig", operation: "findOne", filter: { key } });
}

export async function upsertAiConfig(key: string, value: string): Promise<AiConfigDoc> {
  return queryProxy({
    collection: "AiConfig",
    operation: "replaceOne",
    filter: { key },
    document: { key, value, updatedAt: new Date().toISOString() },
    options: { upsert: true, returnDocument: "after" },
  });
}

export async function deleteAllAiConfigs(): Promise<void> {
  await queryProxy({ collection: "AiConfig", operation: "deleteMany", filter: {} });
}

// ── AiSuggestionLog ───────────────────────────────────────────────────────────

export async function createSuggestionLog(data: Omit<AiSuggestionLogDoc, "id" | "createdAt">): Promise<AiSuggestionLogDoc> {
  return queryProxy({
    collection: "AiSuggestionLog",
    operation: "insertOne",
    document: { ...data, usedKnowledge: data.usedKnowledge ?? false, createdAt: new Date().toISOString() },
  });
}

export async function updateSuggestionFeedback(id: string, accepted: boolean): Promise<void> {
  await queryProxy({
    collection: "AiSuggestionLog",
    operation: "updateOne",
    filter: { _id: { $oid: id } },
    update: { $set: { accepted } },
  });
}

export async function countSuggestionLogs(filter?: Record<string, any>): Promise<number> {
  return queryProxy({ collection: "AiSuggestionLog", operation: "countDocuments", filter: filter ?? {} });
}
