"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { format, isSameDay, parseISO, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { getEvents, deleteEvent, createEvent, sendEventNotification } from "@/lib/actions"; // Reusing actions
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

    // Dialog State
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [type, setType] = useState("Other");
    const [notifySlack, setNotifySlack] = useState(false);

    useEffect(() => {
        loadEvents();
    }, []);

    useEffect(() => {
        if (date) {
            const dayEvents = events.filter(e => {
                const start = startOfDay(new Date(e.startDate));
                const end = endOfDay(new Date(e.endDate));
                const current = date;
                return isWithinInterval(current, { start, end });
            });
            setSelectedDateEvents(dayEvents);
            setStartDate(format(date, 'yyyy-MM-dd'));
            setEndDate(format(date, 'yyyy-MM-dd'));
        }
    }, [date, events]);

    const loadEvents = async () => {
        try {
            const data = await getEvents(false);
            setEvents(data as any);
        } catch (error) {
            console.error("Error loading events", error);
        }
    };

    const handleSubmit = async () => {
        if (!title.trim()) {
            toast.error("El título es obligatorio");
            return;
        }

        setIsSubmitting(true);
        try {
            await createEvent({
                title,
                description,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                type,
                notifySlack
            });
            toast.success("Evento creado exitosamente");
            setIsDialogOpen(false);
            resetForm();
            loadEvents();
        } catch (error) {
            toast.error("Error al crear evento");
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setTitle("");
        setDescription("");

        // Default to now and now + 1 hour, handling local timezone offset for datetime-local
        const now = new Date();
        const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

        const toLocalISO = (d: Date) => {
            const pad = (n: number) => n < 10 ? '0' + n : n;
            return d.getFullYear() +
                '-' + pad(d.getMonth() + 1) +
                '-' + pad(d.getDate()) +
                'T' + pad(d.getHours()) +
                ':' + pad(d.getMinutes());
        };

        setStartDate(toLocalISO(now));
        setEndDate(toLocalISO(oneHourLater));
        setType("N1");
        setNotifySlack(false);
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm("¿Eliminar este evento?")) {
            await deleteEvent(id);
            setEvents(prev => prev.filter(ev => ev.id !== id));
            toast.success("Evento eliminado");
        }
    };

    // Custom render for calendar days
    const modifiers = {
        hasEvent: (date: Date) => {
            return events.some(e => {
                const start = startOfDay(new Date(e.startDate));
                const end = endOfDay(new Date(e.endDate));
                return isWithinInterval(date, { start, end });
            });
        }
    };

    const modifiersStyles = {
        hasEvent: {
            fontWeight: 'bold',
            color: '#2563eb', // blue-600
            backgroundColor: '#eff6ff' // blue-50
        }
    };

    const getGoogleCalendarUrl = (ev: Event) => {
        const formatTime = (d: Date) => d.toISOString().replace(/-|:|\.\d+/g, "");
        const start = formatTime(new Date(ev.startDate));
        const end = formatTime(new Date(ev.endDate));
        return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(ev.title)}&dates=${start}/${end}&details=${encodeURIComponent(ev.description || "")}`;
    };

    return (
        <div className="flex flex-col h-full gap-6">
            {/* ... (Header) ... */}
            <div className="flex items-center justify-between">
                {/* ... */}
            </div>

            <div className="grid lg:grid-cols-[300px_1fr] gap-6 h-full min-h-0">

                {/* Left Sidebar: Calendar & Controls */}
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
                                    <div className={`w-3 h-3 rounded-full ${style.dotClass}`}></div>
                                    <span className="text-slate-600">{style.label}</span>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>

                {/* Right Main Area: Day View Timeline */}
                <Card className="flex flex-col h-full bg-white shadow-sm border-slate-200 overflow-hidden">
                    <CardHeader className="border-b pb-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-2xl font-bold flex items-center gap-2 capitalize">
                                    {date ? format(date, "EEEE d 'de' MMMM", { locale: es }) : 'Selecciona una fecha'}
                                </CardTitle>
                                <CardDescription>Vista diaria detallada</CardDescription>
                            </div>
                            <Button onClick={() => setIsDialogOpen(true)}>
                                <Plus size={16} className="mr-2" />
                                Nuevo Evento
                            </Button>
                        </div>
                    </CardHeader>

                    <CardContent className="flex-1 overflow-y-auto relative scroll-smooth p-0">
                        <div className="relative min-h-[1152px] w-full"> {/* 48px per hour * 24 = 1152px (more compact) */}
                            {Array.from({ length: 24 }).map((_, hour) => (
                                <div key={hour} className="absolute w-full h-[48px] top-[calc(48px*var(--hour))] border-b border-slate-50 flex items-start group" style={{ '--hour': hour } as any}>
                                    <div className="w-16 flex-shrink-0 text-xs text-slate-400 py-2 border-r border-slate-50 text-right pr-3 bg-white sticky left-0 z-10 group-hover:text-slate-600 font-mono">
                                        {hour.toString().padStart(2, '0')}:00
                                    </div>
                                    <div className="flex-1 relative h-full group-hover:bg-slate-50/30 transition-colors">
                                        {/* Grid background */}
                                    </div>
                                </div>
                            ))}

                            {/* Events Layer */}
                            {selectedDateEvents.map(event => {
                                const start = new Date(event.startDate);
                                const end = new Date(event.endDate);

                                let startHour = start.getHours() + (start.getMinutes() / 60);
                                let endHour = end.getHours() + (end.getMinutes() / 60);

                                if (!isSameDay(start, date!)) startHour = 0;
                                if (!isSameDay(end, date!)) endHour = 24;

                                const top = startHour * 48; // 48px per hour
                                const duration = Math.max(endHour - startHour, 0.5); // Min 30 min visual
                                const height = duration * 48;

                                const style = EVENT_TYPES[event.type as keyof typeof EVENT_TYPES] || EVENT_TYPES['Other'];
                                const Icon = style.icon;

                                return (
                                    <div
                                        key={event.id}
                                        className={`absolute left-20 right-4 p-3 rounded-lg border shadow-sm hover:shadow-md transition-all cursor-pointer z-10 ${style.color.replace('text-', 'bg-opacity-10 border-opacity-40 ')} bg-white flex flex-col justify-center overflow-hidden`}
                                        style={{ top: `${top}px`, height: `${height}px` }}
                                        onClick={() => setViewEvent(event)} // Open details instead of delete
                                        title="Ver detalles"
                                    >
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <Badge variant="outline" className={`${style.color.replace('bg-', 'bg-opacity-0 ')} border-none p-0`}>
                                                <Icon size={12} className="mr-1" />
                                            </Badge>
                                            <span className={`font-bold text-sm ${style.color.match(/text-\w+-\d+/)?.[0] || 'text-slate-700'}`}>
                                                {event.title}
                                            </span>
                                            <span className="text-xs text-slate-400 font-mono ml-auto">
                                                {format(start, 'HH:mm')} - {format(end, 'HH:mm')}
                                            </span>
                                        </div>
                                        {height > 35 && (
                                            <div className="text-xs text-slate-500 pl-5 truncate">
                                                {style.label} {event.description && `• ${event.description}`}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {/* Current Time Indicator */}
                            {date && isSameDay(date, new Date()) && (
                                <div
                                    className="absolute left-16 right-0 border-t-2 border-red-500 z-20 pointer-events-none flex items-center"
                                    style={{ top: `${(new Date().getHours() + new Date().getMinutes() / 60) * 48}px` }}
                                >
                                    <div className="w-2 h-2 bg-red-500 rounded-full -ml-1"></div>
                                    <span className="bg-red-500 text-white text-[9px] px-1 rounded-sm ml-1 -mt-[13px] font-bold">
                                        {format(new Date(), "HH:mm")}
                                    </span>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* View Event Dialog */}
            <Dialog open={!!viewEvent} onOpenChange={(open) => !open && setViewEvent(null)}>
                <DialogContent>
                    <DialogHeader>
                        <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className={viewEvent ? EVENT_TYPES[viewEvent.type as keyof typeof EVENT_TYPES]?.color : ''}>
                                {viewEvent && EVENT_TYPES[viewEvent.type as keyof typeof EVENT_TYPES]?.label}
                            </Badge>
                            <span className="text-xs text-slate-400">{viewEvent && format(new Date(viewEvent.startDate), "PPP", { locale: es })}</span>
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
                                <p>{viewEvent && `${format(new Date(viewEvent.startDate), "HH:mm")} - ${format(new Date(viewEvent.endDate), "HH:mm")}`}</p>
                            </div>
                        </div>

                        {viewEvent?.description && (
                            <div className="flex items-start gap-3 text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border">
                                <div className="mt-0.5"><Bell size={16} /></div>
                                <p>{viewEvent.description}</p>
                            </div>
                        )}

                        <div className="pt-4 flex flex-col gap-3">
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
                                    Notificar a Slack
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

            {/* Create Event Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Registrar Nuevo Evento</DialogTitle>
                    </DialogHeader>
                    {/* ... Formulario simplificado ... */}
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
                            <Label htmlFor="dates" className="text-right">Fechas</Label>
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
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSubmit} disabled={isSubmitting}>Guardar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    );
}
