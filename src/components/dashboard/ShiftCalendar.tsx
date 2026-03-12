"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronLeft, ChevronRight, Upload, UserPlus, X } from "lucide-react";
import { format, addDays, startOfWeek, eachDayOfInterval, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { UploadShiftsDialog } from './UploadShiftsDialog';
import { GoogleCalendarSettings } from './GoogleCalendarSettings';
import { HandoverDialog } from './HandoverDialog';
import { HandoverAlert } from './HandoverAlert';
import { saveSupportAssignment, deleteSupportAssignment, getUsers } from '@/lib/actions';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useSession, signIn } from "next-auth/react";

const AGENT_COLORS: Record<string, string> = {
    '#3b82f6': 'bg-blue-100 text-blue-700 border-blue-200',
    '#10b981': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    '#f59e0b': 'bg-amber-100 text-amber-700 border-amber-200',
    '#8b5cf6': 'bg-violet-100 text-violet-700 border-violet-200',
    '#ef4444': 'bg-red-100 text-red-700 border-red-200',
    '#06b6d4': 'bg-cyan-100 text-cyan-700 border-cyan-200',
    '#ec4899': 'bg-pink-100 text-pink-700 border-pink-200',
    '#f97316': 'bg-orange-100 text-orange-700 border-orange-200',
};

const COLOR_PALETTE = Object.keys(AGENT_COLORS);

const DEFAULT_AGENTS = ['Gabriel', 'Edwin', 'Arturo', 'Jhoinner', 'Omar', 'Juan'];

interface Assignment {
    id: string;
    date: string;
    hour: number;
    agentName: string;
}

interface ShiftCalendarProps {
    initialAssignments: Assignment[];
    currentDate?: Date;
    onDateChange?: (date: Date) => void;
}

