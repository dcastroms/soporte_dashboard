// A.1 — Test connection to the configured AI provider
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { healthCheck } from "@/lib/aiProvider";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await healthCheck();
  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}
