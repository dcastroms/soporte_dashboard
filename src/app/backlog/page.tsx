import { mockBacklog } from "@/lib/mock-data";
import { getBacklogItems } from "@/lib/actions";
import { Zap } from "lucide-react";
import { AddBacklogDialog } from "@/components/dashboard/AddBacklogDialog";
import { BacklogTable } from "@/components/dashboard/BacklogTable";

export default async function BacklogPage() {
    const dbItems = await getBacklogItems();
    const items = dbItems.length > 0 ? dbItems : mockBacklog;

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="page-title">Backlog Operativo</h1>
                    <p className="page-subtitle">Gestión de tickets, tareas técnicas y deuda acumulada.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="btn-primary-rounded text-sm">
                        <Zap size={16} />
                        Nuevo Ticket
                    </button>
                    <AddBacklogDialog />
                </div>
            </div>

            <BacklogTable items={items as any} />
        </div>
    );
}