export function ShiftCalendar({ initialAssignments, currentDate: externalDate, onDateChange }: ShiftCalendarProps) {
    const { data: session } = useSession();
    const currentDate = externalDate || new Date();
    const [assignments, setAssignments] = useState<Assignment[]>(initialAssignments);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedCell, setSelectedCell] = useState<{ date: Date, hours: number[] } | null>(null);
    const [agentName, setAgentName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [users, setUsers] = useState<Array<{ id: string; name: string | null; email: string }>>([]);

    useEffect(() => {
        loadUsers();
    }, []);

    useEffect(() => {
        setAssignments(initialAssignments);
    }, [initialAssignments]);

    const loadUsers = async () => {
        try {
            const userList = await getUsers();
            setUsers(userList as any);
        } catch (error) {
            console.error("Error loading users:", error);
        }
    };

    // Selección por arrastre
    const [selectionStart, setSelectionStart] = useState<{ date: Date, hour: number } | null>(null);
    const [selectionEnd, setSelectionEnd] = useState<number | null>(null);
    const [isSelecting, setIsSelecting] = useState(false);

    const startDate = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekDays = eachDayOfInterval({
        start: startDate,
        end: addDays(startDate, 6)
    });

    const hours = Array.from({ length: 24 }, (_, i) => i);

    const getAssignmentsForCell = (date: Date, hour: number) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        return assignments.filter(a => a.date === dateStr && a.hour === hour);
    };

    const getAgentColor = (name: string) => {
        // Simple hash function to assign a color based on the name
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        const index = Math.abs(hash) % COLOR_PALETTE.length;
        return COLOR_PALETTE[index];
    };

    const handleMouseDown = (date: Date, hour: number) => {
        setSelectionStart({ date, hour });
        setSelectionEnd(hour);
        setIsSelecting(true);
    };

    const handleMouseEnter = (hour: number) => {
        if (isSelecting) {
            setSelectionEnd(hour);
        }
    };

    const handleMouseUp = () => {
        if (isSelecting && selectionStart && selectionEnd !== null) {
            const start = Math.min(selectionStart.hour, selectionEnd);
            const end = Math.max(selectionStart.hour, selectionEnd);
            const range = Array.from({ length: end - start + 1 }, (_, i) => start + i);

            setSelectedCell({ date: selectionStart.date, hours: range });
            setAgentName('');
            setIsDialogOpen(true);
        }
        setIsSelecting(false);
        setSelectionStart(null);
        setSelectionEnd(null);
    };

    const isCellSelected = (date: Date, hour: number) => {
        if (!isSelecting || !selectionStart || selectionEnd === null) return false;
        if (!isSameDay(date, selectionStart.date)) return false;
        const start = Math.min(selectionStart.hour, selectionEnd);
        const end = Math.max(selectionStart.hour, selectionEnd);
        return hour >= start && hour <= end;
    };

    const handleSaveAssignment = async () => {
        if (!selectedCell || !agentName.trim()) return;

        setIsSaving(true);
        try {
            const dateStr = format(selectedCell.date, 'yyyy-MM-dd');
            const newAssignments: Assignment[] = [];

            // Guardar múltiples horas
            for (const hour of selectedCell.hours) {
                const result = await saveSupportAssignment({
                    date: dateStr,
                    hour: hour,
                    agentName: agentName.trim()
                });
                newAssignments.push(result as any);
            }

            // Actualizar estado local
            setAssignments([...assignments, ...newAssignments]);
            setIsDialogOpen(false);
            toast.success(`${newAssignments.length} horas asignadas correctamente`);
        } catch (error) {
            toast.error("Error al guardar la asignación masiva");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteAssignment = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await deleteSupportAssignment(id);
            setAssignments(assignments.filter(a => a.id !== id));
            toast.success("Asignación eliminada");
        } catch (error) {
            toast.error("Error al eliminar");
        }
    };

    // Resumen semanal de horas
    const weeklySummary = assignments.reduce((acc, curr) => {
        const date = new Date(curr.date);
        if (date >= startDate && date <= addDays(startDate, 6)) {
            acc[curr.agentName] = (acc[curr.agentName] || 0) + 1;
        }
        return acc;
    }, {} as Record<string, number>);

    // Orden estable de agentes por día para alineación vertical "tipo bloque"
    const dailyAgentsMap = useMemo(() => {
        const map: Record<string, string[]> = {};
        weekDays.forEach(day => {
            const dStr = format(day, 'yyyy-MM-dd');
            const agentsInDay = assignments
                .filter(a => a.date === dStr)
                .map(a => a.agentName);
            map[dStr] = Array.from(new Set(agentsInDay)).sort();
        });
        return map;
    }, [assignments, weekDays]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 h-full">
            <Card className="shadow-lg border-border overflow-hidden flex flex-col bg-background">
                <CardContent className="p-0 flex-1 flex flex-col">
                    <ScrollArea className="flex-1">
                        <div className="min-w-[800px]">
                            {/* Header Days */}
                            <div className="grid grid-cols-[50px_repeat(7,1fr)] border-b border-border sticky top-0 bg-background z-20 shadow-sm">
                                <div className="p-1 border-r border-border bg-muted/50 uppercase text-[8px] font-black flex items-center justify-center text-slate-400">Hora</div>
                                {weekDays.map((day: Date) => (
                                    <div key={day.toString()} className={`p-1 text-center border-r border-border last:border-r-0 ${isSameDay(day, new Date()) ? 'bg-primary/5 dark:bg-primary/10' : ''}`}>
                                        <div className="text-[8px] uppercase font-black text-slate-400">
                                            {format(day, 'eee', { locale: es })}
                                        </div>
                                        <div className={`text-xs font-black ${isSameDay(day, new Date()) ? 'text-blue-600' : 'text-slate-700'}`}>
                                            {format(day, 'dd')}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Grid Body */}
                            <div className="divide-y divide-border">
                                {hours.map(hour => (
                                    <div key={hour} className="grid grid-cols-[50px_repeat(7,1fr)] group hover:bg-muted/30 transition-colors">
                                        <div className="p-1 border-r border-border bg-muted/20 flex items-center justify-center text-[9px] font-mono text-slate-400">
                                            {String(hour).padStart(2, '0')}:00
                                        </div>
                                        {weekDays.map((day: Date) => {
                                            const cellAssignments = getAssignmentsForCell(day, hour);
                                            const isSelected = isCellSelected(day, hour);
                                            const dayAgents = dailyAgentsMap[format(day, 'yyyy-MM-dd')] || [];
                                            const gridCols = Math.max(3, dayAgents.length);

                                            return (
                                                <div
                                                    key={day.toString() + hour}
                                                    className={`p-0.5 border-r border-border last:border-r-0 h-[34px] relative group/cell transition-colors cursor-crosshair select-none
                                                        ${isSelected ? 'bg-primary/20 ring-1 ring-primary/30 z-10' : 'hover:bg-primary/5 dark:hover:bg-primary/10'}
                                                    `}
                                                    onMouseDown={() => handleMouseDown(day, hour)}
                                                    onMouseEnter={() => handleMouseEnter(hour)}
                                                    onMouseUp={handleMouseUp}
                                                >
                                                    <div
                                                        className="grid gap-0.5 h-full overflow-y-auto scrollbar-hide pr-0.5 content-start"
                                                        style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}
                                                    >
                                                        {dayAgents.map((agentName: string) => {
                                                            const assignment = cellAssignments.find(a => a.agentName === agentName);
                                                            if (!assignment) return <div key={agentName} className="h-6" />;

                                                            const color = getAgentColor(assignment.agentName);
                                                            const colorStyles = AGENT_COLORS[color] || 'bg-slate-100 text-slate-700';
                                                            const firstName = assignment.agentName.split(' ')[0];

                                                            return (
                                                                <Badge
                                                                    key={assignment.id}
                                                                    variant="secondary"
                                                                    className={`text-[7px] px-0.5 py-0 h-6 border leading-tight font-black group hover:scale-105 transition-transform cursor-pointer flex items-center justify-between gap-0.5 w-full shrink-0 ${colorStyles} shadow-sm overflow-hidden`}
                                                                    onClick={(e) => handleDeleteAssignment(assignment.id, e)}
                                                                    onMouseDown={(e) => e.stopPropagation()}
                                                                >
                                                                    <span className="truncate flex-1 text-center">{firstName}</span>
                                                                    <div className="hover:bg-black/10 rounded-full p-0.5 transition-colors flex-shrink-0">
                                                                        <X size={8} className="text-current" />
                                                                    </div>
                                                                </Badge>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>

            {/* Sidebar de Resumen */}
            <Card className="h-fit">
                <CardHeader>
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <UserPlus size={16} className="text-blue-500" />
                        Horas esta Semana
                    </CardTitle>
                    <CardDescription className="text-xs">Control de carga horaria por agente</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {Object.entries(weeklySummary).length === 0 ? (
                            <p className="text-xs text-slate-400 italic text-center py-4">Sin horas asignadas esta semana</p>
                        ) : (
                            Object.entries(weeklySummary)
                                .sort((a, b) => b[1] - a[1])
                                .map(([name, hours]) => {
                                    const color = getAgentColor(name);
                                    const colorStyles = AGENT_COLORS[color] || 'bg-slate-100 text-slate-700';
                                    const isOverLimit = hours > 45; // Alerta si pasa de 45 horas

                                    return (
                                        <div key={name} className="flex items-center justify-between p-2 rounded-lg border border-border bg-muted/30">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div className={`w-2 h-2 rounded-full ${colorStyles.split(' ')[0]}`} />
                                                <span className="text-xs font-semibold truncate">{name}</span>
                                            </div>
                                            <Badge variant={isOverLimit ? "destructive" : "outline"} className="text-[10px] font-bold">
                                                {hours}h
                                            </Badge>
                                        </div>
                                    );
                                })
                        )}

                        <div className="pt-4 border-t space-y-3">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase">Integraciones</h4>
                            {session?.user ? (
                                <GoogleCalendarSettings assignmentsInView={assignments.filter(a => {
                                    const date = new Date(a.date);
                                    return date >= startDate && date <= addDays(startDate, 6);
                                })} />
                            ) : (
                                <p className="text-[10px] text-slate-400 italic">Inicia sesión para sincronizar calendarios</p>
                            )}
                        </div>

                        <div className="pt-4 border-t space-y-3">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase">Entrega de Turno</h4>
                            <HandoverAlert assignments={assignments} />
                            <HandoverDialog assignments={assignments} />
                        </div>

                        <div className="pt-4 border-t">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2">Ayuda</h4>
                            <ul className="text-[10px] text-slate-500 space-y-1">
                                <li>• Arrastra para asignar bloques</li>
                                <li>• Clic en nombre para borrar</li>
                                <li>• Max recomendado: 45h/semana</li>
                            </ul>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Dialogo de Asignación Manual */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Asignar Agente</DialogTitle>
                        <DialogDescription>
                            {selectedCell && (
                                <>
                                    Asignar soporte para el {format(selectedCell.date, 'dd/MM/yyyy')}
                                    {selectedCell.hours.length > 1
                                        ? ` (${selectedCell.hours[0]}:00 a ${selectedCell.hours[selectedCell.hours.length - 1]}:00)`
                                        : ` a las ${String(selectedCell.hours[0]).padStart(2, '0')}:00`
                                    }
                                </>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="flex flex-wrap gap-2">
                            {users.map(user => (
                                <Button
                                    key={user.id}
                                    variant={agentName === (user.name || user.email) ? "default" : "outline"}
                                    size="sm"
                                    className="text-xs h-7 px-2"
                                    onClick={() => setAgentName(user.name || user.email)}
                                >
                                    {user.name || user.email}
                                </Button>
                            ))}
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="h-px bg-slate-100 flex-1" />
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">O escribir otro</span>
                            <div className="h-px bg-slate-100 flex-1" />
                        </div>

                        <Input
                            placeholder="Nombre del agente..."
                            value={agentName}
                            onChange={(e) => setAgentName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveAssignment()}
                            className="h-9 text-sm"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSaveAssignment} disabled={isSaving || !agentName.trim()}>
                            {isSaving ? "Guardando..." : "Confirmar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
