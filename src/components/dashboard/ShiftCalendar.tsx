"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet, SheetContent, SheetTrigger,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { X, ChevronLeft, ChevronRight, SlidersHorizontal, Trash2, CalendarRange, ClipboardList, Calendar, Camera } from "lucide-react";
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

const OVERLOAD_HOURS = 40;

const AGENT_COLORS = [
  'bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30',
  'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30',
  'bg-violet-500/20 text-violet-600 dark:text-violet-400 border-violet-500/30',
  'bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/30',
  'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border-cyan-500/30',
  'bg-pink-500/20 text-pink-600 dark:text-pink-400 border-pink-500/30',
  'bg-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-500/30',
  'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
  'bg-teal-500/20 text-teal-600 dark:text-teal-400 border-teal-500/30',
  'bg-lime-500/20 text-lime-600 dark:text-lime-400 border-lime-500/30',
  'bg-fuchsia-500/20 text-fuchsia-600 dark:text-fuchsia-400 border-fuchsia-500/30',
  'bg-sky-500/20 text-sky-600 dark:text-sky-400 border-sky-500/30',
  'bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30',
  'bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30',
  'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30',
];

// Colores sólidos para canvas (mismo índice que AGENT_COLORS)
const CANVAS_COLORS = [
  { bg: '#bfdbfe', text: '#1d4ed8', border: '#3b82f6' },
  { bg: '#a7f3d0', text: '#065f46', border: '#10b981' },
  { bg: '#fde68a', text: '#78350f', border: '#f59e0b' },
  { bg: '#ddd6fe', text: '#5b21b6', border: '#8b5cf6' },
  { bg: '#fecdd3', text: '#9f1239', border: '#f43f5e' },
  { bg: '#a5f3fc', text: '#0e7490', border: '#06b6d4' },
  { bg: '#fbcfe8', text: '#9d174d', border: '#ec4899' },
  { bg: '#fed7aa', text: '#9a3412', border: '#f97316' },
  { bg: '#c7d2fe', text: '#3730a3', border: '#6366f1' },
  { bg: '#99f6e4', text: '#134e4a', border: '#14b8a6' },
  { bg: '#d9f99d', text: '#3f6212', border: '#84cc16' },
  { bg: '#f5d0fe', text: '#701a75', border: '#d946ef' },
  { bg: '#bae6fd', text: '#0c4a6e', border: '#0ea5e9' },
  { bg: '#bbf7d0', text: '#14532d', border: '#22c55e' },
  { bg: '#e9d5ff', text: '#581c87', border: '#a855f7' },
  { bg: '#fef08a', text: '#713f12', border: '#eab308' },
];

function agentColorIndex(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % AGENT_COLORS.length;
}

function getAgentColor(name: string): string {
  return AGENT_COLORS[agentColorIndex(name)];
}

interface Assignment {
  id: string;
  date: string;
  hour: number;
  agentName: string;
}

interface LayoutBlock {
  agentName: string;
  startHour: number;
  endHour: number;
  durationHours: number;
  assignmentIds: string[];
  lane: number;
  totalLanes: number;
}

function buildBlocks(dayAssignments: Assignment[]): Omit<LayoutBlock, 'lane' | 'totalLanes'>[] {
  const byAgent: Record<string, { hours: number[]; ids: Record<number, string> }> = {};
  dayAssignments.forEach(a => {
    if (!byAgent[a.agentName]) byAgent[a.agentName] = { hours: [], ids: {} };
    byAgent[a.agentName].hours.push(a.hour);
    byAgent[a.agentName].ids[a.hour] = a.id;
  });

  const blocks: Omit<LayoutBlock, 'lane' | 'totalLanes'>[] = [];
  Object.entries(byAgent).forEach(([agentName, { hours, ids }]) => {
    const sorted = [...new Set(hours)].sort((a, b) => a - b);
    let i = 0;
    while (i < sorted.length) {
      let j = i;
      while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
      const startHour = sorted[i];
      const endHour = sorted[j] + 1;
      blocks.push({
        agentName, startHour, endHour,
        durationHours: endHour - startHour,
        assignmentIds: sorted.slice(i, j + 1).map(h => ids[h]),
      });
      i = j + 1;
    }
  });
  return blocks;
}

