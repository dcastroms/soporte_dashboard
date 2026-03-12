"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar as CalendarIcon, Plus, Bell, Megaphone, Wrench, Rocket, ExternalLink, Tv, Trophy as TrophyIcon } from "lucide-react";
import { format, isSameDay, isWithinInterval, addDays } from "date-fns";
import { es } from "date-fns/locale";
import { createEvent, getEvents, deleteEvent } from "@/lib/actions";
import { toast } from "sonner";
import Link from "next/link";

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
    'N3': { label: 'Evento N3 (Crítico)', icon: Megaphone, color: 'text-rose-500 bg-rose-500/20 border-rose-500/30' },
    'N2': { label: 'Evento N2 (Alto)', icon: Wrench, color: 'text-amber-500 bg-amber-500/20 border-amber-500/30' },
    'N1': { label: 'Evento N1 (Normal)', icon: Rocket, color: 'text-sky-500 bg-sky-500/20 border-sky-500/30' },
    'Diario': { label: 'Deportivo / TV', icon: Tv, color: 'text-[#9E77E5] bg-[#9E77E5]/20 border-[#9E77E5]/30' },
    'Other': { label: 'Otro', icon: Bell, color: 'text-slate-400 bg-slate-400/20 border-slate-400/30' },
};

export function UpcomingEvents() {
    const [events, setEvents] = useState<Event[]>([]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form State
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const toLocalISO = (d: Date) => {
        const pad = (n: number) => n < 10 ? '0' + n : n;
        return d.getFullYear() +
            '-' + pad(d.getMonth() + 1) +
            '-' + pad(d.getDate()) +
            'T' + pad(d.getHours()) +
            ':' + pad(d.getMinutes());
    };

    const [startDate, setStartDate] = useState(toLocalISO(new Date()));
    const [endDate, setEndDate] = useState(toLocalISO(new Date(new Date().getTime() + 60 * 60 * 1000)));
    const [type, setType] = useState("N1");
    const [notifySlack, setNotifySlack] = useState(false);

    useEffect(() => {
        loadEvents();
    }, []);

    const loadEvents = async () => {
        try {
            const data = await getEvents(false); // Traer todos los recientes/proximos
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

        const now = new Date();
        const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

        setStartDate(toLocalISO(now));
        setEndDate(toLocalISO(oneHourLater));
        setType("N1");
        setNotifySlack(false);
    };

    const handleDelete = async (id: string) => {
        if (confirm("¿Eliminar este evento?")) {
            await deleteEvent(id);
            loadEvents();
            toast.success("Evento eliminado");
        }
    };

    const today = new Date();

    return (
        <Card className="card-neumorphic border-none bg-card h-full flex flex-col">
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                    <CalendarIcon size={16} className="text-primary" />
                    Eventos Clave
                </CardTitle>
                <div className="flex gap-2">
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary" asChild>
                        <Link href="/events" title="Ver Calendario Completo">
                            <ExternalLink size={14} />
                        </Link>
                    </Button>
                    <Button variant="outline" size="sm" className="h-6 text-xs border-border bg-card hover:bg-muted" onClick={() => setIsDialogOpen(true)}>
                        <Plus size={12} className="mr-1" />
                        Nuevo
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto max-h-[300px] space-y-3">
                {events.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                        <p className="text-xs italic">No hay eventos próximos.</p>
                    </div>
                ) : (
                    events.map(event => {
                        const style = EVENT_TYPES[event.type as keyof typeof EVENT_TYPES] || EVENT_TYPES['Other'];
                        const Icon = style.icon;
                        const start = new Date(event.startDate);
                        const end = new Date(event.endDate);
                        const isActive = isWithinInterval(today, { start, end });

                        return (
                            <div key={event.id} className="group relative flex items-start gap-3 p-3.5 rounded-xl border border-border bg-muted/5 hover:bg-muted/10 transition-all">
                                <div className={`p-2.5 rounded-xl shrink-0 ${style.color} bg-opacity-20 flex items-center justify-center border`}>
                                    <Icon size={16} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                        <h4 className="text-[11px] font-black text-foreground truncate uppercase tracking-tight">{event.title}</h4>
                                        {isActive && (
                                            <Badge variant="default" className="text-[9px] h-4 px-1 bg-green-500 hover:bg-green-600 animate-pulse">
                                                En curso
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-muted-foreground line-clamp-2">{event.description}</p>
                                    <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground font-medium">
                                        <span>
                                            {format(start, 'd MMM', { locale: es })}
                                            {!isSameDay(start, end) && ` - ${format(end, 'd MMM', { locale: es })}`}
                                        </span>
                                        <Badge variant="outline" className="text-[9px] h-4 px-1 text-muted-foreground border-border font-normal">
                                            {style.label}
                                        </Badge>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                    onClick={() => handleDelete(event.id)}
                                >
                                    <span className="sr-only">Eliminar</span>
                                    ×
                                </Button>
                            </div>
                        );
                    })
                )}
            </CardContent>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Registrar Nuevo Evento</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="title" className="text-right">Título</Label>
                            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} className="col-span-3" placeholder="Ej: Hot Sale, Mantenimiento..." />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="type" className="text-right">Tipo</Label>
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
                            <Label htmlFor="desc" className="text-right">Detalles</Label>
                            <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} className="col-span-3" placeholder="Info relevante para soporte..." />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <div className="col-start-2 col-span-3 flex items-center space-x-2">
                                <Checkbox id="slack" checked={notifySlack} onCheckedChange={(c) => setNotifySlack(c as boolean)} />
                                <Label htmlFor="slack" className="font-normal cursor-pointer">Notificar al equipo en Slack 📢</Label>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSubmit} disabled={isSubmitting}>
                            {isSubmitting ? "Guardando..." : "Guardar Evento"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
