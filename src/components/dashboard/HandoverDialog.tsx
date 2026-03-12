"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClipboardCheck, AlertTriangle, ExternalLink, CheckSquare, Square } from "lucide-react";
import { saveShiftHandover, getUsers, fetchIntercomHandoverData } from '@/lib/actions';
import { notifySlackHandover } from '@/lib/slackNotifications';
import { toast } from 'sonner';
import { useSession } from 'next-auth/react';
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface HandoverDialogProps {
    assignments: Array<{
        id: string;
        date: string;
        hour: number;
        agentName: string;
    }>;
    customTrigger?: React.ReactNode;
}

export function HandoverDialog({ assignments, customTrigger }: HandoverDialogProps) {
    const { data: session } = useSession();
    const [open, setOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        shiftType: 'Mañana',
        receiverName: '',
        pendings: '',
        incidents: '',
        generalStatus: 'Verde',
        details: ''
    });
    const [users, setUsers] = useState<Array<{ id: string; name: string | null; email: string }>>([]);
    const [intercomData, setIntercomData] = useState<any>(null);
    const [isLoadingIntercom, setIsLoadingIntercom] = useState(false);

    // Estado para selección de tickets y comentarios
    const [selectedTickets, setSelectedTickets] = useState<Record<string, boolean>>({});
    const [ticketComments, setTicketComments] = useState<Record<string, string>>({});

    useEffect(() => {
        loadUsers();
    }, []);

    useEffect(() => {
        if (open && session?.user?.name) {
            loadIntercomData(session.user.name);
            // Reset selection when opening
            setSelectedTickets({});
            setTicketComments({});
        }
    }, [open, session]);

    const loadUsers = async () => {
        try {
            const userList = await getUsers();
            setUsers(userList as any);
        } catch (error) {
            console.error("Error loading users:", error);
        }
    };

    const loadIntercomData = async (agentName: string) => {
        setIsLoadingIntercom(true);
        try {
            const data = await fetchIntercomHandoverData(agentName);
            setIntercomData(data);
        } catch (error) {
            console.error("Error loading Intercom data", error);
        } finally {
            setIsLoadingIntercom(false);
        }
    };

    const toggleTicket = (id: string) => {
        setSelectedTickets(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    const updateComment = (id: string, comment: string) => {
        setTicketComments(prev => ({
            ...prev,
            [id]: comment
        }));
    };

    const handleImportTickets = () => {
        const selectedIds = Object.keys(selectedTickets).filter(id => selectedTickets[id]);

        if (selectedIds.length === 0) {
            toast.error("Selecciona al menos un ticket para importar");
            return;
        }

        const ticketsText = selectedIds.map(id => {
            const ticket = intercomData?.openTickets?.find((t: any) => t.id === id);
            if (!ticket) return '';
            const comment = ticketComments[id] ? `: ${ticketComments[id]}` : '';
            return `- [${ticket.subject}](${ticket.url})${comment} · Asignado a: ${ticket.assignee}`;
        }).join('\n');

        setFormData(prev => ({
            ...prev,
            pendings: prev.pendings ? `${prev.pendings}\n${ticketsText}` : ticketsText
        }));

        toast.success(`${selectedIds.length} tickets importados a pendientes`);
    };

    const handleSubmit = async () => {
        if (!session?.user?.name) {
            toast.error("Debes estar autenticado para realizar una entrega de turno");
            return;
        }

        if (!formData.receiverName) {
            toast.error("Por favor selecciona el agente que recibe el turno");
            return;
        }

        // Auto-merge any selected (but not manually imported) Intercom tickets
        const selectedIds = Object.keys(selectedTickets).filter(id => selectedTickets[id]);
        let mergedPendings = formData.pendings;
        if (selectedIds.length > 0 && intercomData?.openTickets) {
            const ticketsText = selectedIds.map(id => {
                const ticket = intercomData.openTickets.find((t: any) => t.id === id);
                if (!ticket) return '';
                const comment = ticketComments[id] ? `: ${ticketComments[id]}` : '';
                return `- ${ticket.subject}${comment} · Asignado a: ${ticket.assignee} ${ticket.url}`;
            }).filter(Boolean).join('\n');
            if (ticketsText) {
                mergedPendings = mergedPendings
                    ? `${mergedPendings}\n${ticketsText}`
                    : ticketsText;
            }
        }

        if (!mergedPendings || !formData.incidents) {
            toast.error("Por favor completa todos los campos obligatorios");
            return;
        }

        const today = new Date().toISOString().split('T')[0];
        const userShiftsToday = assignments.filter(
            a => a.date === today && a.agentName === session.user.name
        );

        if (userShiftsToday.length === 0) {
            // Soft warning — don't block; agent may be working an unregistered shift
            toast.warning("No tienes turno registrado hoy, pero se guardará igual.", { duration: 4000 });
        }

        const hours = userShiftsToday.map(a => a.hour).sort((a, b) => a - b);
        const startHour = hours[0];
        const endHour = hours[hours.length - 1] + 1;

        setIsSubmitting(true);
        try {
            await saveShiftHandover({
                date: today,
                startHour,
                endHour,
                agentName: session.user.name,
                shiftType: formData.shiftType,
                receiverName: formData.receiverName,
                pendings: mergedPendings,        // ← auto-merged with selected tickets
                incidents: formData.incidents,
                generalStatus: formData.generalStatus,
                details: formData.details,
            });

            toast.success("Entrega de turno registrada exitosamente");
            window.dispatchEvent(new Event('handover-updated'));

            // Fire-and-forget Slack notification
            notifySlackHandover({
                agentName: session.user.name,
                shiftType: formData.shiftType,
                openTickets: intercomData?.openTickets?.length ?? 0,
                criticalNotes: formData.incidents,
                pendingIssues: mergedPendings     // ← use merged version
                    ? mergedPendings.split('\n').filter(Boolean)
                    : [],
                handoverTime: new Date().toISOString(),
            }).catch(() => { }); // never blocks the UI

            setOpen(false);
            setFormData({
                shiftType: 'Mañana',
                receiverName: '',
                pendings: '',
                incidents: '',
                generalStatus: 'Verde',
                details: ''
            });
        } catch (error) {
            toast.error("Error al guardar la entrega de turno");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {customTrigger || (
                    <Button
                        variant="default"
                        size="sm"
                        className="w-full text-xs gap-2 bg-green-600 hover:bg-green-700"
                    >
                        <ClipboardCheck size={14} />
                        Realizar Entrega de Turno
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[60vw] w-[60vw] max-h-[90vh] overflow-hidden flex flex-col p-0">
                <DialogHeader className="px-6 pt-6 pb-4 shrink-0 border-b">
                    <DialogTitle>Entrega de Turno</DialogTitle>
                    <DialogDescription>
                        Completa el reporte detallado para el siguiente turno.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
                    {/* Intercom Status Section */}
                    {session?.user?.name && (
                        <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-lg p-3 mb-6">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-xs text-slate-500 uppercase tracking-wider">Estado Intercom</span>
                                    {isLoadingIntercom && <span className="text-[10px] text-slate-400 animate-pulse">Sincronizando...</span>}
                                </div>
                                {intercomData?.status ? (
                                    <Badge variant={intercomData.status.isAway ? "outline" : "destructive"} className="text-[10px] px-2 h-5">
                                        {intercomData.status.status}
                                    </Badge>
                                ) : null}
                            </div>

                            {intercomData?.status && !intercomData.status.isAway && (
                                <div className="flex items-start gap-2 text-red-600 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 p-2 rounded-md mb-3 text-xs">
                                    <AlertTriangle size={14} className="mt-0.5" />
                                    <span className="font-medium dark:text-red-300">Atención: Sigues conectado (Online). Recuerda cambiarte a Ausente al finalizar.</span>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <div className="text-center p-2 bg-white dark:bg-slate-800 rounded border border-slate-100 dark:border-slate-700 shadow-sm">
                                    <div className="text-slate-400 text-[9px] uppercase font-semibold mb-1">Volumen Hoy (Equipo)</div>
                                    <div className="font-bold text-base text-slate-800">{intercomData?.metrics?.volume ?? '-'}</div>
                                </div>
                                <div className="text-center p-2 bg-white dark:bg-slate-800 rounded border border-slate-100 dark:border-slate-700 shadow-sm">
                                    <div className="text-slate-400 text-[9px] uppercase font-semibold mb-1">Total Abiertos</div>
                                    <div className="font-bold text-base text-blue-600">{intercomData?.openTickets?.length ?? 0}</div>
                                </div>
                            </div>

                            {/* Ticket Selection Area */}
                            {intercomData?.openTickets?.length > 0 && (
                                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md overflow-hidden">
                                    <div className="bg-slate-100 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 flex justify-between items-center">
                                        <span>Seleccionar Tickets para Reporte</span>
                                        <Badge variant="secondary" className="text-[10px]">
                                            {Object.keys(selectedTickets).filter(k => selectedTickets[k]).length} seleccionados
                                        </Badge>
                                    </div>
                                    <ScrollArea className="h-[200px]">
                                        <div className="divide-y divide-slate-100">
                                            {intercomData.openTickets.map((ticket: any) => (
                                                <div key={ticket.id} className={`p-3 text-sm transition-colors ${selectedTickets[ticket.id] ? 'bg-primary/5 dark:bg-primary/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                                                    <div className="flex items-start gap-3">
                                                        <button
                                                            onClick={() => toggleTicket(ticket.id)}
                                                            className="mt-1 text-slate-400 hover:text-blue-600 transition-colors focus:outline-none"
                                                        >
                                                            {selectedTickets[ticket.id] ? (
                                                                <CheckSquare size={18} className="text-blue-600" />
                                                            ) : (
                                                                <Square size={18} />
                                                            )}
                                                        </button>
                                                        <div className="flex-1 space-y-1">
                                                            <div className="flex items-start justify-between gap-2">
                                                                <a
                                                                    href={ticket.url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="font-medium text-slate-700 hover:text-blue-600 hover:underline line-clamp-1"
                                                                >
                                                                    {ticket.subject}
                                                                </a>
                                                                <Badge variant="outline" className="text-[10px] whitespace-nowrap shrink-0">
                                                                    {ticket.assignee}
                                                                </Badge>
                                                            </div>

                                                            {selectedTickets[ticket.id] && (
                                                                <div className="animate-in fade-in slide-in-from-top-1 pt-2">
                                                                    <Input
                                                                        placeholder="Agregar comentario de entrega (opcional)..."
                                                                        value={ticketComments[ticket.id] || ''}
                                                                        onChange={(e) => updateComment(ticket.id, e.target.value)}
                                                                        className="h-8 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                    <div className="p-2 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            onClick={handleImportTickets}
                                            className="h-7 text-xs bg-blue-100 text-blue-700 hover:bg-blue-200"
                                            disabled={Object.keys(selectedTickets).filter(k => selectedTickets[k]).length === 0}
                                        >
                                            <ExternalLink size={12} className="mr-1.5" />
                                            Importar Tickets Seleccionados
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="space-y-4 pb-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Turno</Label>
                                <Select
                                    value={formData.shiftType}
                                    onValueChange={(val) => setFormData({ ...formData, shiftType: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Mañana">Mañana</SelectItem>
                                        <SelectItem value="Tarde">Tarde</SelectItem>
                                        <SelectItem value="Noche">Noche</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Estado General</Label>
                                <Select
                                    value={formData.generalStatus}
                                    onValueChange={(val) => setFormData({ ...formData, generalStatus: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Verde">🟢 Verde (Estable)</SelectItem>
                                        <SelectItem value="Amarillo">🟡 Amarillo (Alerta)</SelectItem>
                                        <SelectItem value="Rojo">🔴 Rojo (Crítico)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Agente que Recibe el Turno *</Label>
                            <Select
                                value={formData.receiverName}
                                onValueChange={(val) => setFormData({ ...formData, receiverName: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecciona quien recibe" />
                                </SelectTrigger>
                                <SelectContent>
                                    {users.map(user => (
                                        <SelectItem key={user.id} value={user.name || user.email}>
                                            {user.name || user.email}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Tareas Pendientes (Resumen Final) *</Label>
                            <Textarea
                                placeholder="Describe las tareas pendientes. Puedes usar el importador de arriba para traer tickets."
                                value={formData.pendings}
                                onChange={(e) => setFormData({ ...formData, pendings: e.target.value })}
                                rows={6}
                                className="font-mono text-sm"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Incidentes Relevantes *</Label>
                            <Textarea
                                placeholder="Ej: Caída del servicio Y a las 14:30, resuelta a las 15:00..."
                                value={formData.incidents}
                                onChange={(e) => setFormData({ ...formData, incidents: e.target.value })}
                                rows={3}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Detalles Adicionales</Label>
                            <Textarea
                                placeholder="Cualquier otra observación importante..."
                                value={formData.details}
                                onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                                rows={2}
                            />
                        </div>
                    </div>
                </div>

                <DialogFooter className="px-6 py-4 border-t shrink-0">
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? "Guardando..." : "Guardar Entrega"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
