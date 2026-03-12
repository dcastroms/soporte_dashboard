"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X, Filter } from "lucide-react";

interface ReportFilterProps {
    agents: { intercomId: string; name: string }[];
    categories: { category: string; value: string }[];
}

export function ReportFilters({ agents, categories }: ReportFilterProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    // Extract unique categories for better UX
    const uniqueClients = Array.from(new Set(categories.filter(c => c.category === 'Client').map(c => c.value))).sort();
    const uniqueModules = Array.from(new Set(categories.filter(c => c.category === 'Module').map(c => c.value))).sort();

    // State
    const [agentId, setAgentId] = useState(searchParams.get("agentId") || "all");
    const [category, setCategory] = useState(searchParams.get("category") || "all");

    // Sync state with URL params on load/change
    useEffect(() => {
        setAgentId(searchParams.get("agentId") || "all");
        setCategory(searchParams.get("category") || "all");
    }, [searchParams]);

    const updateParams = (key: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value && value !== 'all') {
            params.set(key, value);
        } else {
            params.delete(key);
        }
        router.push(`/reports?${params.toString()}`);
    };

    const clearFilters = () => {
        const params = new URLSearchParams(searchParams.toString());
        params.delete("agentId");
        params.delete("category");
        router.push(`/reports?${params.toString()}`);
    };

    const hasFilters = agentId !== 'all' || category !== 'all';

    return (
        <div className="flex items-center gap-2 bg-white p-2 rounded-lg border shadow-sm">
            <Filter size={16} className="text-slate-400 ml-2" />

            <Select value={agentId} onValueChange={(val) => updateParams("agentId", val)}>
                <SelectTrigger className="w-[180px] h-9 border-none bg-transparent hover:bg-slate-50">
                    <SelectValue placeholder="Agente" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Todos los agentes</SelectItem>
                    {agents.map((agent) => (
                        <SelectItem key={agent.intercomId} value={agent.intercomId}>
                            {agent.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <div className="w-[1px] h-6 bg-slate-200" />

            <Select value={category} onValueChange={(val) => updateParams("category", val)}>
                <SelectTrigger className="w-[180px] h-9 border-none bg-transparent hover:bg-slate-50">
                    <SelectValue placeholder="Categoría / Módulo" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Todas las categorías</SelectItem>
                    {uniqueModules.length > 0 && <div className="px-2 py-1.5 text-xs font-semibold text-slate-400 uppercase">Módulos</div>}
                    {uniqueModules.map((c) => (
                        <SelectItem key={`mod-${c}`} value={c}>{c}</SelectItem>
                    ))}

                    {uniqueClients.length > 0 && <div className="px-2 py-1.5 text-xs font-semibold text-slate-400 uppercase mt-2">Clientes</div>}
                    {uniqueClients.map((c) => (
                        <SelectItem key={`client-${c}`} value={c}>{c}</SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {hasFilters && (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="h-8 w-8 p-0 text-slate-400 hover:text-rose-500 rounded-full"
                    title="Limpiar filtros"
                >
                    <X size={16} />
                </Button>
            )}
        </div>
    );
}
