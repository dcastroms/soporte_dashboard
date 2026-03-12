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
import { Plus } from "lucide-react";
import { createAutomation } from "@/lib/actions";
import { toast } from "sonner";

export function AddAutomationDialog() {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);

        const formData = new FormData(e.currentTarget);
        const data = {
            name: formData.get("name") as string,
            process: formData.get("process") as string,
            status: formData.get("status") as string,
            impact: formData.get("impact") as string,
        };

        try {
            await createAutomation(data);
            toast.success("Automatización registrada");
            setOpen(false);
        } catch (error) {
            toast.error("Error al registrar automatización");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="gap-2">
                    <Plus size={18} />
                    Registrar Automatización
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Nueva Automatización</DialogTitle>
                        <DialogDescription>
                            Registra una nueva herramienta o proceso automatizado en el inventario.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">Nombre</Label>
                            <Input id="name" name="name" className="col-span-3" placeholder="Ej: Bot de Slack" required />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="process" className="text-right">Proceso</Label>
                            <Input id="process" name="process" className="col-span-3" placeholder="Ej: Gestión de Guardias" required />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="status" className="text-right">Estado</Label>
                            <div className="col-span-3">
                                <Select name="status" required defaultValue="Idea">
                                    <SelectTrigger>
                                        <SelectValue placeholder="Estado actual" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Activa">Activa</SelectItem>
                                        <SelectItem value="En Progreso">En Progreso</SelectItem>
                                        <SelectItem value="Idea">Idea</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-4 items-start gap-4">
                            <Label htmlFor="impact" className="text-right mt-2">Impacto</Label>
                            <Textarea
                                id="impact"
                                name="impact"
                                placeholder="Describe el beneficio (ej: ahorro de 5h semanales)"
                                className="col-span-3"
                                required
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={loading}>
                            {loading ? "Guardando..." : "Guardar Automatización"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
