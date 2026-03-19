import { HandoverHistory } from "@/components/dashboard/HandoverHistory";
import { WikiProtocolos } from "@/components/dashboard/WikiProtocolos";
import { HandoverPageHeader } from "@/components/dashboard/HandoverPageHeader";

export const metadata = { title: "Entregas de Turno — Soporte 360" };

export default function HandoversPage() {
    return (
        <div className="space-y-6">
            <HandoverPageHeader />

            {/* Split layout: History (left) + Protocol sidebar (right) */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
                <HandoverHistory />
                <div className="hidden lg:block sticky top-4">
                    <WikiProtocolos />
                </div>
            </div>
        </div>
    );
}
