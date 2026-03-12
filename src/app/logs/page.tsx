import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Search } from "lucide-react";
import { getTeamLogs } from "@/lib/actions";
import { mockLogs } from "@/lib/mock-data";

import { AddLogDialog } from "@/components/dashboard/AddLogDialog";

export default async function LogsPage() {
    const dbLogs = await getTeamLogs();
    const logs = dbLogs.length > 0 ? dbLogs : mockLogs;

    const getShiftColor = (shift: string) => {
        switch (shift) {
            case 'Mañana': return 'bg-amber-100 text-amber-700';
            case 'Tarde': return 'bg-orange-100 text-orange-700';
            case 'Noche': return 'bg-indigo-100 text-indigo-700';
            default: return 'bg-slate-100 text-slate-700';
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Bitácora del Equipo</h1>
                    <p className="text-slate-500">Registro de actividad en tiempo real para operaciones de soporte 24/7.</p>
                </div>
                <AddLogDialog />
            </div>

            <div className="bg-white rounded-xl border shadow-sm">
                <div className="p-4 border-b flex items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Filtrar registros..."
                            className="w-full pl-10 pr-4 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-slate-50/50"
                        />
                    </div>
                    <div className="flex gap-2">
                        <Badge variant="secondary">Todos los turnos</Badge>
                        <Badge variant="outline" className="cursor-pointer hover:bg-slate-50">Hoy</Badge>
                        <Badge variant="outline" className="cursor-pointer hover:bg-slate-50">Ayer</Badge>
                    </div>
                </div>

                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50/50">
                            <TableHead className="w-[120px]">Fecha</TableHead>
                            <TableHead>Turno</TableHead>
                            <TableHead>Persona</TableHead>
                            <TableHead className="w-[400px]">Evento/Nota</TableHead>
                            <TableHead>Tipo</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {logs.map((log: any) => (
                            <TableRow key={log.id} className="group transition-colors">
                                <TableCell className="text-slate-500 font-mono text-xs">
                                    {log.date || (log.createdAt ? new Date(log.createdAt).toLocaleDateString() : 'N/A')}
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline" className={getShiftColor(log.shift)}>
                                        {log.shift}
                                    </Badge>
                                </TableCell>
                                <TableCell className="font-medium">{log.person}</TableCell>
                                <TableCell className="text-sm leading-relaxed">{log.event}</TableCell>
                                <TableCell>
                                    <Badge variant="secondary" className="font-normal text-xs">{log.type}</Badge>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
