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
import { createTeamLog } from "@/lib/actions";
import { toast } from "sonner";
import { useSession } from "next-auth/react";

export function AddLogDialog() {
    const { data: session } = useSession();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);

        const formData = new FormData(e.currentTarget);
        const data = {
            date: new Date().toLocaleDateString(),
            shift: formData.get("shift") as string,
            person: session?.user?.name || "Usuario",
            event: formData.get("event") as string,
            type: formData.get("type") as string,
        };

        try {
            await createTeamLog(data);
            toast.success("Entrada agregada correctamente");
            setOpen(false);
        } catch (error) {
            toast.error("Error al agregar la entrada");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="gap-2">
                    <Plus size={18} />
                    Agregar Entrada
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Nueva Entrada en Bitácora</DialogTitle>
                        <DialogDescription>
                            Registra un evento o nota relevante para el turno actual.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="shift" className="text-right">
                                Turno
                            </Label>
                            <div className="col-span-3">
                                <Select name="shift" required defaultValue="Mañana">
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecciona turno" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Mañana">Mañana</SelectItem>
                                        <SelectItem value="Tarde">Tarde</SelectItem>
                                        <SelectItem value="Noche">Noche</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="type" className="text-right">
                                Tipo
                            </Label>
                            <div className="col-span-3">
                                <Select name="type" required defaultValue="Tarea">
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecciona tipo" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Incidente">Incidente</SelectItem>
                                        <SelectItem value="Tarea">Tarea</SelectItem>
                                        <SelectItem value="Aprendizaje">Aprendizaje</SelectItem>
                                        <SelectItem value="Alerta">Alerta</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-4 items-start gap-4">
                            <Label htmlFor="event" className="text-right mt-2">
                                Evento/Nota
                            </Label>
                            <Textarea
                                id="event"
                                name="event"
                                placeholder="Describe qué sucedió..."
                                className="col-span-3"
                                required
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={loading}>
                            {loading ? "Guardando..." : "Guardar Entrada"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
