"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, User, AlertTriangle, Trash2, Download, Filter, Pencil, X, Check } from "lucide-react";
import { getRecentHandovers, deleteShiftHandover, updateShiftHandover } from '@/lib/actions';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import Papa from "papaparse";

interface Handover {
    id: string;
    date: string;
    shiftType: string;
    startHour?: number | null;
    endHour?: number | null;
    agentName: string;
    receiverName: string;
    pendings: string;
    incidents: string;
    generalStatus: string;
    details?: string;
    createdAt: Date;
}

const ALL = "ALL";

export function HandoverHistory() {
    const { data: session } = useSession();
    const [handovers, setHandovers] = useState<Handover[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const PAGE_SIZE = 20; // Load more at once so filters have enough data

    // Filters
    const [filterAgent, setFilterAgent] = useState<string>(ALL);
    const [filterStatus, setFilterStatus] = useState<string>(ALL);

    // Edit state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<{
        pendings: string; incidents: string; generalStatus: string; details: string;
    }>({ pendings: '', incidents: '', generalStatus: 'Verde', details: '' });
    const [isSavingEdit, setIsSavingEdit] = useState(false);

    useEffect(() => {
        loadHandovers(true);
        const handleUpdate = () => loadHandovers(true);
        window.addEventListener('handover-updated', handleUpdate);
        return () => window.removeEventListener('handover-updated', handleUpdate);
    }, []);

    const loadHandovers = async (reset = false) => {
        if (!reset && (!hasMore || isLoadingMore)) return;
        reset ? setIsLoading(true) : setIsLoadingMore(true);
        try {
            const skip = reset ? 0 : handovers.length;
            const data = await getRecentHandovers(PAGE_SIZE, skip);
            reset
                ? setHandovers(data as any)
                : setHandovers(prev => [...prev, ...data] as any);
            setHasMore(data.length === PAGE_SIZE);
        } catch (error) {
            console.error("Error loading handovers:", error);
        } finally {
            setIsLoading(false);
            setIsLoadingMore(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteShiftHandover(id);
            toast.success("Entrega de turno eliminada");
            loadHandovers(true);
        } catch (error) {
            toast.error("Error al eliminar");
        }
    };

    const handleStartEdit = (h: Handover) => {
        setEditingId(h.id);
        setEditForm({
            pendings: h.pendings || '',
            incidents: h.incidents || '',
            generalStatus: h.generalStatus || 'Verde',
            details: h.details || '',
        });
    };

    const handleCancelEdit = () => setEditingId(null);

    const handleSaveEdit = async (id: string) => {
        setIsSavingEdit(true);
        try {
            await updateShiftHandover(id, editForm);
            toast.success("Entrega actualizada correctamente");
            setEditingId(null);
            loadHandovers(true);
        } catch (error) {
            toast.error("Error al actualizar la entrega");
        } finally {
            setIsSavingEdit(false);
        }
    };

    const stripHtml = (html: string) => html ? html.replace(/<[^>]*>?/gm, '') : "";

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Verde': return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800';
            case 'Amarillo': return 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800';
            case 'Rojo': return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'Verde': return '🟢';
            case 'Amarillo': return '🟡';
            case 'Rojo': return '🔴';
            default: return '⚪';
        }
    };

    // Unique agents for filter dropdown
    const uniqueAgents = useMemo(() => {
        const names = [...new Set(handovers.map(h => h.agentName))];
        return names.sort();
    }, [handovers]);

    // Filtered list
    const filtered = useMemo(() => {
        return handovers.filter(h => {
            if (filterAgent !== ALL && h.agentName !== filterAgent) return false;
            if (filterStatus !== ALL && h.generalStatus !== filterStatus) return false;
            return true;
        });
    }, [handovers, filterAgent, filterStatus]);

    // CSV Export
    const handleExport = () => {
        const rows = filtered.map(h => ({
            "Fecha": h.date,
            "Turno": h.shiftType,
            "Hora Inicio": h.startHour ?? '',
            "Hora Fin": h.endHour ?? '',
            "Agente Saliente": h.agentName,
            "Agente Entrante": h.receiverName,
            "Estado General": h.generalStatus,
            "Pendientes": stripHtml(h.pendings),
            "Incidentes": h.incidents,
            "Detalles": h.details ?? '',
            "Registrado": format(new Date(h.createdAt), "dd/MM/yyyy HH:mm"),
        }));

        const csv = Papa.unparse(rows, { delimiter: ";" });
        const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }); // BOM for Excel
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `handovers_${format(new Date(), "yyyyMMdd_HHmm")}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`${rows.length} registros exportados`);
    };

    if (isLoading) {
        return (
            <Card>
                <CardHeader><CardTitle className="text-sm">Historial de Entregas</CardTitle></CardHeader>
                <CardContent><p className="text-xs text-muted-foreground">Cargando...</p></CardContent>
            </Card>
        );
    }

    return (
        <Card className="flex flex-col h-full border-none shadow-none bg-transparent">
            <CardHeader className="px-0 pt-0">
                <div className="flex items-start justify-between mb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <Clock size={16} className="text-[#9E77E5]" />
                        Historial de Entregas
                        <Badge variant="outline" className="text-[10px] text-muted-foreground ml-1">
                            {filtered.length} / {handovers.length}
                        </Badge>
                    </CardTitle>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExport}
                        className="h-7 text-[11px] gap-1.5 px-2"
                        disabled={filtered.length === 0}
                    >
                        <Download size={11} />
                        Exportar CSV
                    </Button>
                </div>

                {/* Filter controls */}
                <div className="flex gap-2">
                    <Select value={filterAgent} onValueChange={setFilterAgent}>
                        <SelectTrigger className="h-7 text-[11px] flex-1">
                            <div className="flex items-center gap-1.5">
                                <Filter size={10} className="text-muted-foreground" />
                                <SelectValue placeholder="Agente" />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL}>Todos los agentes</SelectItem>
                            {uniqueAgents.map(name => (
                                <SelectItem key={name} value={name}>{name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger className="h-7 text-[11px] flex-1">
                            <SelectValue placeholder="Estado" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL}>Todos los estados</SelectItem>
                            <SelectItem value="Verde">🟢 Verde</SelectItem>
                            <SelectItem value="Amarillo">🟡 Amarillo</SelectItem>
                            <SelectItem value="Rojo">🔴 Rojo</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>

            <CardContent className="px-0 flex-1 overflow-hidden flex flex-col">
                <ScrollArea className="flex-1 pr-4">
                    {filtered.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic text-center py-8">
                            No hay entregas con los filtros seleccionados
                        </p>
                    ) : (
                        <div className="space-y-3 pb-4">
                            {filtered.map((handover) => {
                                const isMe = session?.user?.name === handover.agentName;
                                const isForMe = session?.user?.name === handover.receiverName;
                                const isRelevant = isMe || isForMe;

                                return (
                                    <div
                                        key={handover.id}
                                        className={`border rounded-lg p-3 transition-colors ${isRelevant
                                            ? 'bg-[#9E77E5]/5 border-l-4 border-l-[#9E77E5] shadow-sm'
                                            : 'bg-card hover:bg-muted/30 shadow-sm'
                                            }`}
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {isMe && <Badge variant="secondary" className="text-[9px] bg-[#9E77E5]/15 text-[#9E77E5]">Enviada por ti</Badge>}
                                                {isForMe && <Badge variant="secondary" className="text-[9px] bg-primary/15 text-primary">Para ti</Badge>}
                                                <Badge variant="outline" className="text-[9px] font-bold">{handover.shiftType}</Badge>
                                                <Badge className={`text-[9px] ${getStatusColor(handover.generalStatus)}`}>
                                                    {getStatusIcon(handover.generalStatus)} {handover.generalStatus}
                                                </Badge>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <span className="text-[9px] text-muted-foreground">
                                                    {format(new Date(handover.createdAt), "dd MMM, HH:mm", { locale: es })}
                                                </span>
                                                {editingId === handover.id ? (
                                                    <>
                                                        <Button variant="ghost" size="icon" className="h-5 w-5 text-emerald-500 hover:text-emerald-600" onClick={() => handleSaveEdit(handover.id)} disabled={isSavingEdit}>
                                                            <Check size={12} />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-foreground" onClick={handleCancelEdit}>
                                                            <X size={12} />
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-[#9E77E5]" onClick={() => handleStartEdit(handover)}>
                                                            <Pencil size={11} />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(handover.id)}>
                                                            <Trash2 size={12} />
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1 mb-2">
                                            <User size={10} className="text-muted-foreground" />
                                            <span className="text-[10px] font-semibold text-foreground">{handover.agentName}</span>
                                            <span className="text-[9px] text-muted-foreground">→</span>
                                            <span className="text-[10px] font-semibold text-[#9E77E5]">{handover.receiverName}</span>
                                            <span className="text-[9px] text-muted-foreground">
                                                • {handover.date}
                                                {handover.startHour != null && handover.endHour != null && (
                                                    <> ({handover.startHour}:00–{handover.endHour}:00)</>
                                                )}
                                            </span>
                                        </div>

                                        {editingId === handover.id ? (
                                            <div className="space-y-2 mt-2 border-t border-border/50 pt-2">
                                                <div>
                                                    <label className="text-[9px] font-bold text-muted-foreground uppercase">Estado</label>
                                                    <select
                                                        value={editForm.generalStatus}
                                                        onChange={e => setEditForm(p => ({ ...p, generalStatus: e.target.value }))}
                                                        className="mt-0.5 w-full text-[10px] bg-muted border border-border rounded px-2 py-1"
                                                    >
                                                        <option>Verde</option>
                                                        <option>Amarillo</option>
                                                        <option>Rojo</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-[9px] font-bold text-muted-foreground uppercase">Pendientes</label>
                                                    <textarea
                                                        value={editForm.pendings}
                                                        onChange={e => setEditForm(p => ({ ...p, pendings: e.target.value }))}
                                                        rows={3}
                                                        className="mt-0.5 w-full text-[10px] bg-muted border border-border rounded px-2 py-1 resize-none"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[9px] font-bold text-muted-foreground uppercase">Incidentes</label>
                                                    <textarea
                                                        value={editForm.incidents}
                                                        onChange={e => setEditForm(p => ({ ...p, incidents: e.target.value }))}
                                                        rows={2}
                                                        className="mt-0.5 w-full text-[10px] bg-muted border border-border rounded px-2 py-1 resize-none"
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-1.5">
                                                <div>
                                                    <p className="text-[9px] font-bold text-muted-foreground uppercase mb-0.5">Pendientes</p>
                                                    <p className="text-[10px] text-foreground/80 leading-relaxed whitespace-pre-line">
                                                        {stripHtml(handover.pendings)}
                                                    </p>
                                                </div>
                                                {handover.incidents && (
                                                    <div>
                                                        <p className="text-[9px] font-bold text-muted-foreground uppercase mb-0.5 flex items-center gap-1">
                                                            <AlertTriangle size={9} /> Incidentes
                                                        </p>
                                                        <p className="text-[10px] text-foreground/80 leading-relaxed">{handover.incidents}</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {hasMore && (
                                <Button
                                    variant="outline"
                                    className="w-full text-xs text-muted-foreground h-8"
                                    onClick={() => loadHandovers(false)}
                                    disabled={isLoadingMore}
                                >
                                    {isLoadingMore ? "Cargando..." : "Cargar más"}
                                </Button>
                            )}
                        </div>
                    )}
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
