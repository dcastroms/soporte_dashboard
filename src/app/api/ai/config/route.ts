import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SUPPORT_SYSTEM_PROMPT } from "@/lib/supportPrompt";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const stored = await prisma.aiConfig.findUnique({ where: { key: "systemPrompt" } });

  return NextResponse.json({
    systemPrompt: stored?.value ?? SUPPORT_SYSTEM_PROMPT,
    isCustom: !!stored,
    provider: process.env.AI_PROVIDER || "ollama",
    model: process.env.AI_PROVIDER === "claude"
      ? (process.env.CLAUDE_MODEL || "claude-sonnet-4-6")
      : (process.env.OLLAMA_MODEL || "llama3.2"),
  });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { systemPrompt } = await req.json();
  if (typeof systemPrompt !== "string" || !systemPrompt.trim()) {
    return NextResponse.json({ error: "systemPrompt is required" }, { status: 400 });
  }

  await prisma.aiConfig.upsert({
    where: { key: "systemPrompt" },
    update: { value: systemPrompt.trim() },
    create: { key: "systemPrompt", value: systemPrompt.trim() },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.aiConfig.deleteMany({ where: { key: "systemPrompt" } });
  return NextResponse.json({ ok: true });
}
