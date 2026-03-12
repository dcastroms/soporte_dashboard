import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { mockAutomations } from "@/lib/mock-data";
import { Zap, Target, Lightbulb, PlayCircle } from "lucide-react";
import { getAutomations } from "@/lib/actions";
import { AddAutomationDialog } from "@/components/dashboard/AddAutomationDialog";

export default async function AutomationsPage() {
    const dbAutomations = await getAutomations();
    const automations = dbAutomations.length > 0 ? dbAutomations : mockAutomations;

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'Activa': return <PlayCircle className="h-5 w-5 text-emerald-500" />;
            case 'En Progreso': return <Zap className="h-5 w-5 text-blue-500" />;
            case 'Idea': return <Lightbulb className="h-5 w-5 text-amber-500" />;
            default: return <Lightbulb className="h-5 w-5 text-amber-500" />;
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Inventario de Automatizaciones</h1>
                    <p className="text-slate-500">Seguimiento de herramientas internas y automatizaciones diseñadas para escalar operaciones.</p>
                </div>
                <AddAutomationDialog />
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {automations.map((automation: any) => (
                    <Card key={automation.id} className="relative overflow-hidden group hover:shadow-md transition-shadow">
                        <div className="absolute top-0 right-0 p-4">
                            {getStatusIcon(automation.status)}
                        </div>
                        <CardHeader>
                            <Badge variant="secondary" className="w-fit mb-2">{automation.process}</Badge>
                            <CardTitle>{automation.name}</CardTitle>
                            <CardDescription>Estado: {automation.status}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border">
                                <Target className="h-4 w-4 text-slate-400 mt-1 flex-shrink-0" />
                                <div>
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-tighter">Impacto</p>
                                    <p className="text-sm font-medium text-slate-700">{automation.impact}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
