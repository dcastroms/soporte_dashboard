export type Priority = 'Baja' | 'Media' | 'Alta' | 'Crítica';
export type Status = 'Pendiente' | 'En Progreso' | 'Completado' | 'Activa' | 'Idea';
export type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';

export interface KPI {
  label: string;
  value: string | number;
  description: string;
  trend?: {
    value: number;
    isUp: boolean;
  };
}

export interface Goal {
  id: string;
  objective: string;
  quarter: Quarter;
  initiatives: {
    name: string;
    status: Status;
  }[];
}

export interface WeeklyUpdate {
  week: number;
  quarter: Quarter;
  done: string[];
  improved: string[];
  pending: string[];
  blockers: string[];
}

export interface BacklogItem {
  id: string;
  title: string;
  type: 'Proceso' | 'Bug' | 'Automatización' | 'Documentación';
  assignee: string;
  priority: Priority;
  status: Status;
}

export interface TeamLog {
  id: string;
  date: string;
  shift: 'Mañana' | 'Tarde' | 'Noche';
  person: string;
  event: string;
  type: 'Incidente' | 'Tarea' | 'Aprendizaje';
}

export interface Automation {
  id: string;
  name: string;
  process: string;
  status: Status;
  impact: string;
}
