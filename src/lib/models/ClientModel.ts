import { queryProxy } from "@/lib/mongo";

export interface ClientNoteDoc {
  id: string;
  clientId: string;
  content: string;
  authorId?: string | null;
  authorName: string;
  createdAt: string;
}

export interface ClientActionLogDoc {
  id: string;
  clientId: string;
  action: string;
  details: string;
  authorName: string;
  timestamp: string;
}

export async function findClientNotes(clientId: string): Promise<ClientNoteDoc[]> {
  return queryProxy({
    collection: "ClientNote",
    operation: "find",
    filter: { clientId },
    options: { sort: { createdAt: -1 } },
  });
}

export async function createClientNote(data: Omit<ClientNoteDoc, "id" | "createdAt">): Promise<ClientNoteDoc> {
  return queryProxy({
    collection: "ClientNote",
    operation: "insertOne",
    document: { ...data, createdAt: new Date().toISOString() },
  });
}

export async function findClientActionLogs(clientId: string): Promise<ClientActionLogDoc[]> {
  return queryProxy({
    collection: "ClientActionLog",
    operation: "find",
    filter: { clientId },
    options: { sort: { timestamp: -1 } },
  });
}

export async function createClientActionLog(data: Omit<ClientActionLogDoc, "id" | "timestamp">): Promise<ClientActionLogDoc> {
  return queryProxy({
    collection: "ClientActionLog",
    operation: "insertOne",
    document: { ...data, timestamp: new Date().toISOString() },
  });
}
