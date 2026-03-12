"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Plus, X } from "lucide-react";
import { createWeeklyUpdate } from "@/lib/actions";
import { toast } from "sonner";

export function AddWeeklyUpdateDialog() {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    // Lists for the 4 sections
    const [done, setDone] = useState<string[]>([]);
    const [improved, setImproved] = useState<string[]>([]);
    const [pending, setPending] = useState<string[]>([]);
    const [blockers, setBlockers] = useState<string[]>([]);

    const addField = (list: string[], setList: (l: string[]) => void, value: string) => {
        if (!value.trim()) return;
        setList([...list, value]);
    };

    const removeField = (list: string[], setList: (l: string[]) => void, index: number) => {
        setList(list.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (done.length === 0 && improved.length === 0 && pending.length === 0 && blockers.length === 0) {
            toast.error("Agrega al menos un ítem");
            return;
        }

        setLoading(true);
        const formData = new FormData(e.currentTarget);
        const data = {
            week: parseInt(formData.get("week") as string),
            quarter: formData.get("quarter") as string,
            done,
            improved,
            pending,
            blockers,
        };

        try {
            await createWeeklyUpdate(data);
            toast.success("Seguimiento semanal guardado");
            setOpen(false);
            setDone([]); setImproved([]); setPending([]); setBlockers([]);
        } catch (error) {
            toast.error("Error al guardar");
        } finally {
            setLoading(false);
        }
    };

    const ListEditor = ({ label, items, setItems, placeholder }: any) => {
        const [val, setVal] = useState("");
        return (
            <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-slate-500">{label}</Label>
                <div className="flex gap-2">
                    <Input
                        value={val}
                        onChange={(e) => setVal(e.target.value)}
                        placeholder={placeholder}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                addField(items, setItems, val);
                                setVal("");
                            }
                        }}
                    />
                    <Button type="button" size="icon" variant="outline" onClick={() => {
                        addField(items, setItems, val);
                        setVal("");
                    }}>
                        <Plus size={16} />
                    </Button>
                </div>
                <ul className="space-y-1">
                    {items.map((item: string, i: number) => (
                        <li key={i} className="flex items-center justify-between bg-slate-50 px-2 py-1 rounded text-sm border">
                            {item}
                            <button type="button" onClick={() => removeField(items, setItems, i)}>
                                <X size={14} className="text-slate-400 hover:text-rose-500" />
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
        );
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="gap-2">
                    <Plus size={18} />
                    Nuevo Seguimiento
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Seguimiento Semanal</DialogTitle>
                        <DialogDescription>
                            Resume los logros, mejoras y bloqueos de la semana actual.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-6 py-4">
                        <div className="flex gap-4">
                            <div className="flex-1 space-y-2">
                                <Label htmlFor="week">Semana #</Label>
                                <Input id="week" name="week" type="number" defaultValue={new Date().getMonth() * 4 + 1} required />
                            </div>
                            <div className="flex-1 space-y-2">
                                <Label htmlFor="quarter">Trimestre</Label>
                                <Select name="quarter" defaultValue="Q1">
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Q1">Q1</SelectItem>
                                        <SelectItem value="Q2">Q2</SelectItem>
                                        <SelectItem value="Q3">Q3</SelectItem>
                                        <SelectItem value="Q4">Q4</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <ListEditor label="Logros" items={done} setItems={setDone} placeholder="Ej: Nueva doc..." />
                            <ListEditor label="Mejoras" items={improved} setItems={setImproved} placeholder="Ej: Proceso X..." />
                            <ListEditor label="Pendiente" items={pending} setItems={setPending} placeholder="Ej: Ticket Y..." />
                            <ListEditor label="Bloqueos" items={blockers} setItems={setBlockers} placeholder="Ej: Acceso Z..." />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={loading} className="w-full">
                            {loading ? "Guardando..." : "Guardar Seguimiento Semanal"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
