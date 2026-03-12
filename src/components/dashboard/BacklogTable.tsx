"use client";

import { useState, useMemo } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, X, Filter, ArrowUpDown, ArrowUp, ArrowDown, LayoutGrid, List } from "lucide-react";
import { BacklogKanban } from "./BacklogKanban";

interface BacklogItem {
    id: string;
    title: string;
    type: string;
    assignee: string;
    priority: string;
    status: string;
}

type SortConfig = {
    key: keyof BacklogItem | null;
    direction: 'asc' | 'desc';
};

export function BacklogTable({ items }: { items: BacklogItem[] }) {
    const [search, setSearch] = useState("");
    const [priorityFilter, setPriorityFilter] = useState("ALL");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: 'asc' });
    const [view, setView] = useState<'table' | 'kanban'>('table');

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'Crítica': return 'text-rose-700 bg-rose-50 border-rose-200';
            case 'Alta': return 'text-orange-700 bg-orange-50 border-orange-200';
            case 'Media': return 'text-amber-700 bg-amber-50 border-amber-200';
            case 'Baja': return 'text-slate-700 bg-slate-50 border-slate-200';
            default: return 'text-slate-700 bg-slate-50 border-slate-200';
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Pendiente': return 'bg-muted text-muted-foreground';
            case 'En Progreso': return 'bg-blue-500/10 text-blue-500';
            case 'Completado': return 'bg-emerald-500/10 text-emerald-500';
            default: return 'bg-muted text-muted-foreground';
        }
    };

    const priorityOrder: Record<string, number> = {
        'Crítica': 4,
        'Alta': 3,
        'Media': 2,
        'Baja': 1
    };

    const statusOrder: Record<string, number> = {
        'Pendiente': 1,
        'En Progreso': 2,
        'Completado': 3
    };

    const sortedAndFilteredItems = useMemo(() => {
        let filtered = items.filter(item => {
            const matchesSearch = item.title.toLowerCase().includes(search.toLowerCase()) ||
                item.assignee.toLowerCase().includes(search.toLowerCase());
            const matchesPriority = priorityFilter === "ALL" || item.priority === priorityFilter;
            const matchesStatus = statusFilter === "ALL" || item.status === statusFilter;

            return matchesSearch && matchesPriority && matchesStatus;
        });

        if (sortConfig.key) {
            filtered.sort((a, b) => {
                let aVal: any = a[sortConfig.key!];
                let bVal: any = b[sortConfig.key!];

                // Special handling for priority/status ranking
                if (sortConfig.key === 'priority') {
                    aVal = priorityOrder[aVal] || 0;
                    bVal = priorityOrder[bVal] || 0;
                } else if (sortConfig.key === 'status') {
                    aVal = statusOrder[aVal] || 0;
                    bVal = statusOrder[bVal] || 0;
                }

                if (aVal < bVal) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (aVal > bVal) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }

        return filtered;
    }, [items, search, priorityFilter, statusFilter, sortConfig]);

    const handleSort = (key: keyof BacklogItem) => {
        setSortConfig((prev) => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
        }));
    };

    const renderSortIcon = (key: keyof BacklogItem) => {
        if (sortConfig.key !== key) return <ArrowUpDown size={14} className="ml-1 opacity-30 group-hover:opacity-100 transition-opacity" />;
        return sortConfig.direction === 'asc'
            ? <ArrowUp size={14} className="ml-1 text-blue-600" />
            : <ArrowDown size={14} className="ml-1 text-blue-600" />;
    };

    const clearFilters = () => {
        setSearch("");
        setPriorityFilter("ALL");
        setStatusFilter("ALL");
        setSortConfig({ key: null, direction: 'asc' });
    };

    return (
        <div className="space-y-4">
            {/* Filters Bar */}
            <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-card p-3 rounded-lg border-none shadow-none">
                <div className="relative w-full md:w-80">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por título o responsable..."
                        className="pl-9 bg-background/50 border-input"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                    <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                        <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="Prioridad" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Todas</SelectItem>
                            <SelectItem value="Crítica">Crítica</SelectItem>
                            <SelectItem value="Alta">Alta</SelectItem>
                            <SelectItem value="Media">Media</SelectItem>
                            <SelectItem value="Baja">Baja</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="Estado" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Todos</SelectItem>
                            <SelectItem value="Pendiente">Pendiente</SelectItem>
                            <SelectItem value="En Progreso">En Progreso</SelectItem>
                            <SelectItem value="Completado">Completado</SelectItem>
                        </SelectContent>
                    </Select>

                    {(search || priorityFilter !== "ALL" || statusFilter !== "ALL" || sortConfig.key) && (
                        <Button variant="ghost" size="sm" onClick={clearFilters} className="text-slate-500 hover:text-slate-700 h-10 px-3">
                            <X size={16} className="mr-2" />
                            Limpiar
                        </Button>
                    )}

                    <div className="flex bg-muted/50 p-1 rounded-lg border-none ml-2">
                        <Button
                            variant={view === 'table' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => setView('table')}
                            className={`h-8 px-3 ${view === 'table' ? 'shadow-sm bg-background' : 'text-muted-foreground'}`}
                        >
                            <List size={16} className="mr-2" />
                            Tabla
                        </Button>
                        <Button
                            variant={view === 'kanban' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => setView('kanban')}
                            className={`h-8 px-3 ${view === 'kanban' ? 'shadow-sm bg-background' : 'text-muted-foreground'}`}
                        >
                            <LayoutGrid size={16} className="mr-2" />
                            Kanban
                        </Button>
                    </div>
                </div>
            </div>

            {/* View Switching */}
            {view === 'table' ? (
                <div className="bg-card rounded-none border-t border-border overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-transparent hover:bg-transparent">
                                <TableHead
                                    className="w-[300px] cursor-pointer group hover:text-signal transition-colors"
                                    onClick={() => handleSort('title')}
                                >
                                    <div className="flex items-center text-xs font-black uppercase tracking-wider">
                                        Tema {renderSortIcon('title')}
                                    </div>
                                </TableHead>
                                <TableHead
                                    className="cursor-pointer group hover:text-blue-600 transition-colors"
                                    onClick={() => handleSort('type')}
                                >
                                    <div className="flex items-center text-xs font-black uppercase tracking-wider">
                                        Tipo {renderSortIcon('type')}
                                    </div>
                                </TableHead>
                                <TableHead
                                    className="cursor-pointer group hover:text-blue-600 transition-colors"
                                    onClick={() => handleSort('assignee')}
                                >
                                    <div className="flex items-center text-xs font-black uppercase tracking-wider">
                                        Responsable {renderSortIcon('assignee')}
                                    </div>
                                </TableHead>
                                <TableHead
                                    className="cursor-pointer group hover:text-blue-600 transition-colors"
                                    onClick={() => handleSort('priority')}
                                >
                                    <div className="flex items-center text-xs font-black uppercase tracking-wider">
                                        Prioridad {renderSortIcon('priority')}
                                    </div>
                                </TableHead>
                                <TableHead
                                    className="cursor-pointer group hover:text-blue-600 transition-colors"
                                    onClick={() => handleSort('status')}
                                >
                                    <div className="flex items-center text-xs font-black uppercase tracking-wider">
                                        Estado {renderSortIcon('status')}
                                    </div>
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedAndFilteredItems.length > 0 ? (
                                sortedAndFilteredItems.map((item) => (
                                    <TableRow
                                        key={item.id}
                                        className={`
                                            transition-colors hover:bg-muted/30 
                                            ${item.priority === 'Crítica' && item.status !== 'Completado' ? 'bg-destructive/10 border-l-2 border-l-destructive' : ''}
                                        `}
                                    >
                                        <TableCell className="font-medium text-foreground">
                                            {item.title}
                                            {item.priority === 'Crítica' && item.status !== 'Completado' && (
                                                <span className="ml-2 text-[10px] text-rose-600 font-bold px-1.5 py-0.5 bg-rose-100 rounded">URGENTE</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="font-normal text-slate-500">{item.type}</Badge>
                                        </TableCell>
                                        <TableCell className="text-sm">{item.assignee}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={`font-semibold ${getPriorityColor(item.priority)}`}>
                                                {item.priority}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <span className={`w-2 h-2 rounded-full ${getStatusColor(item.status).split(' ')[0]}`} />
                                                <span className="text-sm">{item.status}</span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center text-slate-500">
                                        No se encontraron resultados
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            ) : (
                <BacklogKanban items={sortedAndFilteredItems} />
            )}

            <div className="text-xs text-slate-400 text-right px-1">
                Mostrando {sortedAndFilteredItems.length} de {items.length} ítems
            </div>
        </div>
    );
}
