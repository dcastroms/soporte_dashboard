import { queryProxy } from "@/lib/mongo";

export interface KnowledgeDocDoc {
  id: string;
  title: string;
  content: string;
  uploadedBy: string;
  docType: string;
  imageUrl?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  category?: string | null;
  createdAt: string;
  chunks?: KnowledgeChunkDoc[];
}

export interface KnowledgeChunkDoc {
  id: string;
  docId: string;
  text: string;
  embedding: number[];
  chunkIndex: number;
}

export async function findKnowledgeDocs(): Promise<KnowledgeDocDoc[]> {
  return queryProxy({ collection: "KnowledgeDoc", operation: "find", options: { sort: { createdAt: -1 } } });
}

export async function findKnowledgeDocFirst(filter: Record<string, any>): Promise<KnowledgeDocDoc | null> {
  return queryProxy({ collection: "KnowledgeDoc", operation: "findOne", filter });
}

export async function createKnowledgeDoc(
  data: Omit<KnowledgeDocDoc, "id" | "createdAt" | "chunks">,
  chunks: Omit<KnowledgeChunkDoc, "id" | "docId">[]
): Promise<KnowledgeDocDoc> {
  const doc = await queryProxy<KnowledgeDocDoc>({
    collection: "KnowledgeDoc",
    operation: "insertOne",
    document: { ...data, docType: data.docType ?? "text", createdAt: new Date().toISOString() },
  });
  if (chunks.length > 0) {
    await queryProxy({
      collection: "KnowledgeChunk",
      operation: "insertMany",
      documents: chunks.map((c, i) => ({ ...c, docId: doc.id, chunkIndex: c.chunkIndex ?? i })),
    });
  }
  return doc;
}

export async function deleteKnowledgeDoc(id: string): Promise<void> {
  await queryProxy({ collection: "KnowledgeChunk", operation: "deleteMany", filter: { docId: id } });
  await queryProxy({ collection: "KnowledgeDoc", operation: "deleteOne", filter: { _id: { $oid: id } } });
}

export async function findAllChunks(): Promise<KnowledgeChunkDoc[]> {
  return queryProxy({ collection: "KnowledgeChunk", operation: "find" });
}

export async function findChunksByDocIds(docIds: string[]): Promise<KnowledgeChunkDoc[]> {
  return queryProxy({ collection: "KnowledgeChunk", operation: "find", filter: { docId: { $in: docIds } } });
}
