// In-memory presence tracker — who is viewing which conversation
// Entries expire after TTL_MS of inactivity

const TTL_MS = 45_000;

interface PresenceEntry {
  convId: string;
  name: string;
  email: string;
  updatedAt: number;
}

const store = new Map<string, PresenceEntry>();

function purgeStale() {
  const now = Date.now();
  for (const [email, entry] of store.entries()) {
    if (now - entry.updatedAt > TTL_MS) store.delete(email);
  }
}

export function registerPresence(email: string, name: string, convId: string) {
  purgeStale();
  store.set(email, { convId, name, email, updatedAt: Date.now() });
}

export function clearPresence(email: string) {
  store.delete(email);
}

export function getViewersForConversation(convId: string): { name: string; email: string }[] {
  purgeStale();
  const viewers: { name: string; email: string }[] = [];
  for (const entry of store.values()) {
    if (entry.convId === convId) viewers.push({ name: entry.name, email: entry.email });
  }
  return viewers;
}
