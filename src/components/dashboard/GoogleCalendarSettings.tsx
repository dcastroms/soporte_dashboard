"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
    DialogTrigger
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Calendar, Settings, RefreshCw, CheckCircle2, AlertCircle, Plus } from "lucide-react";
import {
    getGoogleCalendars,
    updateCalendarSettings,
    getCalendarSettings,
    syncSupportAssignmentsBatch,
    createGoogleCalendarEvent,
} from '@/lib/actions';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { signIn } from 'next-auth/react';

interface GoogleCalendar {
    id: string;
    summary: string;
    primary?: boolean;
}

export function GoogleCalendarSettings({ assignmentsInView, trigger }: { assignmentsInView: any[]; trigger?: React.ReactNode }) {
    const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
    const [selectedCalendar, setSelectedCalendar] = useState<string>('primary');
    const [customCalendarId, setCustomCalendarId] = useState<string>('c_cniou4ttltdo10qltt6v977ar4@group.calendar.google.com');
    const [isCustom, setIsCustom] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    // Crear evento
    const todayStr = new Date().toISOString().slice(0, 10);
    const [newTitle, setNewTitle] = useState('');
    const [newDate, setNewDate] = useState(todayStr);
    const [newFrom, setNewFrom] = useState(9);
    const [newTo, setNewTo] = useState(17);
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        setIsLoading(true);
        try {
            const [cals, settings] = await Promise.all([
                getGoogleCalendars(),
                getCalendarSettings()
            ]);
            setCalendars(cals as any);
            if (settings?.targetCalendarId) {
                const found = (cals as any).some((c: any) => c.id === settings.targetCalendarId);
                if (found) {
                    setSelectedCalendar(settings.targetCalendarId);
                    setIsCustom(false);
                } else {
                    setSelectedCalendar('custom');
                    setCustomCalendarId(settings.targetCalendarId);
                    setIsCustom(true);
                }
            }
        } catch (error) {
            console.error("Error loading calendar settings:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveSettings = async () => {
        setIsLoading(true);
        try {
            const finalId = isCustom ? customCalendarId : selectedCalendar;
            if (isCustom && !customCalendarId) {
                toast.error("Por favor ingresa un ID de calendario");
                return;
            }
            await updateCalendarSettings({ targetCalendarId: finalId });
            toast.success("Configuración de calendario guardada");
        } catch (error) {
            toast.error("Error al guardar la configuración");
        } finally {
            setIsLoading(false);
        }
    };

    const handleManualSync = async () => {
        if (assignmentsInView.length === 0) {
            toast.error("No hay turnos para sincronizar en esta vista");
            return;
        }

        setIsSyncing(true);
        try {
            const ids = assignmentsInView.map(a => a.id);
            await syncSupportAssignmentsBatch(ids);
            toast.success(`Sincronizados ${ids.length} turnos con Google Calendar`);
        } catch (error) {
            toast.error("Error durante la sincronización");
        } finally {
            setIsSyncing(false);
        }
    };

    const handleCreateEvent = async () => {
        if (!newTitle.trim()) { toast.error('El título es obligatorio'); return; }
        if (newTo <= newFrom) { toast.error('La hora de fin debe ser mayor que la de inicio'); return; }
        setIsCreating(true);
        try {
            await createGoogleCalendarEvent({ title: newTitle.trim(), date: newDate, fromHour: newFrom, toHour: newTo });
            toast.success('Evento creado en Google Calendar');
            setNewTitle('');
        } catch {
            toast.error('Error al crear el evento');
        } finally {
            setIsCreating(false);
        }
    };

    const isLinked = calendars.length > 0;

    const content = (
        <div className="space-y-4">
            {!isLinked && !isLoading && (
                <div className="p-2 border border-orange-200 bg-orange-50 rounded text-[10px] text-orange-700 flex flex-col gap-2">
                    <div className="flex items-start gap-2">
                        <AlertCircle size={12} className="shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold">Cuenta no vinculada</p>
                            <p>Tu sesión actual no tiene una cuenta de Google asociada.</p>
                        </div>
                    </div>
                    <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-[9px] h-7 bg-white border-orange-200 hover:bg-orange-100"
                        onClick={() => signIn('google')}
                    >
                        <img src="https://www.google.com/favicon.ico" className="w-3 h-3 mr-2" alt="Google" />
                        Vincular Cuenta de Google
                    </Button>
                </div>
            )}
            <div className="flex flex-col gap-2">
                <Dialog>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="w-full text-xs gap-2 border-border hover:bg-muted/50 transition-colors">
                            <Settings size={14} className="text-slate-500" />
                            Configurar Calendario
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Configuración de Google Calendar</DialogTitle>
                            <DialogDescription>
                                Selecciona el calendario donde quieres que se carguen los turnos.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="py-6 space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase">Calendario de Destino</label>
                                <Select
                                    value={selectedCalendar}
                                    onValueChange={(val) => {
                                        setSelectedCalendar(val);
                                        setIsCustom(val === 'custom');
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecciona un calendario" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {calendars.length > 0 ? (
                                            calendars.map(cal => (
                                                <SelectItem key={cal.id} value={cal.id}>
                                                    {cal.summary} {cal.primary ? '(Principal)' : ''}
                                                </SelectItem>
                                            ))
                                        ) : (
                                            <SelectItem value="primary">Calendario Principal</SelectItem>
                                        )}
                                        <SelectItem value="custom" className="text-blue-600 font-medium">
                                            <div className="flex items-center gap-2">
                                                <Plus size={14} />
                                                Otro (ID personalizado)
                                            </div>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {isCustom && (
                                <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">ID del Calendario</label>
                                    <Input
                                        placeholder="Pegar ID aquí (ej: c_...) "
                                        value={customCalendarId}
                                        onChange={(e) => setCustomCalendarId(e.target.value)}
                                        className="text-xs"
                                    />
                                    <p className="text-[10px] text-slate-400">
                                        Pega el ID del calendario que nos pasaste (termina en @group.calendar.google.com)
                                    </p>
                                </div>
                            )}
                        </div>

                        <DialogFooter>
                            <Button onClick={handleSaveSettings} disabled={isLoading}>
                                {isLoading ? "Guardando..." : "Guardar Configuración"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Button
                    variant="default"
                    size="sm"
                    className={`w-full text-xs gap-2 ${isLinked ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-400 cursor-not-allowed'}`}
                    onClick={handleManualSync}
                    disabled={isSyncing || !isLinked}
                >
                    <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} />
                    {isSyncing ? "Sincronizando..." : "Sincronizar Semana"}
                </Button>
            </div>

            <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg border border-blue-100 dark:border-blue-900/30">
                <div className="flex gap-2">
                    <AlertCircle size={14} className="text-blue-500 mt-0.5" />
                    <p className="text-[10px] text-blue-700 dark:text-blue-400 leading-normal">
                        La sincronización enviará todos los turnos visibles en la semana actual al calendario seleccionado.
                        Este proceso puede tardar unos segundos.
                    </p>
                </div>
            </div>

            {/* Crear evento directo */}
            <div className="border border-border rounded-lg p-3 space-y-3">
                <p className="text-xs font-bold text-foreground/70 flex items-center gap-1.5">
                    <Plus size={13} /> Crear evento en calendario
                </p>
                <Input
                    placeholder="Título del evento"
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    className="h-8 text-sm"
                />
                <input
                    type="date"
                    value={newDate}
                    onChange={e => setNewDate(e.target.value)}
                    className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <div className="flex items-center gap-2">
                    <div className="flex-1">
                        <label className="text-[10px] text-muted-foreground block mb-1">Desde</label>
                        <select
                            value={newFrom}
                            onChange={e => { const v = Number(e.target.value); setNewFrom(v); if (newTo <= v) setNewTo(v + 1); }}
                            className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                            {Array.from({ length: 24 }, (_, i) => (
                                <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                            ))}
                        </select>
                    </div>
                    <span className="text-muted-foreground mt-4">–</span>
                    <div className="flex-1">
                        <label className="text-[10px] text-muted-foreground block mb-1">Hasta</label>
                        <select
                            value={newTo}
                            onChange={e => setNewTo(Number(e.target.value))}
                            className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                            {Array.from({ length: 24 }, (_, i) => i + 1).filter(i => i > newFrom).map(i => (
                                <option key={i} value={i}>{String(i === 24 ? 0 : i).padStart(2, '0')}:00{i === 24 ? ' (+1d)' : ''}</option>
                            ))}
                        </select>
                    </div>
                    <span className="text-[11px] text-muted-foreground mt-4 tabular-nums">{newTo - newFrom}h</span>
                </div>
                <Button
                    size="sm"
                    className="w-full text-xs gap-1.5"
                    onClick={handleCreateEvent}
                    disabled={isCreating || !isLinked || !newTitle.trim()}
                >
                    <Plus size={13} />
                    {isCreating ? 'Creando...' : 'Crear evento'}
                </Button>
            </div>
        </div>
    );

    if (trigger) {
        return (
            <Dialog>
                <DialogTrigger asChild>{trigger}</DialogTrigger>
                <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                        <DialogTitle>Google Calendar</DialogTitle>
                        <DialogDescription>
                            Sincroniza los turnos de la semana con tu calendario de Google.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-2">{content}</div>
                </DialogContent>
            </Dialog>
        );
    }

    return content;
}