function computeLayout(dayAssignments: Assignment[]): LayoutBlock[] {
  const raw = buildBlocks(dayAssignments);
  if (raw.length === 0) return [];
  const sorted = [...raw].sort((a, b) => a.startHour - b.startHour);
  const lanes: number[] = [];
  const laned = sorted.map(block => {
    let lane = lanes.findIndex(e => e <= block.startHour);
    if (lane === -1) { lane = lanes.length; lanes.push(0); }
    lanes[lane] = block.endHour;
    return { ...block, lane, totalLanes: 0 };
  });
  return laned.map(block => {
    const concurrent = laned.filter(b => b.startHour < block.endHour && b.endHour > block.startHour);
    return { ...block, totalLanes: Math.max(...concurrent.map(b => b.lane)) + 1 };
  });
}

interface ShiftCalendarProps {
  initialAssignments: Assignment[];
}

export function ShiftCalendar({ initialAssignments }: ShiftCalendarProps) {
  const { data: session } = useSession();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [assignments, setAssignments] = useState<Assignment[]>(initialAssignments);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ date: Date } | null>(null);
  const [dialogFromHour, setDialogFromHour] = useState(0);
  const [dialogToHour, setDialogToHour] = useState(1);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [customAgent, setCustomAgent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);

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

  const weekAssignments = useMemo(() => {
    const start = format(startDate, 'yyyy-MM-dd');
    const end = format(addDays(startDate, 6), 'yyyy-MM-dd');
    return assignments.filter(a => a.date >= start && a.date <= end);
  }, [assignments, startDate]);

  const agentStats = useMemo(() => {
    const isNocturnal = (hour: number) => hour >= 21 || hour <= 5;
    const result: Record<string, { total: number; extra: number; noctWeekday: number; noctSunday: number }> = {};
    weekAssignments.forEach(a => {
      if (!result[a.agentName]) result[a.agentName] = { total: 0, extra: 0, noctWeekday: 0, noctSunday: 0 };
      result[a.agentName].total++;
      const day = new Date(a.date + 'T12:00:00').getDay();
      if (isNocturnal(a.hour)) {
        if (day === 0) result[a.agentName].noctSunday++;
        else result[a.agentName].noctWeekday++;
      }
    });
    Object.values(result).forEach(s => { s.extra = Math.max(0, s.total - OVERLOAD_HOURS); });
    return result;
  }, [weekAssignments]);

  const dayLayoutBlocks = useMemo(() => {
    const result: Record<string, LayoutBlock[]> = {};
    weekDays.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      result[dateStr] = computeLayout(assignments.filter(a => a.date === dateStr));
    });
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignments, startDate]);

  const handleDeleteBlock = async (ids: string[], e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await Promise.all(ids.map(id => deleteSupportAssignment(id)));
      setAssignments(prev => prev.filter(a => !ids.includes(a.id)));
      toast.success(`${ids.length} hora(s) eliminada(s)`);
    } catch {
      toast.error("Error al eliminar");
    }
  };

  const handleScreenshot = () => {
    try {
      const HOUR_W = 52;
      const DAY_W = 150;
      const HOUR_H = 38;
      const HEADER_H = 46;
      const TITLE_H = 38;
      const DAYS = 7;
      const HOURS = 24;
      const W = HOUR_W + DAYS * DAY_W;
      const H = TITLE_H + HEADER_H + HOURS * HOUR_H;
      const SCALE = 2;

      const canvas = document.createElement('canvas');
      canvas.width = W * SCALE;
      canvas.height = H * SCALE;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(SCALE, SCALE);

      const font = (size: number, bold = false) =>
        `${bold ? 'bold ' : ''}${size}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;

      // ── Fondo blanco total ──────────────────────────────────────────────
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);

      // ── Barra de título ─────────────────────────────────────────────────
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, W, TITLE_H);
      ctx.fillStyle = '#ffffff';
      ctx.font = font(12, true);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('GESTIÓN DE TURNOS', 14, TITLE_H / 2);
      ctx.fillStyle = '#7bd21e';
      ctx.font = font(11);
      ctx.textAlign = 'right';
      const weekLabel = `${format(startDate, "dd 'de' MMMM", { locale: es })} – ${format(addDays(startDate, 6), "dd 'de' MMMM yyyy", { locale: es })}`;
      ctx.fillText(weekLabel, W - 14, TITLE_H / 2);

      // ── Header de días ──────────────────────────────────────────────────
      const headerY = TITLE_H;
      ctx.fillStyle = '#f3f4f6';
      ctx.fillRect(0, headerY, W, HEADER_H);

      weekDays.forEach((day, i) => {
        const x = HOUR_W + i * DAY_W;
        const today = isToday(day);
        if (today) {
          ctx.fillStyle = '#f0fdf4';
          ctx.fillRect(x, headerY, DAY_W, HEADER_H);
        }
        ctx.fillStyle = today ? '#16a34a' : '#6b7280';
        ctx.font = font(9);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(format(day, 'eee', { locale: es }).toUpperCase(), x + DAY_W / 2, headerY + 14);
        ctx.fillStyle = today ? '#16a34a' : '#111827';
        ctx.font = font(15, true);
        ctx.fillText(format(day, 'dd'), x + DAY_W / 2, headerY + 32);
        if (today) {
          ctx.strokeStyle = '#86efac';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x + 1, headerY + HEADER_H - 1);
          ctx.lineTo(x + DAY_W - 1, headerY + HEADER_H - 1);
          ctx.stroke();
        }
      });

      // ── Línea inferior del header ────────────────────────────────────────
      ctx.strokeStyle = '#d1d5db';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, headerY + HEADER_H);
      ctx.lineTo(W, headerY + HEADER_H);
      ctx.stroke();

      // ── Filas de horas ───────────────────────────────────────────────────
      const bodyY = TITLE_H + HEADER_H;
      const periodBg = ['#eef2ff', '#f9fafb', '#fefce8', '#fff7ed']; // noche/mañana/tarde/noche2

      hours.forEach(hour => {
        const y = bodyY + hour * HOUR_H;
        const period = Math.floor(hour / 6);
        ctx.fillStyle = periodBg[period];
        ctx.fillRect(0, y, W, HOUR_H);

        // Línea de fila
        const isMajor = hour % 6 === 0 && hour > 0;
        ctx.strokeStyle = isMajor ? '#9ca3af' : '#e5e7eb';
        ctx.lineWidth = isMajor ? 1.5 : 0.5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();

        // Etiqueta de hora
        ctx.fillStyle = '#9ca3af';
        ctx.font = font(10);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${String(hour).padStart(2, '0')}:00`, HOUR_W / 2, y + HOUR_H / 2);
      });

      // Línea final
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, bodyY + HOURS * HOUR_H);
      ctx.lineTo(W, bodyY + HOURS * HOUR_H);
      ctx.stroke();

      // ── Separadores de columnas ──────────────────────────────────────────
      weekDays.forEach((day, i) => {
        const x = HOUR_W + i * DAY_W;
        const today = isToday(day);
        if (today) {
          ctx.fillStyle = 'rgba(134,239,172,0.07)';
          ctx.fillRect(x, bodyY, DAY_W, HOURS * HOUR_H);
        }
        ctx.strokeStyle = today ? '#86efac' : '#d1d5db';
        ctx.lineWidth = today ? 1.5 : 1;
        ctx.beginPath();
        ctx.moveTo(x, headerY);
        ctx.lineTo(x, bodyY + HOURS * HOUR_H);
        ctx.stroke();
      });

      // Columna de horas — separador derecho
      ctx.strokeStyle = '#d1d5db';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(HOUR_W, headerY);
      ctx.lineTo(HOUR_W, bodyY + HOURS * HOUR_H);
      ctx.stroke();

      // ── Bloques de agentes ───────────────────────────────────────────────
      weekDays.forEach((day, i) => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const blocks = dayLayoutBlocks[dateStr] || [];
        const colX = HOUR_W + i * DAY_W;

        blocks.forEach(block => {
          const color = CANVAS_COLORS[agentColorIndex(block.agentName)];
          const bx = colX + (block.lane / block.totalLanes) * DAY_W + 3;
          const bw = (DAY_W / block.totalLanes) - 6;
          const by = bodyY + block.startHour * HOUR_H + 2;
          const bh = block.durationHours * HOUR_H - 4;

          ctx.fillStyle = color.bg;
          ctx.strokeStyle = color.border;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          (ctx as CanvasRenderingContext2D & { roundRect: (x: number, y: number, w: number, h: number, r: number) => void })
            .roundRect(bx, by, bw, bh, 4);
          ctx.fill();
          ctx.stroke();

          ctx.save();
          ctx.rect(bx + 2, by, bw - 4, bh);
          ctx.clip();
          ctx.fillStyle = color.text;
          ctx.font = font(11, true);
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText(block.agentName.split(' ')[0], bx + 5, by + 5);
          if (bh >= 30) {
            ctx.font = font(9);
            ctx.fillText(
              `${String(block.startHour).padStart(2, '0')}:00 – ${String(block.endHour).padStart(2, '0')}:00`,
              bx + 5, by + 19,
            );
          }
          ctx.restore();
        });
      });

      // ── Borde exterior ───────────────────────────────────────────────────
      ctx.strokeStyle = '#9ca3af';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

      canvas.toBlob(blob => {
        if (!blob) { toast.error('Error al generar la imagen'); return; }
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `turnos-${format(startDate, 'yyyy-MM-dd')}.png`;
        link.click();
        URL.revokeObjectURL(link.href);
        toast.success('Imagen descargada');
      }, 'image/png');
    } catch {
      toast.error('Error al generar la imagen');
    }
  };

  const handleClearWeek = async () => {
    try {
      const start = format(startDate, 'yyyy-MM-dd');
      const end = format(addDays(startDate, 6), 'yyyy-MM-dd');
      await deleteAssignmentsForWeek(start, end);
      setAssignments(prev => prev.filter(a => a.date < start || a.date > end));
      toast.success("Semana limpiada");
      setClearOpen(false);
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
      const s = Math.min(selectionStart.hour, selectionEnd);
      const e = Math.max(selectionStart.hour, selectionEnd);
      setSelectedCell({ date: selectionStart.date });
      setDialogFromHour(s);
      setDialogToHour(e + 1);
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
    const s = Math.min(selectionStart.hour, selectionEnd);
    const e = Math.max(selectionStart.hour, selectionEnd);
    return hour >= s && hour <= e;
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
    const rangeHours = Array.from({ length: dialogToHour - dialogFromHour }, (_, i) => dialogFromHour + i);
    if (rangeHours.length === 0) return;

    setIsSaving(true);
    try {
      const dateStr = format(selectedCell.date, 'yyyy-MM-dd');
      const results = await Promise.allSettled(
        agentsToSave.flatMap(agent =>
          rangeHours.map(hour =>
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

  return (
    <div className="flex flex-col h-full gap-2">
      <HandoverAlert assignments={assignments} />

      {/* Barra de control — fuera del grid, pequeña y limpia */}
      <div className="flex items-center justify-between flex-shrink-0">
        {/* Navegación de semana */}
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setCurrentDate(d => addDays(d, -7))}>
            <ChevronLeft size={13} />
          </Button>
          <span className="text-sm font-bold px-1 select-none tabular-nums">
            {format(startDate, 'dd MMM', { locale: es })} – {format(addDays(startDate, 6), 'dd MMM yyyy', { locale: es })}
          </span>
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setCurrentDate(d => addDays(d, 7))}>
            <ChevronRight size={13} />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => setCurrentDate(new Date())}>
            Hoy
          </Button>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost" size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={handleScreenshot}
            title="Descargar imagen de la semana"
          >
            <Camera size={14} />
          </Button>

        {/* Ícono de opciones — separado visualmente del grid */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
              <SlidersHorizontal size={14} />
            </Button>
          </SheetTrigger>

          <SheetContent side="right" className="w-[260px] p-0 flex flex-col">
            {/* Header del panel — igual estilo al sidebar */}
            <div className="px-4 py-5 border-b border-sidebar-border">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 bg-primary/15 rounded-lg flex items-center justify-center shrink-0 border border-primary/25">
                  <CalendarRange size={13} className="text-primary" />
                </div>
                <div>
                  <p className="text-[11px] font-black text-foreground/80 leading-none tracking-wide">TURNOS</p>
                  <p className="text-[9px] font-bold text-primary uppercase tracking-[0.18em] mt-0.5">
                    {format(startDate, 'dd MMM', { locale: es })} – {format(addDays(startDate, 6), 'dd MMM', { locale: es })}
                  </p>
                </div>
              </div>
            </div>

            <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-4">

              {/* Sección: Carga semanal por agente */}
              {Object.keys(agentStats).length > 0 && (
                <div>
                  <p className="px-2 mb-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-foreground/35 select-none">
                    Carga Semanal
                  </p>
                  <div className="space-y-1 px-2">
                    {Object.entries(agentStats)
                      .sort((a, b) => b[1].total - a[1].total)
                      .map(([name, stats]) => {
                        const colorClass = getAgentColor(name);
                        const isOver = stats.extra > 0;
                        return (
                          <div key={name} className={cn("rounded-lg border p-2", colorClass)}>
                            {/* Nombre + total */}
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[12px] font-bold truncate">{name}</span>
                              <span className={cn(
                                "text-[11px] font-black tabular-nums",
                                isOver ? "text-red-500" : ""
                              )}>
                                {stats.total}h{isOver ? ` ⚠` : ""}
                              </span>
                            </div>
                            {/* Desglose */}
                            <div className="space-y-0.5">
                              {isOver && (
                                <div className="flex justify-between text-[10px]">
                                  <span className="opacity-70">Extra</span>
                                  <span className="font-bold text-orange-500 tabular-nums">+{stats.extra}h</span>
                                </div>
                              )}
                              {stats.noctWeekday > 0 && (
                                <div className="flex justify-between text-[10px]">
                                  <span className="opacity-70">Noct. Lun–Sáb</span>
                                  <span className="font-semibold tabular-nums opacity-80">{stats.noctWeekday}h</span>
                                </div>
                              )}
                              {stats.noctSunday > 0 && (
                                <div className="flex justify-between text-[10px]">
                                  <span className="opacity-70">Noct. Dom</span>
                                  <span className="font-semibold tabular-nums opacity-80">{stats.noctSunday}h</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Sección: Operaciones */}
              <div>
                <p className="px-2 mb-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-foreground/35 select-none">
                  Operaciones
                </p>
                <ul className="space-y-0.5">
                  <li>
                    <HandoverDialog
                      assignments={weekAssignments}
                      customTrigger={
                        <button className="flex items-center gap-2.5 pl-3.5 pr-2 py-2 rounded-lg w-full text-left transition-all duration-150 text-[12px] font-medium text-foreground/60 hover:bg-accent/60 hover:text-foreground group">
                          <ClipboardList size={15} className="shrink-0 text-foreground/40 group-hover:text-foreground/80 transition-colors" />
                          <span>Entrega de Turno</span>
                        </button>
                      }
                    />
                  </li>
                  {session?.user && (
                    <li>
                      <GoogleCalendarSettings
                        assignmentsInView={weekAssignments}
                        trigger={
                          <button className="flex items-center gap-2.5 pl-3.5 pr-2 py-2 rounded-lg w-full text-left transition-all duration-150 text-[12px] font-medium text-foreground/60 hover:bg-accent/60 hover:text-foreground group">
                            <Calendar size={15} className="shrink-0 text-foreground/40 group-hover:text-foreground/80 transition-colors" />
                            <span>Google Calendar</span>
                          </button>
                        }
                      />
                    </li>
                  )}
                </ul>
              </div>

              {/* Sección: Acciones */}
              <div>
                <p className="px-2 mb-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-foreground/35 select-none">
                  Acciones
                </p>
                <ul className="space-y-0.5">
                  <li>
                    <button
                      onClick={() => setClearOpen(true)}
                      className="flex items-center gap-2.5 pl-3.5 pr-2 py-2 rounded-lg w-full text-left transition-all duration-150 text-[12px] font-medium text-destructive/70 hover:bg-destructive/10 hover:text-destructive group"
                    >
                      <Trash2 size={15} className="shrink-0" />
                      <span>Limpiar semana</span>
                    </button>
                  </li>
                </ul>
              </div>

            </nav>
          </SheetContent>
        </Sheet>
        </div>
      </div>

      {/* Grid — ocupa toda la altura restante */}
      <div className="flex-1 border border-border rounded-lg overflow-hidden bg-background min-h-0">
        <ScrollArea className="h-full">
          <div
            className="min-w-[700px]"
            onMouseLeave={() => { if (isSelecting) handleMouseUp(); }}
          >
            {/* Header días */}
            <div className="flex border-b border-border sticky top-0 bg-background z-20">
              <div className="w-12 flex-shrink-0 border-r border-border bg-muted/40 flex items-center justify-center py-2">
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">H</span>
              </div>
              {weekDays.map((day: Date) => {
                const todayCol = isToday(day);
                return (
                  <div key={day.toString()} className={cn(
                    "flex-1 py-2 text-center border-r border-border last:border-r-0",
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

            {/* Cuerpo: hora labels + columnas de días */}
            <div className="flex">
              {/* Columna de horas */}
              <div className="w-12 flex-shrink-0 border-r border-border">
                {hours.map(hour => (
                  <div key={hour} className="h-[40px] border-b border-border last:border-b-0 bg-muted/10 flex items-center justify-center">
                    <span className="text-[9px] font-mono text-muted-foreground">{String(hour).padStart(2, '0')}h</span>
                  </div>
                ))}
              </div>

              {/* Columnas de días — posicionamiento absoluto para bloques */}
              {weekDays.map((day: Date) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const todayCol = isToday(day);
                const blocks = dayLayoutBlocks[dateStr] || [];
                return (
                  <div
                    key={dateStr}
                    className={cn(
                      "flex-1 relative border-r border-border last:border-r-0",
                      todayCol && "bg-primary/[0.02]"
                    )}
                    style={{ height: hours.length * 40 }}
                  >
                    {/* Celdas invisibles para eventos de ratón */}
                    {hours.map(hour => {
                      const isSelected = isCellSelected(day, hour);
                      return (
                        <div
                          key={hour}
                          className={cn(
                            "absolute w-full h-[40px] border-b border-border last:border-b-0 cursor-crosshair select-none",
                            isSelected ? "bg-primary/20 ring-inset ring-1 ring-primary/40" : "hover:bg-primary/5"
                          )}
                          style={{ top: hour * 40 }}
                          onMouseDown={() => handleMouseDown(day, hour)}
                          onMouseEnter={() => handleMouseEnter(hour)}
                          onMouseUp={handleMouseUp}
                        />
                      );
                    })}

                    {/* Bloques de agentes */}
                    {blocks.map(block => {
                      const colorClass = getAgentColor(block.agentName);
                      const top = block.startHour * 40 + 2;
                      const height = block.durationHours * 40 - 4;
                      const leftPct = (block.lane / block.totalLanes) * 100;
                      const widthPct = (1 / block.totalLanes) * 100;
                      const timeLabel = `${String(block.startHour).padStart(2, '0')}:00–${String(block.endHour).padStart(2, '0')}:00`;
                      return (
                        <div
                          key={`${block.agentName}-${block.startHour}`}
                          className={cn("absolute rounded border z-10 overflow-hidden pointer-events-none", colorClass)}
                          style={{
                            top,
                            height,
                            left: `calc(${leftPct}% + 2px)`,
                            width: `calc(${widthPct}% - 4px)`,
                          }}
                        >
                          <div className="px-1.5 pt-1 pb-0.5 h-full flex flex-col">
                            <div className="flex items-start justify-between gap-0.5">
                              <span className="text-[10px] font-bold leading-tight truncate">
                                {block.agentName.split(' ')[0]}
                              </span>
                              <button
                                className="opacity-40 hover:opacity-100 transition-opacity flex-shrink-0 pointer-events-auto"
                                onClick={e => handleDeleteBlock(block.assignmentIds, e)}
                              >
                                <X size={9} />
                              </button>
                            </div>
                            {height >= 24 && (
                              <span className="text-[9px] opacity-65 leading-none mt-0.5 tabular-nums">
                                {timeLabel}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* AlertDialog limpiar */}
      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
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

      {/* Diálogo asignación */}
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
            {selectedCell && (
              <DialogDescription>
                {format(selectedCell.date, "EEEE dd 'de' MMMM", { locale: es })}
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="py-3 space-y-3">
            {/* Selector de rango horario */}
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Desde</label>
                <select
                  value={dialogFromHour}
                  onChange={e => {
                    const v = Number(e.target.value);
                    setDialogFromHour(v);
                    if (dialogToHour <= v) setDialogToHour(v + 1);
                  }}
                  className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                  ))}
                </select>
              </div>
              <span className="text-muted-foreground mt-5">–</span>
              <div className="flex-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Hasta</label>
                <select
                  value={dialogToHour}
                  onChange={e => setDialogToHour(Number(e.target.value))}
                  className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {Array.from({ length: 24 }, (_, i) => i + 1).filter(i => i > dialogFromHour).map(i => (
                    <option key={i} value={i}>{String(i === 24 ? 0 : i).padStart(2, '0')}:00{i === 24 ? ' (+1d)' : ''}</option>
                  ))}
                </select>
              </div>
              <div className="mt-5 text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">
                {dialogToHour - dialogFromHour}h
              </div>
            </div>
            {users.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {users.map(user => {
                  const name = user.name || user.email;
                  const isSelected = selectedAgents.includes(name);
                  const colorClass = getAgentColor(name);
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
