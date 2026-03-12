import { HandoverHistory } from "@/components/dashboard/HandoverHistory";
import { WikiProtocolos } from "@/components/dashboard/WikiProtocolos";

export default function HandoversPage() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Historial de Entregas</h1>
                    <p className="text-muted-foreground text-sm">Registro histórico de todas las novedades y cambios de turno.</p>
                </div>
            </div>

            {/* Split layout: History (left) + Protocol Knowledge Base (right) */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
                <HandoverHistory />
                <div className="hidden lg:block sticky top-4">
                    <WikiProtocolos />
                </div>
            </div>
        </div>
    );
}
