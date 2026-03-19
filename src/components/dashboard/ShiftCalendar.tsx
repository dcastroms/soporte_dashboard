"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, UserPlus } from "lucide-react";
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
import { useSession } from "next-auth/react";
import { cn } from '@/lib/utils';

// Colores adaptados a dark/light mode usando variables CSS
const AGENT_COLOR_CLASSES: Record<string, string> = {
    '#3b82f6': 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30',
    '#10b981': 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    '#f59e0b': 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30',
    '#8b5cf6': 'bg-violet-500/20 text-violet-600 dark:text-violet-400 border-violet-500/30',
    '#ef4444': 'bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30',
    '#06b6d4': 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border-cyan-500/30',
    '#ec4899': 'bg-pink-500/20 text-pink-600 dark:text-pink-400 border-pink-500/30',
    '#f97316': 'bg-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-500/30',
};

const COLOR_PALETTE = Object.keys(AGENT_COLOR_CLASSES);

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

function getAgentColor(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return COLOR_PALETTE[Math.abs(hash) % COLOR_PALETTE.length];
}

export function ShiftCalendar({ initialAssignments, currentDate: externalDate }: ShiftCalendarProps) {
    const { data: session } = useSession();
    const currentDate = externalDate || new Date();
    const [assignments, setAssignments] = useState<Assignment[]>(initialAssignments);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedCell, setSelectedCell] = useState<{ date: Date; hours: number[] } | null>(null);
    const [agentName, setAgentName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [users, setUsers] = useState<Array<{ id: string; name: string | null; email: string }>>([]);
    const [selectionStart, setSelectionStart] = useState<{ date: Date; hour: number } | null>(null);
    const [selectionEnd, setSelectionEnd] = useState<number | null>(null);
    const [isSelecting, setIsSelecting] = useState(false);

    useEffect(() => { loadUsers(); }, []);
    useEffect(() => { setAssignments(initialAssignments); }, [initialAssignments]);

    const loadUsers = async () => {
        try {
            const userList = await getUsers();
            setUsers(userList as any);
        } catch { /* non-fatal */ }
    };

    const startDate = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekDays = eachDayOfInterval({ start: startDate, end: addDays(startDate, 6) });
    const hours = Array.from({ length: 24 }, (_, i) => i);

    const getAssignmentsForCell = (date: Date, hour: number) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        return assignments.filter(a => a.date === dateStr && a.hour === hour);
    };

    const handleMouseDown = (date: Date, hour: number) => {
        setSelectionStart({ date, hour });
        setSelectionEnd(hour);
        setIsSelecting(true);
    };

    const handleMouseEnter = (hour: number) => {
        if (isSelecting) setSelectionEnd(hour);
    };

    const handleMouseUp = () => {
        if (isSelecting && selectionStart && selectionEnd !== null) {
            const start = Math.min(selectionStart.hour, selectionEnd);
            const end = Math.max(selectionStart.hour, selectionEnd);
            setSelectedCell({ date: selectionStart.date, hours: Array.from({ length: end - start + 1 }, (_, i) => start + i) });
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
            for (const hour of selectedCell.hours) {
                const result = await saveSupportAssignment({ date: dateStr, hour, agentName: agentName.trim() });
                newAssignments.push(result as any);
            }
            setAssignments(prev => [...prev, ...newAssignments]);
            setIsDialogOpen(false);
            toast.success(`${newAssignments.length} hora${newAssignments.length > 1 ? 's' : ''} asignada${newAssignments.length > 1 ? 's' : ''}`);
        } catch {
            toast.error("Error al guardar la asignación");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteAssignment = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await deleteSupportAssignment(id);
            setAssignments(prev => prev.filter(a => a.id !== id));
            toast.success("Asignación eliminada");
        } catch {
            toast.error("Error al eliminar");
        }
    };

    const weeklySummary = useMemo(() => {
        return assignments.reduce((acc, curr) => {
            const date = new Date(curr.date);
            if (date >= startDate && date <= addDays(startDate, 6)) {
                acc[curr.agentName] = (acc[curr.agentName] || 0) + 1;
            }
            return acc;
        }, {} as Record<string, number>);
    }, [assignments, startDate]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-4 h-full">
            {/* Main Grid */}
            <Card className="border-border overflow-hidden flex flex-col bg-background">
                <CardContent className="p-0 flex-1 flex flex-col">
                    <ScrollArea className="h-[calc(100vh-200px)]">
                        <div className="min-w-[700px]">
                            {/* Day headers */}
                            <div className="grid grid-cols-[52px_repeat(7,1fr)] border-b border-border sticky top-0 bg-background z-20">
                                <div className="p-2 border-r border-border bg-muted/40 flex items-center justify-center">
                                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">H</span>
                                </div>
                                {weekDays.map((day: Date) => {
                                    const isToday = isSameDay(day, new Date());
                                    return (
                                        <div key={day.toString()} className={cn(
                                            "p-2 text-center border-r border-border last:border-r-0",
                                            isToday && "bg-primary/5"
                                        )}>
                                            <div className="text-[9px] uppercase font-semibold text-muted-foreground">
                                                {format(day, 'eee', { locale: es })}
                                            </div>
                                            <div className={cn(
                                                "text-sm font-bold mt-0.5",
                                                isToday ? "text-primary" : "text-foreground"
                                            )}>
                                                {format(day, 'dd')}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Hour rows */}
                            <div className="divide-y divide-border">
                                {hours.map(hour => (
                                    <div key={hour} className="grid grid-cols-[52px_repeat(7,1fr)] h-[40px]">
                                            {/* Hour label */}
                                            <div className="border-r border-border flex items-center justify-center bg-muted/10">
                                                <span className="text-[9px] font-mono text-muted-foreground">
                                                    {String(hour).padStart(2, '0')}h
                                                </span>
                                            </div>

                                            {/* Day cells */}
                                            {weekDays.map((day: Date) => {
                                                const cellAssignments = getAssignmentsForCell(day, hour);
                                                const isSelected = isCellSelected(day, hour);

                                                return (
                                                    <div
                                                        key={day.toString() + hour}
                                                        className={cn(
                                                            "border-r border-border last:border-r-0 relative select-none overflow-hidden cursor-crosshair",
                                                            isSelected && "bg-primary/20 ring-inset ring-1 ring-primary/40",
                                                            !isSelected && "hover:bg-primary/5"
                                                        )}
                                                        onMouseDown={() => handleMouseDown(day, hour)}
                                                        onMouseEnter={() => handleMouseEnter(hour)}
                                                        onMouseUp={handleMouseUp}
                                                    >
                                                        {cellAssignments.length > 0 && (
                                                            <div className="flex gap-px p-px h-full items-center flex-wrap">
                                                                {cellAssignments.map(assignment => {
                                                                    const colorClass = AGENT_COLOR_CLASSES[getAgentColor(assignment.agentName)] || AGENT_COLOR_CLASSES[COLOR_PALETTE[0]];
                                                                    const firstName = assignment.agentName.split(' ')[0];
                                                                    return (
                                                                        <div
                                                                            key={assignment.id}
                                                                            className={cn(
                                                                                "flex items-center gap-0.5 px-1 rounded text-[9px] font-semibold border h-5 max-w-full",
                                                                                colorClass
                                                                            )}
                                                                            onMouseDown={e => e.stopPropagation()}
                                                                        >
                                                                            <span className="truncate">{firstName}</span>
                                                                            <button
                                                                                className="opacity-50 hover:opacity-100 transition-opacity flex-shrink-0"
                                                                                onClick={e => handleDeleteAssignment(assignment.id, e)}
                                                                            >
                                                                                <X size={8} />
                                                                            </button>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
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

            {/* Sidebar */}
            <div className="flex flex-col gap-4">
                {/* Weekly summary */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <UserPlus size={14} className="text-primary" />
                            Carga Semanal
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-2">
                        {Object.entries(weeklySummary).length === 0 ? (
                            <p className="text-xs text-muted-foreground italic text-center py-2">Sin asignaciones esta semana</p>
                        ) : (
                            Object.entries(weeklySummary)
                                .sort((a, b) => b[1] - a[1])
                                .map(([name, hrs]) => {
                                    const colorClass = AGENT_COLOR_CLASSES[getAgentColor(name)];
                                    const isOver = hrs > 45;
                                    return (
                                        <div key={name} className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div className={cn("w-2 h-2 rounded-full border", colorClass)} />
                                                <span className="text-xs font-medium truncate">{name}</span>
                                            </div>
                                            <Badge
                                                variant={isOver ? "destructive" : "outline"}
                                                className="text-[10px] font-bold shrink-0"
                                            >
                                                {hrs}h
                                            </Badge>
                                        </div>
                                    );
                                })
                        )}
                    </CardContent>
                </Card>

                {/* Handover */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Entrega de Turno</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-2">
                        <HandoverAlert assignments={assignments} />
                        <HandoverDialog assignments={assignments} />
                    </CardContent>
                </Card>

                {/* Google Calendar */}
                {session?.user && (
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm">Google Calendar</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                            <GoogleCalendarSettings assignmentsInView={assignments.filter(a => {
                                const date = new Date(a.date);
                                return date >= startDate && date <= addDays(startDate, 6);
                            })} />
                        </CardContent>
                    </Card>
                )}

                {/* Upload */}
                <UploadShiftsDialog />
            </div>

            {/* Assignment Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[380px]">
                    <DialogHeader>
                        <DialogTitle>Asignar Agente</DialogTitle>
                        <DialogDescription>
                            {selectedCell && (
                                <>
                                    {format(selectedCell.date, "EEEE dd 'de' MMMM", { locale: es })}
                                    {selectedCell.hours.length > 1
                                        ? ` · ${selectedCell.hours[0]}:00 – ${selectedCell.hours[selectedCell.hours.length - 1] + 1}:00`
                                        : ` · ${String(selectedCell.hours[0]).padStart(2, '0')}:00`}
                                </>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-3 space-y-3">
                        {users.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                                {users.map(user => {
                                    const name = user.name || user.email;
                                    const selected = agentName === name;
                                    return (
                                        <button
                                            key={user.id}
                                            onClick={() => setAgentName(name)}
                                            className={cn(
                                                "px-2.5 py-1 rounded-md text-xs font-medium border transition-colors",
                                                selected
                                                    ? "bg-primary text-primary-foreground border-primary"
                                                    : "bg-muted/50 border-border hover:bg-muted text-foreground"
                                            )}
                                        >
                                            {name}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                        <div className="relative">
                            <Input
                                placeholder="Otro nombre..."
                                value={agentName}
                                onChange={e => setAgentName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSaveAssignment()}
                                className="h-8 text-sm"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                        <Button size="sm" onClick={handleSaveAssignment} disabled={isSaving || !agentName.trim()}>
                            {isSaving ? "Guardando..." : "Asignar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
