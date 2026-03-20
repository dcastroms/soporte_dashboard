"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { X, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { format, addDays, startOfWeek, eachDayOfInterval, isSameDay, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { GoogleCalendarSettings } from './GoogleCalendarSettings';
import { HandoverDialog } from './HandoverDialog';
import { HandoverAlert } from './HandoverAlert';
import {
  saveSupportAssignment,
  deleteSupportAssignment,
  deleteAssignmentsForWeek,
  getUsers,
  getSupportAssignments,
} from '@/lib/actions';
import { toast } from 'sonner';
import { useSession } from "next-auth/react";
import { cn } from '@/lib/utils';

const OVERLOAD_HOURS = 45;

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

function getAgentColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLOR_PALETTE[Math.abs(hash) % COLOR_PALETTE.length];
}

interface Assignment {
  id: string;
  date: string;
  hour: number;
  agentName: string;
}

interface ShiftCalendarProps {
  initialAssignments: Assignment[];
}

export function ShiftCalendar({ initialAssignments }: ShiftCalendarProps) {
  const { data: session } = useSession();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [assignments, setAssignments] = useState<Assignment[]>(initialAssignments);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ date: Date; hours: number[] } | null>(null);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [customAgent, setCustomAgent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [users, setUsers] = useState<Array<{ id: string; name: string | null; email: string }>>([]);

  const [selectionStart, setSelectionStart] = useState<{ date: Date; hour: number } | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<number | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);

  const startDate = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: startDate, end: addDays(startDate, 6) });
  const hours = Array.from({ length: 24 }, (_, i) => i);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getUsers().then(u => setUsers(u as any)).catch(() => {});
  }, []);

  useEffect(() => {
    const start = format(startDate, 'yyyy-MM-dd');
    const end = format(addDays(startDate, 6), 'yyyy-MM-dd');
    getSupportAssignments({ start, end })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(data => setAssignments(data.map((a: any) => ({ id: a.id, date: a.date, hour: a.hour, agentName: a.agentName }))))
      .catch(() => toast.error("Error al cargar turnos"));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate.toISOString()]);

  const weeklySummary = useMemo(() => {
    const startStr = format(startDate, 'yyyy-MM-dd');
    const endStr = format(addDays(startDate, 6), 'yyyy-MM-dd');
    return assignments
      .filter(a => a.date >= startStr && a.date <= endStr)
      .reduce((acc, curr) => {
        acc[curr.agentName] = (acc[curr.agentName] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
  }, [assignments, startDate]);

  const weekAssignments = useMemo(() => {
    const start = format(startDate, 'yyyy-MM-dd');
    const end = format(addDays(startDate, 6), 'yyyy-MM-dd');
    return assignments.filter(a => a.date >= start && a.date <= end);
  }, [assignments, startDate]);

  const getAssignmentsForCell = (date: Date, hour: number) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return assignments.filter(a => a.date === dateStr && a.hour === hour);
  };

  const goToPrevWeek = () => setCurrentDate(d => addDays(d, -7));
  const goToNextWeek = () => setCurrentDate(d => addDays(d, 7));
  const goToToday = () => setCurrentDate(new Date());

  const handleClearWeek = async () => {
    try {
      const start = format(startDate, 'yyyy-MM-dd');
      const end = format(addDays(startDate, 6), 'yyyy-MM-dd');
      await deleteAssignmentsForWeek(start, end);
      setAssignments(prev => prev.filter(a => a.date < start || a.date > end));
      toast.success("Semana limpiada");
    } catch {
      toast.error("Error al limpiar la semana");
    }
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
      setSelectedCell({
        date: selectionStart.date,
        hours: Array.from({ length: end - start + 1 }, (_, i) => start + i),
      });
      setSelectedAgents([]);
      setCustomAgent('');
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

  const toggleAgent = (name: string) => {
    setSelectedAgents(prev =>
      prev.includes(name) ? prev.filter(a => a !== name) : [...prev, name]
    );
  };

  const handleSaveAssignment = async () => {
    if (!selectedCell) return;
    const agentsToSave = selectedAgents.length > 0
      ? selectedAgents
      : customAgent.trim() ? [customAgent.trim()] : [];
    if (agentsToSave.length === 0) return;

    setIsSaving(true);
    try {
      const dateStr = format(selectedCell.date, 'yyyy-MM-dd');
      const results = await Promise.allSettled(
        agentsToSave.flatMap(agent =>
          selectedCell.hours.map(hour =>
            saveSupportAssignment({ date: dateStr, hour, agentName: agent })
          )
        )
      );
      const succeeded = results
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
        .map(r => r.value);
      const failed = results.filter(r => r.status === 'rejected').length;

      if (succeeded.length > 0) setAssignments(prev => [...prev, ...succeeded]);
      if (failed > 0) toast.warning(`${failed} asignación(es) no se pudieron guardar`);
      else toast.success(`${succeeded.length} hora(s) asignada(s)`);

      setIsDialogOpen(false);
      setSelectedAgents([]);
      setCustomAgent('');
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

  return (
    <div className="flex flex-col gap-3 h-full">
      <HandoverAlert assignments={assignments} />

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={goToPrevWeek}>
            <ChevronLeft size={14} />
          </Button>
          <span className="text-sm font-bold min-w-[160px] text-center select-none">
            {format(startDate, 'dd MMM', { locale: es })} – {format(addDays(startDate, 6), 'dd MMM yyyy', { locale: es })}
          </span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={goToNextWeek}>
            <ChevronRight size={14} />
          </Button>
        </div>

        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={goToToday}>
          Hoy
        </Button>

        <div className="h-5 w-px bg-border mx-1" />

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-xs text-destructive hover:text-destructive gap-1.5">
              <Trash2 size={12} />
              Limpiar semana
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Limpiar todos los turnos?</AlertDialogTitle>
              <AlertDialogDescription>
                Se eliminarán todas las asignaciones de la semana del{" "}
                <strong>{format(startDate, "dd 'de' MMMM", { locale: es })}</strong> al{" "}
                <strong>{format(addDays(startDate, 6), "dd 'de' MMMM", { locale: es })}</strong>.
                Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleClearWeek} className="bg-destructive hover:bg-destructive/90">
                Sí, limpiar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="h-5 w-px bg-border mx-1" />

        {session?.user && (
          <GoogleCalendarSettings assignmentsInView={weekAssignments} />
        )}

        <HandoverDialog assignments={weekAssignments} />
      </div>

      {/* Agent bar */}
      {Object.keys(weeklySummary).length > 0 && (
        <div className="flex items-center gap-2 flex-wrap px-3 py-2 bg-muted/40 border border-border rounded-lg">
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mr-1">Semana</span>
          {Object.entries(weeklySummary)
            .sort((a, b) => b[1] - a[1])
            .map(([name, hrs]) => {
              const colorClass = AGENT_COLOR_CLASSES[getAgentColor(name)];
              const isOver = hrs > OVERLOAD_HOURS;
              return (
                <Badge
                  key={name}
                  variant="outline"
                  className={cn(
                    "text-[10px] font-semibold gap-1 py-0.5",
                    isOver
                      ? "bg-red-500/15 text-red-500 border-red-500/40"
                      : colorClass
                  )}
                >
                  {name}
                  <span className="font-bold">{hrs}h</span>
                  {isOver && <span>⚠</span>}
                </Badge>
              );
            })}
        </div>
      )}

      {/* Grid */}
      <Card className="border-border overflow-hidden flex-1 flex flex-col bg-background">
        <CardContent className="p-0 flex-1 flex flex-col">
          <ScrollArea className="h-[calc(100vh-220px)]">
            <div
              className="min-w-[700px]"
              onMouseLeave={() => { if (isSelecting) handleMouseUp(); }}
            >
              {/* Day headers */}
              <div className="grid grid-cols-[48px_repeat(7,1fr)] border-b border-border sticky top-0 bg-background z-20">
                <div className="p-2 border-r border-border bg-muted/40 flex items-center justify-center">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">H</span>
                </div>
                {weekDays.map((day: Date) => {
                  const todayCol = isToday(day);
                  return (
                    <div key={day.toString()} className={cn(
                      "p-2 text-center border-r border-border last:border-r-0",
                      todayCol && "bg-primary/5 border-b-2 border-b-primary"
                    )}>
                      <div className="text-[9px] uppercase font-semibold text-muted-foreground">
                        {format(day, 'eee', { locale: es })}
                      </div>
                      <div className={cn("text-sm font-bold mt-0.5", todayCol ? "text-primary" : "text-foreground")}>
                        {format(day, 'dd')}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Hour rows */}
              <div className="divide-y divide-border">
                {hours.map(hour => (
                  <div key={hour} className="grid grid-cols-[48px_repeat(7,1fr)] h-[40px]">
                    <div className="border-r border-border flex items-center justify-center bg-muted/10">
                      <span className="text-[9px] font-mono text-muted-foreground">{String(hour).padStart(2, '0')}h</span>
                    </div>
                    {weekDays.map((day: Date) => {
                      const cellAssignments = getAssignmentsForCell(day, hour);
                      const isSelected = isCellSelected(day, hour);
                      const todayCol = isToday(day);
                      return (
                        <div
                          key={day.toString() + hour}
                          className={cn(
                            "border-r border-border last:border-r-0 relative select-none overflow-hidden cursor-crosshair",
                            todayCol && "bg-primary/[0.02]",
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

      {/* Assignment Dialog */}
      <Dialog
        open={isDialogOpen}
        onOpenChange={open => {
          setIsDialogOpen(open);
          if (!open) { setSelectedAgents([]); setCustomAgent(''); }
        }}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Asignar agente</DialogTitle>
            <DialogDescription>
              {selectedCell && (
                <>
                  {format(selectedCell.date, "EEEE dd 'de' MMMM", { locale: es })}
                  {selectedCell.hours.length > 1
                    ? ` · ${String(selectedCell.hours[0]).padStart(2, '0')}:00 – ${String(selectedCell.hours[selectedCell.hours.length - 1] + 1).padStart(2, '00')}:00`
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
                  const isSelected = selectedAgents.includes(name);
                  const colorClass = AGENT_COLOR_CLASSES[getAgentColor(name)];
                  return (
                    <button
                      key={user.id}
                      onClick={() => toggleAgent(name)}
                      className={cn(
                        "px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors",
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary"
                          : cn("border-border hover:bg-muted", colorClass)
                      )}
                    >
                      {name}{isSelected && " ✓"}
                    </button>
                  );
                })}
              </div>
            )}
            <Input
              placeholder="Otro nombre..."
              value={customAgent}
              onChange={e => setCustomAgent(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSaveAssignment()}
              className="h-8 text-sm"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button
              size="sm"
              onClick={handleSaveAssignment}
              disabled={isSaving || (selectedAgents.length === 0 && !customAgent.trim())}
            >
              {isSaving ? "Guardando..." : "Asignar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
