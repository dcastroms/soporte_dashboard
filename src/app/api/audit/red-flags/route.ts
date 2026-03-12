import { NextResponse } from "next/server";
import { getRedFlagTickets } from "@/lib/auditActions";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const tickets = await getRedFlagTickets();
        return NextResponse.json(tickets);
    } catch (error) {
        console.error("Audit red-flags error:", error);
        return NextResponse.json([], { status: 500 });
    }
}
