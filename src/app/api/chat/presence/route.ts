import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { registerPresence, clearPresence, getViewersForConversation } from "@/lib/presenceRegistry";

// POST /api/chat/presence — register user as viewing a conversation
// Body: { convId: string } or { convId: null } to clear
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { convId } = await req.json();
  const email = session.user.email;
  const name = session.user.name || email;

  if (!convId) {
    clearPresence(email);
  } else {
    registerPresence(email, name, convId);
  }

  return NextResponse.json({ ok: true });
}

// GET /api/chat/presence?convId=X — who is viewing this conversation
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const convId = req.nextUrl.searchParams.get("convId");
  if (!convId) return NextResponse.json({ viewers: [] });

  const viewers = getViewersForConversation(convId).filter(
    (v) => v.email !== session.user!.email
  );

  return NextResponse.json({ viewers });
}
