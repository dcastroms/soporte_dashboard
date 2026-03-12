import { KPI, Goal, WeeklyUpdate, BacklogItem, TeamLog, Automation } from '@/types/dashboard';

export const mockKPIs: KPI[] = [
  { label: 'Total Tickets (Semanal)', value: 1250, description: '+12% desde la semana pasada', trend: { value: 12, isUp: true } },
  { label: 'Tickets Repetidos', value: 84, description: '-5% desde la semana pasada', trend: { value: 5, isUp: false } },
  { label: 'Tickets Críticos', value: 12, description: '2 pendientes de desarrollo' },
  { label: 'Estado del Backlog', value: 'Alto', description: 'Requiere atención' },
];

export const mockGoals: Goal[] = [
  {
    id: '1',
    objective: 'Reducir tiempo de respuesta en un 20%',
    quarter: 'Q1',
    initiatives: [
      { name: 'Automatizar respuesta inicial', status: 'Completado' },
      { name: 'Actualización de Base de Conocimientos interna', status: 'En Progreso' },
      { name: 'Sesión de entrenamiento: Troubleshooting Avanzado', status: 'Pendiente' },
    ],
  },
  {
    id: '2',
    objective: 'Sistematizar Onboarding',
    quarter: 'Q1',
    initiatives: [
      { name: 'Crear checklist de onboarding', status: 'Completado' },
      { name: 'Grabar videos de entrenamiento', status: 'En Progreso' },
    ],
  },
];

export const mockWeeklyUpdates: WeeklyUpdate[] = [
  {
    week: 51,
    quarter: 'Q4',
    done: [
      'Resolución del 100% de tickets P1 en < 2h',
      'Actualización de documentación para API v2',
      'Refactorización de la estructura del centro de ayuda',
    ],
    improved: [
      'Tasa de autoservicio aumentada en un 15%',
      'Tiempo promedio de gestión reducido en 30s',
    ],
    pending: [
      'Onboarding para 2 nuevas contrataciones',
      'Pruebas de integración para nuevo CRM',
    ],
    blockers: [
      'Respuesta retrasada de DevOps sobre acceso a staging',
    ],
  },
];

export const mockBacklog: BacklogItem[] = [
  { id: '1', title: 'Macro para Restablecimiento de Contraseña', type: 'Automatización', assignee: 'Alex', priority: 'Alta', status: 'Pendiente' },
  { id: '2', title: 'Bug en herramienta interna rota', type: 'Bug', assignee: 'Maria', priority: 'Crítica', status: 'En Progreso' },
  { id: '3', title: 'Reorganización de la Wiki del equipo', type: 'Documentación', assignee: 'Sam', priority: 'Media', status: 'Pendiente' },
  { id: '4', title: 'Actualización del proceso de escalamiento', type: 'Proceso', assignee: 'Alex', priority: 'Baja', status: 'Completado' },
];

export const mockLogs: TeamLog[] = [
  {
    id: '1',
    date: '2023-12-21',
    shift: 'Mañana',
    person: 'Alex',
    event: 'Detectado pico en errores de login. Escalado a Ingeniería.',
    type: 'Incidente',
  },
  {
    id: '2',
    date: '2023-12-21',
    shift: 'Tarde',
    person: 'Maria',
    event: 'Finalizada la actualización de artículos de la KB de Q4.',
    type: 'Tarea',
  },
];

export const mockAutomations: Automation[] = [
  {
    id: '1',
    name: 'Auto-etiquetado',
    process: 'Categorización',
    status: 'Activa',
    impact: 'Ahorra 4 horas/semana por agente',
  },
  {
    id: '2',
    name: 'Predictor de Churn',
    process: 'Soporte Proactivo',
    status: 'En Progreso',
    impact: 'Reducción esperada del 10% en churn',
  },
];
