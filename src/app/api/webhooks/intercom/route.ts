import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sseSubscribers, broadcast } from "@/lib/sseRegistry";
import crypto from "crypto";

// Intercom signs every webhook payload with HMAC-SHA256 using your client secret
const INTERCOM_SECRET = process.env.INTERCOM_CLIENT_SECRET || "";
const INTERCOM_APP_ID = process.env.INTERCOM_APP_ID || "here";

function verifySignature(body: string, signature: string | null): boolean {
  if (!INTERCOM_SECRET || !signature) return true; // Skip verification in dev if secret not set
  const digest = crypto
    .createHmac("sha256", INTERCOM_SECRET)
    .update(body)
    .digest("hex");
  return `sha256=${digest}` === signature;
}


export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const topic = payload.topic as string;       // e.g. "conversation.user.created"
  const data = payload.data?.item;             // Intercom conversation object

  console.log(`[Webhook] Received: ${topic}`);

  // Note: Add a WebhookEvent model to prisma/schema.prisma for persistent audit logging.
  // For now, events are only processed in-memory and broadcast via SSE.

  // === Handle specific events ===

  if (topic === "conversation.user.created") {
    const subject = data?.source?.subject || "Nuevo ticket sin asunto";
    const assignee = data?.admin_assignee_id ? "Asignado" : "Sin asignar";
    const conversationId = data?.id;

    broadcast("new_ticket", {
      id: conversationId,
      subject,
      assignee,
      url: `https://app.intercom.com/a/inbox/${INTERCOM_APP_ID}/inbox/shared/all/conversation/${conversationId}`,
      timestamp: new Date().toISOString(),
    });
  }

  if (topic === "conversation.admin.replied") {
    const conversationId = data?.id;
    const adminName = data?.admin_assignee_id ? "Agente" : "Desconocido";
    broadcast("ticket_updated", {
      id: conversationId,
      adminName,
      timestamp: new Date().toISOString(),
    });
  }

  if (topic === "conversation.priority.updated") {
    const conversationId = data?.id;
    const priority = data?.priority;
    const subject = data?.source?.subject || "Ticket";
    if (priority === "priority") {
      broadcast("vip_ticket", {
        id: conversationId,
        subject,
        url: `https://app.intercom.com/a/inbox/${INTERCOM_APP_ID}/inbox/shared/all/conversation/${conversationId}`,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Always respond 200 immediately so Intercom doesn't retry
  return NextResponse.json({ received: true });
}
