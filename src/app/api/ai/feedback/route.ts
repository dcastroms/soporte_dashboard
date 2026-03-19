import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { logId, accepted } = await req.json();
  if (!logId || typeof accepted !== "boolean") {
    return NextResponse.json({ error: "logId and accepted (boolean) are required" }, { status: 400 });
  }

  await prisma.aiSuggestionLog.update({
    where: { id: logId },
    data: { accepted },
  });

  return NextResponse.json({ ok: true });
}
