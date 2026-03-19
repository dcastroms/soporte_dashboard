"use client";

import { ClipboardCheck } from "lucide-react";
import { HandoverDialog } from "./HandoverDialog";

export function HandoverPageHeader() {
    return (
        <div className="flex items-start justify-between">
            <div>
                <h1 className="page-title uppercase">Entregas de Turno</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Registro de novedades entre turnos · Estado de tickets y pendientes al cambio de guardia
                </p>
            </div>
            <HandoverDialog
                assignments={[]}
                customTrigger={
                    <button className="flex items-center gap-2 bg-primary text-primary-foreground text-xs font-bold px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors shrink-0">
                        <ClipboardCheck size={14} />
                        Nueva Entrega de Turno
                    </button>
                }
            />
        </div>
    );
}
