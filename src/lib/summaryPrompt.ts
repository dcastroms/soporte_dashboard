import { AIMessage } from "@/lib/aiProvider";
import { ChatMessage } from "@/types/chat";
import { stripHtml } from "@/lib/utils";

export interface AuditTicketInput {
  subject: string | null;
  status: string | null;
  priority: string | null;
  client: string | null;
  module: string | null;
  ticketType: string | null;
  teammateName: string | null;
  staleHours: number;
  /** Primeros mensajes de la conversación para enriquecer contexto cuando los metadatos son escasos */
  firstMessages?: { role: string; body: string }[];
}

export interface ChatTicketInput {
  subject: string | null;
  status: string | null;
  priority: string | null;
  client: string | null;
  module: string | null;
  ticketType: string | null;
  teammateName: string | null;
}

export function buildAuditSummaryMessages(ticket: AuditTicketInput): AIMessage[] {
  const f = (v: string | null | undefined, fallback = "no especificado") => v?.trim() || fallback;

  const lines = [
    `Asunto: ${f(ticket.subject)}`,
    `Estado: ${f(ticket.status)}`,
    `Prioridad: ${f(ticket.priority, "normal")}`,
    `Cliente: ${f(ticket.client)}`,
    `Módulo/Producto: ${f(ticket.module)}`,
    `Tipo de ticket: ${f(ticket.ticketType)}`,
    `Agente asignado: ${f(ticket.teammateName, "sin asignar")}`,
    `Horas desde última actualización: ${ticket.staleHours}h`,
  ];

  return [
    {
      role: "system",
      content:
        "Eres un analista de soporte técnico B2B. Tu trabajo es leer metadatos de tickets y producir un análisis conciso y accionable. " +
        "Responde ÚNICAMENTE con un objeto JSON válido. Sin markdown, sin texto extra, sin comillas externas.",
    },
    {
      role: "user",
      content:
        `Analiza este ticket y responde con JSON que tenga EXACTAMENTE estos 3 campos (usa los datos reales que aparecen abajo, no inventes):\n\n` +
        `{\n` +
        `  "urgency": "<nivel> — <motivo concreto basado en las horas sin respuesta y prioridad>",\n` +
        `  "problem": "<qué está fallando o pidiendo el cliente, basado en el asunto y tipo>",\n` +
        `  "action": "<próximo paso específico para el agente, considerando estado y agente asignado>"\n` +
        `}\n\n` +
        `DATOS DEL TICKET:\n${lines.join("\n")}\n\n` +
        (ticket.firstMessages?.length
          ? `PRIMEROS MENSAJES DE LA CONVERSACIÓN:\n${ticket.firstMessages.map((m) => `[${m.role}]: ${m.body}`).join("\n")}\n\n`
          : "") +
        `INSTRUCCIÓN: Usa los datos de arriba. Si un campo dice "no especificado", extrae la información de los mensajes. No des respuestas genéricas.`,
    },
  ];
}

export function buildChatSummaryMessages(ticket: ChatTicketInput, messages: ChatMessage[]): AIMessage[] {
  const f = (v: string | null | undefined, fallback = "no especificado") => v?.trim() || fallback;

  const lines = [
    `Asunto: ${f(ticket.subject)}`,
    `Estado: ${f(ticket.status)}`,
    `Prioridad: ${f(ticket.priority, "normal")}`,
    `Cliente: ${f(ticket.client)}`,
    `Módulo/Producto: ${f(ticket.module)}`,
    `Tipo de ticket: ${f(ticket.ticketType)}`,
    `Agente asignado: ${f(ticket.teammateName, "sin asignar")}`,
  ];

  const messageLines = messages
    .map((m) => {
      const body = stripHtml(m.body).trim();
      if (!body) return null;
      const role = m.isNote
        ? `[NOTA INTERNA — ${m.author}]`
        : m.authorType === "admin"
        ? `[Agente — ${m.author}]`
        : `[Cliente — ${m.author}]`;
      return `${role}: ${body}`;
    })
    .filter(Boolean);

  return [
    {
      role: "system",
      content:
        "Eres un analista de soporte técnico B2B. Tu trabajo es leer conversaciones de soporte y producir un resumen preciso y accionable. " +
        "Responde ÚNICAMENTE con un objeto JSON válido. Sin markdown, sin texto extra, sin comillas externas.",
    },
    {
      role: "user",
      content:
        `Lee el historial de esta conversación de soporte y responde con JSON que tenga EXACTAMENTE estos 4 campos:\n\n` +
        `{\n` +
        `  "problem": "<descripción específica del problema, extraída de los mensajes del cliente>",\n` +
        `  "context": "<quién es el cliente, qué producto/módulo afecta, hace cuánto ocurre, según los mensajes>",\n` +
        `  "attempts": "<qué se intentó hasta ahora según el historial, o 'Ninguna documentada'>",\n` +
        `  "action": "<próxima acción concreta y específica que debe tomar el agente>"\n` +
        `}\n\n` +
        `METADATOS DEL TICKET:\n${lines.join("\n")}\n\n` +
        `HISTORIAL DE CONVERSACIÓN (${messageLines.length} mensajes, del más antiguo al más reciente):\n${messageLines.join("\n")}\n\n` +
        `INSTRUCCIÓN: Extrae información literal de los mensajes. Sé específico con nombres, errores, fechas o pasos mencionados. No des respuestas genéricas.`,
    },
  ];
}
