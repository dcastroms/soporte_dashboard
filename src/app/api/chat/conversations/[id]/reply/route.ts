import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const INTERCOM_TOKEN = process.env.INTERCOM_TOKEN;
const INTERCOM_ADMIN_ID = process.env.INTERCOM_ADMIN_ID;
const INTERCOM_API_URL = "https://api.intercom.io";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!INTERCOM_TOKEN || !INTERCOM_ADMIN_ID) {
    return NextResponse.json({ error: "Intercom not configured" }, { status: 503 });
  }

  const { id } = await params;
  const { body } = await req.json();

  if (!body || typeof body !== "string" || !body.trim()) {
    return NextResponse.json({ error: "Empty message" }, { status: 400 });
  }

  const resp = await fetch(`${INTERCOM_API_URL}/conversations/${id}/reply`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${INTERCOM_TOKEN}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "Intercom-Version": "2.11",
    },
    body: JSON.stringify({
      type: "admin",
      admin_id: INTERCOM_ADMIN_ID,
      message_type: "comment",
      body: body.trim(),
    }),
  });

  if (!resp.ok) {
    const error = await resp.text();
    console.error("Intercom reply error:", error);
    return NextResponse.json({ error: "Failed to send reply" }, { status: 502 });
  }

  return NextResponse.json({ success: true });
}
