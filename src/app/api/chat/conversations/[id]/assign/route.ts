import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const INTERCOM_TOKEN = process.env.INTERCOM_TOKEN;
const INTERCOM_API_URL = "https://api.intercom.io";
const HEADERS = {
  Authorization: `Bearer ${INTERCOM_TOKEN}`,
  "Content-Type": "application/json",
  Accept: "application/json",
  "Intercom-Version": "2.11",
};

async function getAdminIdByEmail(email: string): Promise<string | null> {
  const resp = await fetch(`${INTERCOM_API_URL}/admins`, { headers: HEADERS });
  if (!resp.ok) return null;
  const data = await resp.json();
  const admin = (data.admins ?? []).find(
    (a: { email: string; id: string }) => a.email === email
  );
  return admin?.id ?? null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!INTERCOM_TOKEN)
    return NextResponse.json({ error: "Intercom not configured" }, { status: 503 });

  const { id } = await params;
  const adminId = await getAdminIdByEmail(session.user.email);
  if (!adminId)
    return NextResponse.json(
      { error: `No Intercom admin found for ${session.user.email}` },
      { status: 403 }
    );

  const resp = await fetch(`${INTERCOM_API_URL}/conversations/${id}/parts`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({
      message_type: "assignment",
      type: "admin",
      admin_id: adminId,
      assignee_id: adminId,
    }),
  });

  if (!resp.ok) {
    const error = await resp.text();
    console.error("Intercom assign error:", error);
    return NextResponse.json({ error: "Failed to assign conversation" }, { status: 502 });
  }

  return NextResponse.json({ success: true });
}
