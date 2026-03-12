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
import { createGoal } from "@/lib/actions";
import { toast } from "sonner";

export function AddGoalDialog() {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);

        const formData = new FormData(e.currentTarget);
        const data = {
            objective: formData.get("objective") as string,
            quarter: formData.get("quarter") as string,
        };

        try {
            await createGoal(data);
            toast.success("Meta trimestral creada");
            setOpen(false);
        } catch (error) {
            toast.error("Error al crear la meta");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="gap-2">
                    <Plus size={18} />
                    Nueva Meta
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Nueva Meta Estratégica</DialogTitle>
                        <DialogDescription>
                            Define un nuevo objetivo para el roadmap trimestral.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="objective" className="text-right">Objetivo</Label>
                            <Input id="objective" name="objective" className="col-span-3" placeholder="Ej: Reducir TR medio en 20%" required />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="quarter" className="text-right">Trimestre</Label>
                            <div className="col-span-3">
                                <Select name="quarter" required defaultValue="Q1">
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecciona trimestre" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Q1">Q1 - 2024</SelectItem>
                                        <SelectItem value="Q2">Q2 - 2024</SelectItem>
                                        <SelectItem value="Q3">Q3 - 2024</SelectItem>
                                        <SelectItem value="Q4">Q4 - 2024</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={loading}>
                            {loading ? "Crear Meta" : "Crear Meta"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
