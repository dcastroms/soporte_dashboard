/**
 * NextAuth adapter models: Account, Session, VerificationToken, CalendarSettings.
 */
import { queryProxy } from "@/lib/mongo";

export interface AccountDoc {
  id: string;
  userId: string;
  type: string;
  provider: string;
  providerAccountId: string;
  refresh_token?: string | null;
  access_token?: string | null;
  expires_at?: number | null;
  token_type?: string | null;
  scope?: string | null;
  id_token?: string | null;
  session_state?: string | null;
}

export interface SessionDoc {
  id: string;
  sessionToken: string;
  userId: string;
  expires: string;
}

export interface VerificationTokenDoc {
  id: string;
  identifier: string;
  token: string;
  expires: string;
}

export interface CalendarSettingsDoc {
  id: string;
  userId: string;
  targetCalendarId: string;
  autoSync: boolean;
}

// ── Account ─────────────────────────────────────────────────────────────────

export async function findAccountsByUserId(userId: string): Promise<AccountDoc[]> {
  return queryProxy({ collection: "Account", operation: "find", filter: { userId } });
}

export async function findAccountByProvider(provider: string, providerAccountId: string): Promise<AccountDoc | null> {
  return queryProxy({ collection: "Account", operation: "findOne", filter: { provider, providerAccountId } });
}

export async function createAccount(data: Omit<AccountDoc, "id">): Promise<AccountDoc> {
  return queryProxy({ collection: "Account", operation: "insertOne", document: data });
}

// ── Session ──────────────────────────────────────────────────────────────────

export async function findSessionByToken(sessionToken: string): Promise<SessionDoc | null> {
  return queryProxy({ collection: "Session", operation: "findOne", filter: { sessionToken } });
}

export async function createSession(data: Omit<SessionDoc, "id">): Promise<SessionDoc> {
  return queryProxy({ collection: "Session", operation: "insertOne", document: data });
}

export async function updateSession(sessionToken: string, data: Partial<SessionDoc>): Promise<SessionDoc | null> {
  return queryProxy({
    collection: "Session",
    operation: "updateOne",
    filter: { sessionToken },
    update: { $set: data },
    options: { returnDocument: "after" },
  });
}

export async function deleteSession(sessionToken: string): Promise<void> {
  await queryProxy({ collection: "Session", operation: "deleteOne", filter: { sessionToken } });
}

// ── VerificationToken ────────────────────────────────────────────────────────

export async function createVerificationToken(data: Omit<VerificationTokenDoc, "id">): Promise<VerificationTokenDoc> {
  return queryProxy({ collection: "VerificationToken", operation: "insertOne", document: data });
}

export async function findAndDeleteVerificationToken(identifier: string, token: string): Promise<VerificationTokenDoc | null> {
  const doc = await queryProxy<VerificationTokenDoc | null>({
    collection: "VerificationToken",
    operation: "findOne",
    filter: { identifier, token },
  });
  if (doc) {
    await queryProxy({ collection: "VerificationToken", operation: "deleteOne", filter: { identifier, token } });
  }
  return doc;
}

// ── CalendarSettings ──────────────────────────────────────────────────────────

export async function upsertCalendarSettings(userId: string, data: Partial<CalendarSettingsDoc>): Promise<CalendarSettingsDoc> {
  return queryProxy({
    collection: "CalendarSettings",
    operation: "replaceOne",
    filter: { userId },
    document: { userId, targetCalendarId: "primary", autoSync: false, ...data },
    options: { upsert: true, returnDocument: "after" },
  });
}

export async function findCalendarSettingsByUserId(userId: string): Promise<CalendarSettingsDoc | null> {
  return queryProxy({ collection: "CalendarSettings", operation: "findOne", filter: { userId } });
}
