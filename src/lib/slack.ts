export async function sendSlackNotification(event: {
    title: string;
    type: string;
    startDate: Date;
    endDate: Date;
    description?: string | null;
}, onShiftAgents?: string[]) {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;

    if (!webhookUrl) {
        console.warn("SLACK_WEBHOOK_URL is not defined. Skipping Slack notification.");
        return;
    }

    const typeColors: Record<string, string> = {
        'N3': '#dc2626', // Red
        'N2': '#ea580c', // Orange
        'N1': '#2563eb', // Blue
        'Diario': '#475569', // Slate
        'Other': '#6b7280' // Gray
    };

    const typeLabels: Record<string, string> = {
        'N3': 'Crítico (N3)',
        'N2': 'Alto (N2)',
        'N1': 'Normal (N1)',
        'Diario': 'Diario',
        'Other': 'Otro'
    };

    const typeIcons: Record<string, string> = {
        'N3': '🚨', // High/Critical
        'N2': '🔸', // Medium
        'N1': '🔹', // Low
        'Diario': '📅', // Daily
        'Other': 'ℹ️'
    };

    const color = typeColors[event.type] || '#6b7280';
    const label = typeLabels[event.type] || event.type;
    const icon = typeIcons[event.type] || '📢';

    const shortDate = (d: Date) => new Intl.DateTimeFormat('es-ES', { month: 'short', day: 'numeric' }).format(d);
    const shortTime = (d: Date) => new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(d);

    const dateStr = `${shortDate(event.startDate)} • ${shortTime(event.startDate)} - ${shortTime(event.endDate)}`;

    const onShiftText = (onShiftAgents && onShiftAgents.length > 0) 
        ? onShiftAgents.join(', ') // Simplest format: "Juan, Pedro"
        : "_Nadie asignado_";

    const payload = {
        attachments: [
            {
                color: color,
                blocks: [
                    {
                        type: "header",
                        text: {
                            type: "plain_text",
                            text: `${icon}  ${event.title}`,
                            emoji: true
                        }
                    },
                    {
                        type: "section",
                        fields: [
                            {
                                type: "mrkdwn",
                                text: `*Prioridad:*\n${label}`
                            },
                            {
                                type: "mrkdwn",
                                text: `*Horario:*\n${dateStr}`
                            }
                        ]
                    },
                    {
                         type: "section",
                         fields: [
                             {
                                 type: "mrkdwn",
                                 text: `*👷 En Turno:*\n${onShiftText}`
                             }
                         ]
                    },
                    ...(event.description ? [
                        { type: "divider" },
                        {
                            type: "section",
                            text: {
                                type: "mrkdwn",
                                text: `*📝 Detalles:*\n${event.description}`
                            }
                        }
                    ] : []),
                    {
                        type: "context",
                        elements: [
                            {
                                type: "mrkdwn",
                                text: "🔔 Notificación desde Dashboard de Soporte"
                            }
                        ]
                    }
                ]
            }
        ]
    };

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Slack API respondio con ${response.status}`);
        }
        console.log("Notificación enviada a Slack exitosamente.");
    } catch (error) {
        console.error("Error enviando notificación a Slack:", error);
    }
}

export async function sendStylePreview(event: any, onShiftAgents?: string[]) {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) return;

    const onShiftText = (onShiftAgents && onShiftAgents.length > 0) ? onShiftAgents.join(', ') : "_Nadie_";

    // --- STYLE 1: The current "Formal Card" ---
    const payload1 = {
        blocks: [
            { type: "header", text: { type: "plain_text", text: "Opción 1: Tarjeta Formal", emoji: true } },
            { type: "divider" }
        ],
        attachments: [{
            color: "#2563eb",
            blocks: [
                { type: "section", text: { type: "mrkdwn", text: `*${event.title}*` } },
                { type: "section", fields: [
                    { type: "mrkdwn", text: `*Prioridad:*\n${event.type}` },
                    { type: "mrkdwn", text: `*Turno:*\n${onShiftText}` }
                ]}
            ]
        }]
    };

    // --- STYLE 2: "Urgent Alert" (Yellow/Red background feel, mentions) ---
    const payload2 = {
        blocks: [
             { type: "header", text: { type: "plain_text", text: "Opción 2: Alerta Directa", emoji: true } },
             { type: "divider" },
             {
                 type: "section",
                 text: { type: "mrkdwn", text: `🚨 *ATENCIÓN:* Nuevo evento *${event.type}* registrado.\n\n👉 *${event.title}*\n🕐 _${new Date(event.startDate).toLocaleTimeString()}_\n\n👮‍♂️ *Responsables:* ${onShiftText}` }
             }
        ]
    };

    // --- STYLE 3: "Dashboard Action" (With Buttons) ---
    const payload3 = {
        blocks: [
            { type: "header", text: { type: "plain_text", text: "Opción 3: Interactiva", emoji: true } },
            { type: "divider" },
            {
                type: "section",
                text: { type: "mrkdwn", text: `🆕 *${event.title}*\n${event.description || "Sin descripción"}` },
                accessory: {
                    type: "button",
                    text: { type: "plain_text", text: "Ver en Dashboard", emoji: true },
                    url: "http://localhost:3000/events", // Replace with real URL in prod
                    action_id: "button_click"
                }
            },
            {
                type: "context",
                elements: [{ type: "mrkdwn", text: `👤 Turno: ${onShiftText}  |  📅 ${new Date(event.startDate).toLocaleDateString()}` }]
            }
        ]
    };

    // Send all 3
    await fetch(webhookUrl, { method: 'POST', body: JSON.stringify(payload1) });
    await new Promise(r => setTimeout(r, 500)); // gap
    await fetch(webhookUrl, { method: 'POST', body: JSON.stringify(payload2) });
    await new Promise(r => setTimeout(r, 500)); // gap
    await fetch(webhookUrl, { method: 'POST', body: JSON.stringify(payload3) });
}
