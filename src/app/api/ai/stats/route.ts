import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { countSuggestionLogs } from "@/lib/models/AiModel";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [total, today, withFeedback, accepted, withKnowledge] = await Promise.all([
    countSuggestionLogs(),
    countSuggestionLogs({ createdAt: { $gte: todayStart.toISOString() } }),
    countSuggestionLogs({ accepted: { $ne: null } }),
    countSuggestionLogs({ accepted: true }),
    countSuggestionLogs({ usedKnowledge: true }),
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
