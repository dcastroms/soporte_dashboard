"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function getClientNotes(clientId: string) {
  try {
    return await prisma.clientNote.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    console.error("Error fetching client notes:", error);
    return [];
  }
}

export async function addClientNote(clientId: string, content: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) throw new Error("Unauthorized");

    const note = await prisma.clientNote.create({
      data: {
        clientId,
        content,
        authorId: (session.user as any).id,
        authorName: session.user.name || "System User",
      },
    });

    // Also log this as an action
    await logClientAction(clientId, "Nota Añadida", `Nueva nota: ${content.substring(0, 50)}...`);
    
    revalidatePath(`/clients/${clientId}`);
    return note;
  } catch (error) {
    console.error("Error adding client note:", error);
    throw error;
  }
}

export async function getClientActions(clientId: string) {
  try {
    return await prisma.clientActionLog.findMany({
      where: { clientId },
      orderBy: { timestamp: "desc" },
      take: 10,
    });
  } catch (error) {
    console.error("Error fetching client actions:", error);
    return [];
  }
}

export async function logClientAction(clientId: string, action: string, details: string) {
  try {
    const session = await getServerSession(authOptions);
    
    return await prisma.clientActionLog.create({
      data: {
        clientId,
        action,
        details,
        authorName: session?.user?.name || "System",
      },
    });
  } catch (error) {
    console.error("Error logging client action:", error);
  }
}
