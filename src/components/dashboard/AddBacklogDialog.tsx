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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { createBacklogItem } from "@/lib/actions";
import { toast } from "sonner";

export function AddBacklogDialog() {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);

        const formData = new FormData(e.currentTarget);
        const data = {
            title: formData.get("title") as string,
            type: formData.get("type") as string,
            assignee: formData.get("assignee") as string,
            priority: formData.get("priority") as string,
            status: "Pendiente",
        };

        try {
            await createBacklogItem(data);
            toast.success("Ítem agregado al backlog");
            setOpen(false);
        } catch (error) {
            toast.error("Error al agregar ítem");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="gap-2">
                    <Plus size={18} />
                    Nuevo Ítem
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Nuevo Ítem de Backlog</DialogTitle>
                        <DialogDescription>
                            Agrega una mejora o tarea técnica al backlog operativo.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="title" className="text-right">Título</Label>
                            <Input id="title" name="title" className="col-span-3" required />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="type" className="text-right">Tipo</Label>
                            <div className="col-span-3">
                                <Select name="type" required defaultValue="Automatización">
                                    <SelectTrigger>
                                        <SelectValue placeholder="Tipo de tarea" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Proceso">Proceso</SelectItem>
                                        <SelectItem value="Bug">Bug</SelectItem>
                                        <SelectItem value="Automatización">Automatización</SelectItem>
                                        <SelectItem value="Documentación">Documentación</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="assignee" className="text-right">Responsable</Label>
                            <Input id="assignee" name="assignee" className="col-span-3" required />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="priority" className="text-right">Prioridad</Label>
                            <div className="col-span-3">
                                <Select name="priority" required defaultValue="Media">
                                    <SelectTrigger>
                                        <SelectValue placeholder="Nivel de prioridad" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Baja">Baja</SelectItem>
                                        <SelectItem value="Media">Media</SelectItem>
                                        <SelectItem value="Alta">Alta</SelectItem>
                                        <SelectItem value="Crítica">Crítica</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={loading}>
                            {loading ? "Guardando..." : "Guardar Ítem"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
