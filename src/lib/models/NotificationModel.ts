import { queryProxy } from "@/lib/mongo";

export interface NotificationDoc {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  link?: string | null;
  createdAt: string;
}

export interface ActivityLogDoc {
  id: string;
  userId?: string | null;
  userName: string;
  action: string;
  target: string;
  details: string;
  createdAt: string;
}

export async function findNotificationsByUser(userId: string): Promise<NotificationDoc[]> {
  return queryProxy({
    collection: "Notification",
    operation: "find",
    filter: { userId },
    options: { sort: { createdAt: -1 } },
  });
}

export async function createNotification(data: Omit<NotificationDoc, "id" | "createdAt">): Promise<NotificationDoc> {
  return queryProxy({
    collection: "Notification",
    operation: "insertOne",
    document: { ...data, read: data.read ?? false, createdAt: new Date().toISOString() },
  });
}

export async function markNotificationRead(id: string): Promise<NotificationDoc | null> {
  return queryProxy({
    collection: "Notification",
    operation: "updateOne",
    filter: { _id: { $oid: id } },
    update: { $set: { read: true } },
    options: { returnDocument: "after" },
  });
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await queryProxy({
    collection: "Notification",
    operation: "updateMany",
    filter: { userId, read: false },
    update: { $set: { read: true } },
  });
}

export async function findActivityLogs(): Promise<ActivityLogDoc[]> {
  return queryProxy({
    collection: "ActivityLog",
    operation: "find",
    options: { sort: { createdAt: -1 } },
  });
}

export async function createActivityLog(data: Omit<ActivityLogDoc, "id" | "createdAt">): Promise<ActivityLogDoc> {
  return queryProxy({
    collection: "ActivityLog",
    operation: "insertOne",
    document: { ...data, createdAt: new Date().toISOString() },
  });
}
