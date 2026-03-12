import { HeartPulse } from "lucide-react";
import { CustomerSupportBreakdown } from "@/components/dashboard/CustomerSupportBreakdown";
import { CriticalAccountAlerts } from "@/components/dashboard/CriticalAccountAlerts";
import {
    getClientBreakdown,
    getCriticalAccounts,
    getWeeklyEfficiency,
} from "@/lib/clientIntelActions";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
    const [clients, criticalAccounts, weeklyEfficiency] = await Promise.all([
        getClientBreakdown().catch(() => []),
        getCriticalAccounts().catch(() => []),
        getWeeklyEfficiency().catch(() => ({ received: 0, solved: 0, efficiency: 0 })),
    ]);

    return (
        <div className="space-y-6">
            {/* Page header */}
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#9E77E5] to-[#67AA09] flex items-center justify-center">
                    <HeartPulse size={18} className="text-white" strokeWidth={2.5} />
                </div>
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-foreground">CS Intelligence</h1>
                    <p className="text-[11px] text-muted-foreground">
                        Tickets por cliente · Cuentas en riesgo · Seguimiento de proyectos
                    </p>
                </div>
            </div>

            {/* Full-width client table */}
            <CustomerSupportBreakdown
                clients={clients as any}
                received={weeklyEfficiency.received}
                solved={weeklyEfficiency.solved}
                efficiency={weeklyEfficiency.efficiency}
            />

            {/* Critical accounts + project notes */}
            <CriticalAccountAlerts accounts={criticalAccounts as any} />
        </div>
    );
}
