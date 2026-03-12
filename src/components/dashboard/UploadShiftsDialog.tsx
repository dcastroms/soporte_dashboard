"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import Papa from 'papaparse';
import { saveSupportAssignment } from '@/lib/actions';
import { toast } from 'sonner';

export function UploadShiftsDialog() {
    const [open, setOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [file, setFile] = useState<File | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFile(e.target.files[0]);
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        setIsUploading(true);
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const data = results.data as any[];
                let successCount = 0;
                let errorCount = 0;

                try {
                    for (const row of data) {
                        // Esperamos columnas: Date (YYYY-MM-DD), Hour (0-23), AgentName
                        const { Date, Hour, AgentName } = row;

                        if (Date && Hour && AgentName) {
                            await saveSupportAssignment({
                                date: Date.trim(),
                                hour: parseInt(Hour),
                                agentName: AgentName.trim()
                            });
                            successCount++;
                        } else {
                            errorCount++;
                        }
                    }

                    toast.success(`Carga completa: ${successCount} turnos asignados.`);
                    if (errorCount > 0) {
                        toast.warning(`${errorCount} filas ignoradas por formato incorrecto.`);
                    }
                    setOpen(false);
                    setFile(null);
                    window.location.reload(); // Refrescar para ver cambios
                } catch (error) {
                    console.error("Error saving shifts:", error);
                    toast.error("Error al guardar los turnos en la base de datos.");
                } finally {
                    setIsUploading(false);
                }
            },
            error: (err) => {
                console.error("CSV Parse error:", err);
                toast.error("Error al leer el archivo CSV.");
                setIsUploading(false);
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="w-full text-xs gap-2 border-border hover:bg-muted/50">
                    <Upload size={14} /> Subir CSV
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Subir Turnos del Equipo</DialogTitle>
                    <DialogDescription>
                        Sube un archivo CSV con las asignaciones horarias.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="p-3 bg-blue-50/50 dark:bg-blue-950/30 rounded-lg border border-blue-100 dark:border-blue-900/50 space-y-3">
                        <div className="p-2 border border-orange-200 dark:border-orange-900/50 bg-orange-50 dark:bg-orange-950/30 rounded text-[10px] text-orange-700 dark:text-orange-400 flex items-center gap-2 font-semibold">
                            <FileText size={14} /> FORMATO REQUERIDO:
                        </div>
                        <code className="text-[10px] block bg-white dark:bg-slate-900 p-2 border border-orange-200 dark:border-orange-900/50 rounded">
                            Date,Hour,AgentName<br />
                            2025-12-24,08,Daniel Romero<br />
                            2025-12-24,09,Daniel Romero
                        </code>
                        <p className="text-[10px] text-blue-700 dark:text-blue-400 leading-normal">
                            * Date: YYYY-MM-DD | Hour: 0-23
                        </p>
                    </div>

                    <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-lg p-6 hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                        <input
                            type="file"
                            id="csv-upload"
                            className="hidden"
                            accept=".csv"
                            onChange={handleFileChange}
                        />
                        <label htmlFor="csv-upload" className="cursor-pointer flex flex-col items-center gap-2 text-sm text-slate-600">
                            {file ? (
                                <>
                                    <CheckCircle2 size={32} className="text-emerald-500" />
                                    <span className="font-medium">{file.name}</span>
                                    <span className="text-xs text-slate-400">Click para cambiar archivo</span>
                                </>
                            ) : (
                                <>
                                    <Upload size={32} className="text-slate-400" />
                                    <span>Haz click para seleccionar archivo CSV</span>
                                </>
                            )}
                        </label>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={isUploading}>
                        Cancelar
                    </Button>
                    <Button onClick={handleUpload} disabled={!file || isUploading}>
                        {isUploading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Subiendo...
                            </>
                        ) : (
                            'Confirmar Carga'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
