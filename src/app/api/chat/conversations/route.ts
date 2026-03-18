import { NextResponse } from "next/server";
import { getAllOpenConversations } from "@/lib/intercom";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const conversations = await getAllOpenConversations();
  return NextResponse.json(conversations);
}
