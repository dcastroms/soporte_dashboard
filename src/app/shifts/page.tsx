import { ShiftCalendar } from "@/components/dashboard/ShiftCalendar";
import { getSupportAssignments } from "@/lib/actions";
import { format, startOfWeek, endOfWeek } from "date-fns";

export default async function ShiftsPage() {
  const today = new Date();
  const start = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const end = format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');

  const raw = await getSupportAssignments({ start, end });
  const assignments = raw.map((a: any) => ({
    id: a.id,
    date: a.date,
    hour: a.hour,
    agentName: a.agentName,
  }));

  return (
    <div className="flex flex-col h-full gap-2">
      <div className="flex-shrink-0">
        <h1 className="page-title">Gestión de Turnos</h1>
        <p className="page-subtitle">Planificación horaria del equipo de soporte 24/7.</p>
      </div>
      <div className="flex-1 min-h-0">
        <ShiftCalendar initialAssignments={assignments} />
      </div>
    </div>
  );
}
