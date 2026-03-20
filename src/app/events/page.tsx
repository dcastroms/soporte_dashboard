"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { format, isSameDay, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { getEvents, deleteEvent, createEvent, updateEvent, sendEventNotification } from "@/lib/actions";
import { Megaphone, Wrench, Rocket, Calendar as CalIcon, Bell, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

const HOUR_PX = 48;

interface Event {
    id: string;
    title: string;
    description?: string;
    startDate: string;
    endDate: string;
    type: string;
    notifySlack: boolean;
}

const EVENT_TYPES = {
    'N3': { label: 'Evento N3 (Crítico)', icon: Megaphone, color: 'text-red-700 bg-red-100 border-red-200', dotClass: 'bg-red-600' },
    'N2': { label: 'Evento N2 (Alto)', icon: Wrench, color: 'text-orange-700 bg-orange-100 border-orange-200', dotClass: 'bg-orange-500' },
    'N1': { label: 'Evento N1 (Normal)', icon: Rocket, color: 'text-blue-700 bg-blue-100 border-blue-200', dotClass: 'bg-blue-600' },
    'Diario': { label: 'Diario / Constante', icon: CalIcon, color: 'text-slate-700 bg-slate-100 border-slate-200', dotClass: 'bg-slate-600' },
    'Other': { label: 'Otro', icon: Bell, color: 'text-gray-500 bg-gray-50 border-gray-200', dotClass: 'bg-gray-500' },
};

export default function EventsPage() {
    const [date, setDate] = useState<Date | undefined>(new Date());
    const [events, setEvents] = useState<Event[]>([]);
    const [selectedDateEvents, setSelectedDateEvents] = useState<Event[]>([]);
    const [viewEvent, setViewEvent] = useState<Event | null>(null);

    // Create / Edit dialog
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null); // null = create mode
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [type, setType] = useState("Other");
    const [notifySlack, setNotifySlack] = useState(false);
    const [syncToGcal, setSyncToGcal] = useState(false);

    // Drag-to-select for Google Calendar
    const [dragSelecting, setDragSelecting] = useState(false);
    const dragStartHourRef = useRef<number | null>(null);
    const [dragStartHour, setDragStartHour] = useState<number | null>(null);
    const [dragEndHour, setDragEndHour] = useState<number | null>(null);


    useEffect(() => {
        loadEvents();
    }, []);

    useEffect(() => {
        if (date) {
            const dayEvents = events.filter(e => {
                const start = startOfDay(new Date(e.startDate));
                const end = endOfDay(new Date(e.endDate));
                return isWithinInterval(date, { start, end });
            });
            setSelectedDateEvents(dayEvents);
            setStartDate(format(date, 'yyyy-MM-dd'));
            setEndDate(format(date, 'yyyy-MM-dd'));
        }
    }, [date, events]);

    // Cancel drag on escape
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') cancelDrag();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    const loadEvents = async () => {
        try {
            const data = await getEvents(false);
            setEvents(data as any);
        } catch (error) {
            console.error("Error loading events", error);
        }
    };

    const openEditDialog = (ev: Event) => {
        setEditingId(ev.id);
        setTitle(ev.title);
        setDescription(ev.description || "");
        // Convert stored ISO dates to datetime-local format (YYYY-MM-DDTHH:mm)
        const toLocal = (iso: string) => {
            const d = new Date(iso);
            const pad = (n: number) => String(n).padStart(2, '0');
            return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        };
        setStartDate(toLocal(ev.startDate));
        setEndDate(toLocal(ev.endDate));
        setType(ev.type);
        setNotifySlack(ev.notifySlack);
        setSyncToGcal(false);
        setViewEvent(null);
        setIsDialogOpen(true);
    };

    const handleSubmit = async () => {
        if (!title.trim()) {
            toast.error("El título es obligatorio");
            return;
        }
        setIsSubmitting(true);
        try {
            const startDt = new Date(startDate);
            const endDt = new Date(endDate);

            if (isNaN(startDt.getTime()) || isNaN(endDt.getTime())) {
                toast.error("Fecha inválida — verifica los campos de inicio y fin");
                return;
            }

            const payload = {
                title: title.trim(),
                description: description.trim() || undefined,
                startDate: startDt,
                endDate: endDt,
                type,
                notifySlack,
            };
            if (editingId) {
                await updateEvent(editingId, { ...payload, syncToGcal });
                toast.success(syncToGcal ? "Evento actualizado y sincronizado con Google Calendar 📅" : "Evento actualizado");
            } else {
                await createEvent({ ...payload, syncToGcal });
                toast.success(syncToGcal ? "Evento creado y enviado a Google Calendar 📅" : "Evento creado exitosamente");
            }

            setIsDialogOpen(false);
            resetForm();
            loadEvents();
        } catch (err: any) {
            console.error("Error guardando evento:", err);
            toast.error(err?.message || (editingId ? "Error al actualizar evento" : "Error al crear evento"));
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setTitle("");
        setDescription("");
        const now = new Date();
        const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
        const toLocalISO = (d: Date) => {
            const pad = (n: number) => (n < 10 ? '0' + n : n);
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        };
        setStartDate(toLocalISO(now));
        setEndDate(toLocalISO(oneHourLater));
        setType("N1");
        setNotifySlack(false);
        setSyncToGcal(false);
        setEditingId(null);
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm("¿Eliminar este evento?")) {
            await deleteEvent(id);
            setEvents(prev => prev.filter(ev => ev.id !== id));
            toast.success("Evento eliminado");
        }
    };

    // ── Drag handlers ──────────────────────────────────────────────
    const handleTimeMouseDown = (hour: number, e: React.MouseEvent) => {
        e.preventDefault();
        dragStartHourRef.current = hour;
        setDragSelecting(true);
        setDragStartHour(hour);
        setDragEndHour(hour);
    };

    const handleTimeMouseEnter = (hour: number) => {
        if (dragSelecting) {
            setDragEndHour(hour);
        }
    };

    const handleGridMouseUp = useCallback(() => {
        if (!dragSelecting || dragStartHourRef.current === null) return;
        setDragSelecting(false);

        const from = Math.min(dragStartHour!, dragEndHour!);
        const to = Math.max(dragStartHour!, dragEndHour!) + 1;

        // Pre-fill the event dialog with the selected range
        const baseDate = date ? format(date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
        const pad = (n: number) => String(n).padStart(2, '0');
        setStartDate(`${baseDate}T${pad(from)}:00`);
        setEndDate(`${baseDate}T${pad(to === 24 ? 0 : to)}:00`);
        setTitle("");
        setDescription("");
        setType("N1");
        setNotifySlack(false);
        setSyncToGcal(false);
        setEditingId(null);
        setIsDialogOpen(true);

        dragStartHourRef.current = null;
        setDragStartHour(null);
        setDragEndHour(null);
    }, [dragSelecting, dragStartHour, dragEndHour, date]);

    const cancelDrag = () => {
        setDragSelecting(false);
        dragStartHourRef.current = null;
        setDragStartHour(null);
        setDragEndHour(null);
    };


    // Selection overlay bounds
    const selectionTop = dragStartHour !== null && dragEndHour !== null
        ? Math.min(dragStartHour, dragEndHour) * HOUR_PX
        : null;
    const selectionHeight = dragStartHour !== null && dragEndHour !== null
        ? (Math.abs(dragEndHour - dragStartHour) + 1) * HOUR_PX
        : 0;

    // Calendar modifiers
    const modifiers = {
        hasEvent: (d: Date) => events.some(e => {
            const start = startOfDay(new Date(e.startDate));
            const end = endOfDay(new Date(e.endDate));
            return isWithinInterval(d, { start, end });
        }),
    };
    const modifiersStyles = {
        hasEvent: { fontWeight: 'bold', color: '#2563eb', backgroundColor: '#eff6ff' },
    };

    const getGoogleCalendarUrl = (ev: Event) => {
        const fmt = (d: Date) => d.toISOString().replace(/-|:|\.\d+/g, "");
        const s = fmt(new Date(ev.startDate));
        const en = fmt(new Date(ev.endDate));
        return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(ev.title)}&dates=${s}/${en}&details=${encodeURIComponent(ev.description || "")}`;
    };

    return (
        <div className="flex flex-col h-full gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Eventos</h1>
                    <p className="text-sm text-muted-foreground">Gestión de eventos operacionales</p>
                </div>
            </div>

            <div className="grid lg:grid-cols-[300px_1fr] gap-6 h-full min-h-0">

                {/* Left Sidebar */}
                <div className="flex flex-col gap-6">
                    <Card className="flex flex-col">
                        <CardHeader>
                            <CardTitle>Navegación</CardTitle>
                        </CardHeader>
                        <CardContent className="flex justify-center p-4">
                            <Calendar
                                mode="single"
                                selected={date}
                                onSelect={setDate}
                                locale={es}
                                className="rounded-md border shadow-sm"
                                classNames={{
                                    day_selected: "bg-slate-900 text-white hover:bg-slate-800 focus:bg-slate-900",
                                    day_today: "bg-slate-100 text-slate-900 font-bold",
                                }}
                                modifiers={modifiers}
                                modifiersStyles={modifiersStyles}
                            />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Leyenda</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {Object.entries(EVENT_TYPES).map(([key, style]) => (
                                <div key={key} className="flex items-center gap-2 text-sm">
                                    <div className={`w-3 h-3 rounded-full ${style.dotClass}`} />
                                    <span className="text-slate-600">{style.label}</span>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>

                {/* Main Timeline */}
                <Card className="flex flex-col h-full bg-white shadow-sm border-slate-200 overflow-hidden">
                    <CardHeader className="border-b pb-4 shrink-0">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-2xl font-bold flex items-center gap-2 capitalize">
                                    {date ? format(date, "EEEE d 'de' MMMM", { locale: es }) : 'Selecciona una fecha'}
                                </CardTitle>
                                <CardDescription>
                                    Arrastra en el grid para crear un evento en Google Calendar
                                </CardDescription>
                            </div>
                <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
                                <Plus size={16} className="mr-2" />
                                Nuevo Evento
                            </Button>
                        </div>
                    </CardHeader>

                    <CardContent className="flex-1 overflow-y-auto relative scroll-smooth p-0">
                        <div
                            className={`relative min-h-[${24 * HOUR_PX}px] w-full select-none ${dragSelecting ? 'cursor-ns-resize' : 'cursor-crosshair'}`}
                            style={{ minHeight: `${24 * HOUR_PX}px` }}
                            onMouseUp={handleGridMouseUp}
                            onMouseLeave={() => { if (dragSelecting) cancelDrag(); }}
                        >
                            {/* Hour rows */}
                            {Array.from({ length: 24 }).map((_, hour) => (
                                <div
                                    key={hour}
                                    className="absolute w-full flex items-start border-b border-slate-100"
                                    style={{ top: `${hour * HOUR_PX}px`, height: `${HOUR_PX}px` }}
                                >
                                    {/* Hour label */}
                                    <div className="w-16 shrink-0 text-xs text-slate-400 py-2 border-r border-slate-100 text-right pr-3 bg-white z-10 font-mono">
                                        {String(hour).padStart(2, '0')}:00
                                    </div>
                                    {/* Drag target area */}
                                    <div
                                        className="flex-1 h-full hover:bg-blue-50/30 transition-colors"
                                        onMouseDown={(e) => handleTimeMouseDown(hour, e)}
                                        onMouseEnter={() => handleTimeMouseEnter(hour)}
                                    />
                                </div>
                            ))}

                            {/* Drag selection overlay */}
                            {selectionTop !== null && (
                                <div
                                    className="absolute left-16 right-0 bg-blue-400/20 border-2 border-blue-400 rounded pointer-events-none z-20"
                                    style={{ top: `${selectionTop}px`, height: `${selectionHeight}px` }}
                                >
                                    <span className="absolute top-1 left-2 text-xs font-bold text-blue-700 pointer-events-none">
                                        {String(Math.min(dragStartHour!, dragEndHour!)).padStart(2, '0')}:00 – {String(Math.min(dragStartHour!, dragEndHour!) + Math.abs(dragEndHour! - dragStartHour!) + 1).padStart(2, '0')}:00
                                    </span>
                                </div>
                            )}

                            {/* Events layer */}
                            {selectedDateEvents.map(event => {
                                const start = new Date(event.startDate);
                                const end = new Date(event.endDate);

                                let startHour = start.getHours() + start.getMinutes() / 60;
                                let endHour = end.getHours() + end.getMinutes() / 60;

                                if (!isSameDay(start, date!)) startHour = 0;
                                if (!isSameDay(end, date!)) endHour = 24;

                                const top = startHour * HOUR_PX;
                                const duration = Math.max(endHour - startHour, 0.5);
                                const height = duration * HOUR_PX;

                                const style = EVENT_TYPES[event.type as keyof typeof EVENT_TYPES] || EVENT_TYPES['Other'];
                                const Icon = style.icon;

                                return (
                                    <div
                                        key={event.id}
                                        className={`absolute left-20 right-4 p-3 rounded-lg border shadow-sm hover:shadow-md transition-all cursor-pointer z-10 bg-white flex flex-col justify-center overflow-hidden ${style.color}`}
                                        style={{ top: `${top}px`, height: `${height}px` }}
                                        onClick={() => setViewEvent(event)}
                                    >
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <Icon size={12} className="shrink-0" />
                                            <span className="font-bold text-sm truncate">{event.title}</span>
                                            <span className="text-xs font-mono ml-auto shrink-0">
                                                {format(start, 'HH:mm')} – {format(end, 'HH:mm')}
                                            </span>
                                        </div>
                                        {height > 35 && (
                                            <p className="text-xs pl-5 truncate opacity-70">
                                                {style.label}{event.description && ` • ${event.description}`}
                                            </p>
                                        )}
                                    </div>
                                );
                            })}

                            {/* Current time indicator */}
                            {date && isSameDay(date, new Date()) && (
                                <div
                                    className="absolute left-16 right-0 border-t-2 border-red-500 z-20 pointer-events-none flex items-center"
                                    style={{ top: `${(new Date().getHours() + new Date().getMinutes() / 60) * HOUR_PX}px` }}
                                >
                                    <div className="w-2 h-2 bg-red-500 rounded-full -ml-1" />
                                    <span className="bg-red-500 text-white text-[9px] px-1 rounded-sm ml-1 -mt-[13px] font-bold">
                                        {format(new Date(), "HH:mm")}
                                    </span>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ── View event dialog ──────────────────────────────────── */}
            <Dialog open={!!viewEvent} onOpenChange={(open) => { if (!open) setViewEvent(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className={viewEvent ? EVENT_TYPES[viewEvent.type as keyof typeof EVENT_TYPES]?.color : ''}>
                                {viewEvent && EVENT_TYPES[viewEvent.type as keyof typeof EVENT_TYPES]?.label}
                            </Badge>
                            <span className="text-xs text-slate-400">
                                {viewEvent && format(new Date(viewEvent.startDate), "PPP", { locale: es })}
                            </span>
                        </div>
                        <DialogTitle className="text-2xl">{viewEvent?.title}</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="flex items-center gap-3 text-sm text-slate-600">
                            <div className="p-2 bg-slate-100 rounded-lg">
                                <CalIcon size={18} />
                            </div>
                            <div>
                                <p className="font-semibold">Horario</p>
                                <p>
                                    {viewEvent && `${format(new Date(viewEvent.startDate), "HH:mm")} – ${format(new Date(viewEvent.endDate), "HH:mm")}`}
                                </p>
                            </div>
                        </div>

                        {viewEvent?.description && (
                            <div className="flex items-start gap-3 text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border">
                                <Bell size={16} className="mt-0.5" />
                                <p>{viewEvent.description}</p>
                            </div>
                        )}

                        <div className="pt-4 flex flex-col gap-3">
                            <Button
                                className="w-full gap-2"
                                onClick={() => viewEvent && openEditDialog(viewEvent)}
                            >
                                Editar evento
                            </Button>
                            <div className="grid grid-cols-2 gap-2">
                                <Button className="w-full gap-2" variant="outline" asChild>
                                    <a href={viewEvent ? getGoogleCalendarUrl(viewEvent) : '#'} target="_blank" rel="noopener noreferrer">
                                        <CalIcon className="w-4 h-4" />
                                        Google Calendar
                                    </a>
                                </Button>
                                <Button
                                    className="w-full gap-2"
                                    variant="outline"
                                    onClick={() => {
                                        if (viewEvent) {
                                            sendEventNotification(viewEvent.id)
                                                .then(() => toast.success("Notificación enviada a Slack 📢"))
                                                .catch(() => toast.error("Error al enviar notificación"));
                                        }
                                    }}
                                >
                                    <Megaphone className="w-4 h-4" />
                                    Notificar Slack
                                </Button>
                            </div>
                            <Button
                                variant="ghost"
                                className="w-full text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => {
                                    if (viewEvent && confirm("¿Eliminar este evento permanentemente?")) {
                                        deleteEvent(viewEvent.id).then(() => {
                                            setEvents(prev => prev.filter(e => e.id !== viewEvent.id));
                                            setViewEvent(null);
                                            toast.success("Evento eliminado");
                                        });
                                    }
                                }}
                            >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Eliminar Evento
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── Create / Edit event dialog ─────────────────────────── */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingId ? "Editar Evento" : "Registrar Nuevo Evento"}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="ev-title" className="text-right">Título</Label>
                            <Input id="ev-title" value={title} onChange={(e) => setTitle(e.target.value)} className="col-span-3" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="ev-type" className="text-right">Tipo</Label>
                            <Select value={type} onValueChange={setType}>
                                <SelectTrigger className="col-span-3">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(EVENT_TYPES).map(([key, val]) => (
                                        <SelectItem key={key} value={key}>{val.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">Fechas</Label>
                            <div className="col-span-3 flex gap-2">
                                <Input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                                <Input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                            </div>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="ev-desc" className="text-right">Detalles</Label>
                            <Textarea id="ev-desc" value={description} onChange={(e) => setDescription(e.target.value)} className="col-span-3" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <div className="col-start-2 col-span-3 flex items-center space-x-2">
                                <Checkbox id="ev-slack" checked={notifySlack} onCheckedChange={(c) => setNotifySlack(c as boolean)} />
                                <Label htmlFor="ev-slack" className="font-normal cursor-pointer">Notificar al equipo en Slack 📢</Label>
                            </div>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <div className="col-start-2 col-span-3 flex items-center space-x-2">
                                <Checkbox id="ev-gcal" checked={syncToGcal} onCheckedChange={(c) => setSyncToGcal(c as boolean)} />
                                <Label htmlFor="ev-gcal" className="font-normal cursor-pointer">Crear en Google Calendar 📅</Label>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSubmit} disabled={isSubmitting}>
                            {isSubmitting ? "Guardando..." : editingId ? "Guardar cambios" : "Guardar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
