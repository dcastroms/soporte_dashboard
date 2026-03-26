import { queryProxy } from "@/lib/mongo";

export interface UserDoc {
  id: string;
  email: string;
  password?: string | null;
  name?: string | null;
  emailVerified?: string | null;
  image?: string | null;
  role: string;
  permissions: string[];
  createdAt: string;
}

export async function findUserById(id: string): Promise<UserDoc | null> {
  return queryProxy({ collection: "User", operation: "findOne", filter: { _id: { $oid: id } } });
}

export async function findUserByEmail(email: string): Promise<UserDoc | null> {
  return queryProxy({ collection: "User", operation: "findOne", filter: { email } });
}

export async function findAllUsers(options?: { orderBy?: Record<string, any> }): Promise<UserDoc[]> {
  return queryProxy({
    collection: "User",
    operation: "find",
    options: { sort: options?.orderBy ?? { createdAt: 1 } },
  });
}

export async function createUser(data: Omit<UserDoc, "id" | "createdAt"> & { id?: string }): Promise<UserDoc> {
  return queryProxy({
    collection: "User",
    operation: "insertOne",
    document: { ...data, role: data.role ?? "USER", permissions: data.permissions ?? [], createdAt: new Date().toISOString() },
  });
}

export async function updateUser(id: string, data: Partial<UserDoc>): Promise<UserDoc | null> {
  return queryProxy({
    collection: "User",
    operation: "updateOne",
    filter: { _id: { $oid: id } },
    update: { $set: data },
    options: { returnDocument: "after" },
  });
}
