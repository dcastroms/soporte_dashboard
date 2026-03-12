import { NextResponse } from "next/server";
import { getCriticalAccounts } from "@/lib/clientIntelActions";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const accounts = await getCriticalAccounts();
        return NextResponse.json(accounts);
    } catch (error) {
        console.error("Critical accounts error:", error);
        return NextResponse.json([], { status: 500 });
    }
}
