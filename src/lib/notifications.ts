"use server";

import {
  findNotificationsByUser, createNotification as createNotificationDoc,
  markNotificationRead, markAllNotificationsRead,
  findActivityLogs, createActivityLog,
} from "@/lib/models/NotificationModel";
import { revalidatePath } from "next/cache";

export async function getNotifications(userId: string) {
  return await findNotificationsByUser(userId);
}

export async function createNotification(data: {
  userId: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  link?: string;
}) {
  return await createNotificationDoc({ ...data, read: false });
}

export async function markNotificationAsRead(id: string) {
  await markNotificationRead(id);
}

export async function markAllAsRead(userId: string) {
  await markAllNotificationsRead(userId);
}

// --- ACTIVITY LOG ---

export async function getActivityLogs(limit: number = 10) {
  const logs = await findActivityLogs();
  return logs.slice(0, limit);
}

export async function logActivity(data: {
  userId?: string;
  userName: string;
  action: string;
  target: string;
  details: string;
}) {
  return await createActivityLog(data);
}
