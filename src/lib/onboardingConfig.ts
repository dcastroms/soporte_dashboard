/**
 * onboardingConfig.ts
 * Centralized help texts for tooltips, empty states, and onboarding guidance.
 * All strings are in Spanish to match the Soporte 360 dashboard language.
 */

export const KPI_HELP = {
  frt: {
    title: "FRT — First Response Time",
    what: "Tiempo desde que el cliente escribe hasta que un agente responde por primera vez.",
    why: "Un FRT bajo mejora la percepción de marca y reduce el churn. Clientes con respuesta en < 5 min tienen 2× más probabilidad de renovar.",
    goal: "Meta operativa: < 5 minutos",
    alert: "Si supera 10 min, el ticket debe escalarse de inmediato.",
  },
  ttr: {
    title: "TTR — Time To Resolve",
    what: "Tiempo total desde la apertura del ticket hasta su cierre definitivo.",
    why: "Indica la eficiencia real del equipo. Un TTR alto con FRT bajo revela cuellos de botella en resolución, no en respuesta.",
    goal: "Meta operativa: < 24 horas para issues técnicos",
    alert: "Tickets sin cierre en +48h deben escalar a líder de soporte.",
  },
  csat: {
    title: "CSAT — Customer Satisfaction",
    what: "Calificación promedio que los clientes otorgan al finalizar la conversación (escala 1–5).",
    why: "Es tu principal indicador de éxito ante la gerencia. Por debajo del 90% es señal de alerta temprana de churn.",
    goal: "Meta operativa: ≥ 90% (equivale a 4.5/5 en Intercom)",
    alert: "Si cae a < 80%, se debe revisar calidad de respuestas del turno.",
  },
  fcr: {
    title: "FCR — First Contact Resolution",
    what: "Porcentaje de tickets resueltos en el primer contacto, sin requerir seguimiento.",
    why: "Un FCR alto reduce la carga total del equipo. Cada ticket que requiere seguimiento duplica el tiempo invertido.",
    goal: "Meta operativa: > 70%",
    alert: "FCR bajo puede indicar documentación insuficiente o escalamiento prematuro.",
  },
  sla: {
    title: "SLA — Service Level Agreement",
    what: "Porcentaje de tickets que cumplen con los tiempos de respuesta pactados con el cliente.",
    why: "El SLA es un compromiso contractual. Incumplirlo puede tener consecuencias comerciales directas con clientes Enterprise.",
    goal: "Meta operativa: ≥ 95%",
    alert: "Si cae a < 90%, notificar al lider de soporte en el mismo turno.",
  },
  volume: {
    title: "Volumen de Tickets",
    what: "Total de conversaciones únicas recibidas en el período seleccionado.",
    why: "Un aumento súbito (>40% vs semana anterior) puede indicar un incidente activo. Es la primera señal de alerta operativa.",
    goal: "Baseline: monitorea picos vs. promedio histórico",
    alert: "Si el volumen sube de golpe, revisar el mapa de calor para identificar la fuente.",
  },
} as const;

export const EMPTY_STATES = {
  handoverHistory: {
    icon: "📭",
    title: "Sin entregas registradas",
    message: "Cuando completes tu primera entrega de turno, aparecerá aquí con todos los detalles.",
    action: "El botón 'Entregar Turno' aparece automáticamente cuando se acerca el fin de tu turno.",
  },
  events: {
    icon: "📅",
    title: "Sin eventos críticos hoy",
    message: "¡El equipo opera en condiciones normales! Programa eventos como partidos o mantenimientos para activar el Modo Alta Demanda.",
    action: "Haz clic en '+ Nuevo Evento' para programar el próximo partido o mantenimiento.",
  },
  liveWorkload: {
    icon: "✅",
    title: "¡Sin tickets abiertos ahora!",
    message: "El equipo está al día. Aprovecha para revisar el backlog, documentar o preparar el handover del turno.",
    action: "Consulta el historial de handovers para revisar qué quedó pendiente del turno anterior.",
  },
  shiftCalendar: {
    icon: "🗓️",
    title: "Sin turnos esta semana",
    message: "El calendario está vacío. Asigna turnos para asegurar cobertura 24/7.",
    action: "Arrastra y suelta para asignar horarios, o importa un CSV con la planilla del equipo.",
  },
} as const;

export const SHIFT_START_GUIDE = [
  {
    step: 1,
    icon: "✅",
    title: "Check-in de Turno",
    detail: "Confirma tu inicio de turno en el calendario. Esto notifica al equipo que estás disponible y activa el monitoreo de tu carga.",
  },
  {
    step: 2,
    icon: "⚡",
    title: "Revisar Eventos Críticos",
    detail: "Verifica si hay partidos, lanzamientos o mantenimientos activos hoy. Un evento activo pone al equipo en Modo Alta Demanda.",
  },
  {
    step: 3,
    icon: "📊",
    title: "Live Workload",
    detail: "Revisa tickets abiertos y asegúrate de que ningún agente esté sobrecargado. Si ves rojo, redistribuye antes de que el cliente lo sienta.",
  },
];

export const INCIDENT_PROTOCOL = [
  {
    step: 1,
    action: "Identifica y documenta",
    detail: "Anota el ID del ticket, cliente afectado, hora de inicio y síntoma exacto en el campo 'Incidentes' del Handover.",
  },
  {
    step: 2,
    action: "Evalúa el impacto",
    detail: "¿Afecta a 1 cliente o a múltiples? ¿Es un cliente Enterprise/VIP? Si es masivo o VIP, escala inmediatamente a N3.",
  },
  {
    step: 3,
    action: "Comunica y escala si es necesario",
    detail: "Informa al cliente en < 5 min (aunque no tengas solución). Actualiza el estado del dashboard a Rojo. Notifica al jefe de turno.",
  },
];
