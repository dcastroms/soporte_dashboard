"use server";

import { prisma } from "./prisma";
import { revalidatePath } from "next/cache";

export async function getNotifications(userId: string) {
    return await prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20
    });
}

export async function createNotification(data: {
    userId: string;
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    link?: string;
}) {
    const notification = await prisma.notification.create({
        data
    });
    // In a real app we might use websockets or server-sent events
    // For now we'll rely on client-side polling or manual refresh
    return notification;
}

export async function markNotificationAsRead(id: string) {
    await prisma.notification.update({
        where: { id },
        data: { read: true }
    });
}

export async function markAllAsRead(userId: string) {
    await prisma.notification.updateMany({
        where: { userId, read: false },
        data: { read: true }
    });
}

// --- ACTIVITY LOG ---

export async function getActivityLogs(limit: number = 10) {
    return await prisma.activityLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit
    });
}

export async function logActivity(data: {
    userId?: string;
    userName: string;
    action: string;
    target: string;
    details: string;
}) {
    return await prisma.activityLog.create({
        data
    });
}
