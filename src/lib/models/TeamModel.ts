import { queryProxy } from "@/lib/mongo";

// ── TeamLog ──────────────────────────────────────────────────────────────────

export interface TeamLogDoc {
  id: string;
  date: string;
  shift: string;
  person: string;
  event: string;
  type: string;
  createdAt: string;
}

export async function findTeamLogs(): Promise<TeamLogDoc[]> {
  return queryProxy({ collection: "TeamLog", operation: "find", options: { sort: { createdAt: -1 } } });
}

export async function createTeamLog(data: Omit<TeamLogDoc, "id" | "createdAt">): Promise<TeamLogDoc> {
  return queryProxy({ collection: "TeamLog", operation: "insertOne", document: { ...data, createdAt: new Date().toISOString() } });
}

// ── BacklogItem ───────────────────────────────────────────────────────────────

export interface BacklogItemDoc {
  id: string;
  title: string;
  type: string;
  assignee: string;
  priority: string;
  status: string;
  createdAt: string;
}

export async function findBacklogItems(): Promise<BacklogItemDoc[]> {
  return queryProxy({ collection: "BacklogItem", operation: "find", options: { sort: { createdAt: -1 } } });
}

export async function createBacklogItem(data: Omit<BacklogItemDoc, "id" | "createdAt">): Promise<BacklogItemDoc> {
  return queryProxy({ collection: "BacklogItem", operation: "insertOne", document: { ...data, createdAt: new Date().toISOString() } });
}

export async function updateBacklogItem(id: string, data: Partial<BacklogItemDoc>): Promise<BacklogItemDoc | null> {
  return queryProxy({
    collection: "BacklogItem",
    operation: "updateOne",
    filter: { _id: { $oid: id } },
    update: { $set: data },
    options: { returnDocument: "after" },
  });
}

// ── Goal / Initiative ─────────────────────────────────────────────────────────

export interface GoalDoc {
  id: string;
  objective: string;
  quarter: string;
  initiatives?: InitiativeDoc[];
}

export interface InitiativeDoc {
  id: string;
  name: string;
  status: string;
  goalId: string;
}

export async function findGoals(): Promise<GoalDoc[]> {
  const goals = await queryProxy<GoalDoc[]>({ collection: "Goal", operation: "find" });
  const initiatives = await queryProxy<InitiativeDoc[]>({ collection: "Initiative", operation: "find" });
  return goals.map((g) => ({ ...g, initiatives: initiatives.filter((i) => i.goalId === g.id) }));
}

export async function createGoal(data: Omit<GoalDoc, "id" | "initiatives">): Promise<GoalDoc> {
  return queryProxy({ collection: "Goal", operation: "insertOne", document: data });
}

export async function createInitiative(data: Omit<InitiativeDoc, "id">): Promise<InitiativeDoc> {
  return queryProxy({ collection: "Initiative", operation: "insertOne", document: data });
}

// ── Automation ────────────────────────────────────────────────────────────────

export interface AutomationDoc {
  id: string;
  name: string;
  process: string;
  status: string;
  impact: string;
  createdAt: string;
}

export async function findAutomations(): Promise<AutomationDoc[]> {
  return queryProxy({ collection: "Automation", operation: "find", options: { sort: { createdAt: -1 } } });
}

export async function createAutomation(data: Omit<AutomationDoc, "id" | "createdAt">): Promise<AutomationDoc> {
  return queryProxy({ collection: "Automation", operation: "insertOne", document: { ...data, createdAt: new Date().toISOString() } });
}

// ── WeeklyUpdate ──────────────────────────────────────────────────────────────

export interface WeeklyUpdateDoc {
  id: string;
  week: number;
  quarter: string;
  done: string[];
  improved: string[];
  pending: string[];
  blockers: string[];
  createdAt: string;
}

export async function findWeeklyUpdates(take?: number): Promise<WeeklyUpdateDoc[]> {
  return queryProxy({
    collection: "WeeklyUpdate",
    operation: "find",
    options: { sort: { createdAt: -1 }, ...(take ? { limit: take } : {}) },
  });
}

export async function createWeeklyUpdate(data: Omit<WeeklyUpdateDoc, "id" | "createdAt">): Promise<WeeklyUpdateDoc> {
  return queryProxy({ collection: "WeeklyUpdate", operation: "insertOne", document: { ...data, createdAt: new Date().toISOString() } });
}
