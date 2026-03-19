import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [total, today, withFeedback, accepted, withKnowledge] = await Promise.all([
    prisma.aiSuggestionLog.count(),
    prisma.aiSuggestionLog.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.aiSuggestionLog.count({ where: { accepted: { not: null } } }),
    prisma.aiSuggestionLog.count({ where: { accepted: true } }),
    prisma.aiSuggestionLog.count({ where: { usedKnowledge: true } }),
  ]);

  const acceptanceRate = withFeedback > 0 ? Math.round((accepted / withFeedback) * 100) : null;
  const knowledgeRate = total > 0 ? Math.round((withKnowledge / total) * 100) : 0;

  return NextResponse.json({
    total,
    today,
    acceptanceRate,
    withFeedback,
    knowledgeRate,
  });
}
