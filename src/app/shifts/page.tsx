"use client";

import { useState, useEffect } from "react";
import { ShiftCalendar } from "@/components/dashboard/ShiftCalendar";
import { LiveWorkload } from "@/components/dashboard/LiveWorkload";
import { WelcomePanel } from "@/components/dashboard/WelcomePanel";
import { getSupportAssignments } from "@/lib/actions";
import { format, startOfWeek, endOfWeek, addDays } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { UploadShiftsDialog } from "@/components/dashboard/UploadShiftsDialog";

export default function ShiftsPage() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [assignments, setAssignments] = useState<any[]>([]);

    useEffect(() => {
        loadAssignments();
    }, [currentDate]);

    const loadAssignments = async () => {
        const start = format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
        const end = format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
        const assignmentsStr = await getSupportAssignments({ start, end });
        const mapped = assignmentsStr.map((a: any) => ({
            id: a.id,
            date: a.date,
            hour: a.hour,
            agentName: a.agentName
        }));
        setAssignments(mapped);
    };

    const startDate = startOfWeek(currentDate, { weekStartsOn: 1 });

    return (
        <div className="flex flex-col h-full gap-6">
            <div className="flex items-center justify-between flex-shrink-0">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Gestión de Turnos</h1>
                    <p className="text-muted-foreground text-sm">Planificación horaria del equipo de soporte 24/7.</p>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setCurrentDate(addDays(currentDate, -7))}>
                        <ChevronLeft size={16} />
                    </Button>
                    <span className="text-sm font-semibold min-w-[140px] text-center">
                        {format(startDate, 'dd MMM', { locale: es })} - {format(addDays(startDate, 6), 'dd MMM', { locale: es })}
                    </span>
                    <Button variant="outline" size="sm" onClick={() => setCurrentDate(addDays(currentDate, 7))}>
                        <ChevronRight size={16} />
                    </Button>
                    <div className="h-6 w-px bg-border mx-2" />
                    <UploadShiftsDialog />
                </div>
            </div>

            {/* Main layout: calendar + live workload sidebar */}
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
                <div className="min-h-0">
                    <ShiftCalendar
                        initialAssignments={assignments}
                        currentDate={currentDate}
                        onDateChange={setCurrentDate}
                    />
                </div>
                <div className="hidden lg:flex lg:flex-col gap-4">
                    <LiveWorkload saturationLimit={5} />
                    <WelcomePanel />
                </div>
            </div>
        </div>
    );
}
