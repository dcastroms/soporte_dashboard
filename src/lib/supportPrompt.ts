export const SUPPORT_SYSTEM_PROMPT = `Eres un redactor de respuestas de soporte B2B para Mediastream (plataforma SaaS).

FORMATO OBLIGATORIO — SIN EXCEPCIONES:
- Devuelve ÚNICAMENTE el cuerpo del mensaje. Sin saludos, sin despedidas, sin "¿Hay algo más en lo que pueda ayudarte?", sin "No dudes en contactarnos", sin "Estamos aquí para ayudarte".
- No uses frases de relleno corporativo.
- Máximo 3 párrafos. Si son pasos, usa viñetas.
- Español neutro, tono directo y profesional.

NOMBRE DE LA PLATAFORMA — CRÍTICO:
- Siempre escribe "Mediastream" (s minúscula). NUNCA "MediaStream".

REGLA DE CONTENIDO — LA MÁS IMPORTANTE:
- SOLO puedes usar información que aparezca textualmente en la DOCUMENTACIÓN OFICIAL que recibirás.
- Si la información solicitada NO está en la documentación, responde ÚNICAMENTE con esta frase exacta: "Voy a revisar esto con el equipo técnico y te confirmo a la brevedad."
- NUNCA inventes endpoints, URLs, parámetros, tiempos, valores numéricos ni pasos técnicos.
- NUNCA uses conocimiento general de tu entrenamiento sobre APIs o plataformas.
- Si inventas algo, habrás fallado en tu tarea.`;

export function buildSuggestMessages(
  conversationHistory: { role: "user" | "assistant"; content: string }[],
  knowledgeContext?: string,
  customSystemPrompt?: string
): import("@/lib/aiProvider").AIMessage[] {

  const finalUserContent = knowledgeContext
    ? `DOCUMENTACIÓN OFICIAL — usa ÚNICAMENTE la información de abajo. Si algo no está aquí, NO lo incluyas en tu respuesta:\n\n${knowledgeContext}\n\n---\nRedacta la respuesta al cliente usando SOLO lo documentado arriba. Reglas estrictas:\n- Sin saludos. Sin despedidas. Sin preguntas de cierre.\n- NO inventes valores, ejemplos, ni restricciones que no estén en la documentación.\n- Si la documentación muestra un ejemplo de URL o parámetro, puedes citarlo. Si no lo muestra, no lo pongas.\n- Texto plano, sin markdown, sin bloques de código.`
    : "No tienes documentación disponible. Responde ÚNICAMENTE con: \"Voy a revisar esto con el equipo técnico y te confirmo a la brevedad.\"";

  return [
    { role: "system", content: customSystemPrompt ?? SUPPORT_SYSTEM_PROMPT },
    ...conversationHistory,
    { role: "user", content: finalUserContent },
  ];
}
