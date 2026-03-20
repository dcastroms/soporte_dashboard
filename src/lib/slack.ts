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

    const mention = process.env.SLACK_SOPORTETEAM_ID
        ? `<!subteam^${process.env.SLACK_SOPORTETEAM_ID}|@soporteteam>`
        : `@soporteteam`;

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
        text: mention,   // triggers the @soporteteam ping
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
                            { type: "mrkdwn", text: `*Prioridad:*\n${label}` },
                            { type: "mrkdwn", text: `*Horario:*\n${dateStr}` }
                        ]
                    },
                    {
                        type: "section",
                        fields: [
                            { type: "mrkdwn", text: `*👷 En Turno:*\n${onShiftText}` }
                        ]
                    },
                    ...(event.description ? [
                        { type: "divider" },
                        {
                            type: "section",
                            text: { type: "mrkdwn", text: `*📝 Detalles:*\n${event.description}` }
                        }
                    ] : []),
                    {
                        type: "context",
                        elements: [
                            { type: "mrkdwn", text: "🔔 Notificación desde Dashboard de Soporte" }
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

// mention: usa SLACK_SOPORTETEAM_ID si está disponible, si no @soporteteam como texto
function soporteMention(): string {
    const id = process.env.SLACK_SOPORTETEAM_ID;
    return id ? `<!subteam^${id}|@soporteteam>` : `@soporteteam`;
}

export async function sendStylePreview() {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) return;

    const appUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const mention = soporteMention();

    const fakeEvent = {
        title: "Caída parcial de servicios",
        type: "N3",
        startDate: new Date(),
        endDate: new Date(Date.now() + 2 * 3600000),
        description: "Se detectó latencia elevada en el cluster principal. Monitorear.",
    };

    const typeColors: Record<string, string> = { N3: '#dc2626', N2: '#ea580c', N1: '#2563eb', Diario: '#475569', Other: '#6b7280' };
    const typeLabels: Record<string, string> = { N3: 'Crítico (N3)', N2: 'Alto (N2)', N1: 'Normal (N1)', Diario: 'Diario', Other: 'Otro' };
    const typeIcons:  Record<string, string> = { N3: '🚨', N2: '🔸', N1: '🔹', Diario: '📅', Other: 'ℹ️' };

    const color  = typeColors[fakeEvent.type]  ?? '#6b7280';
    const label  = typeLabels[fakeEvent.type]  ?? fakeEvent.type;
    const icon   = typeIcons[fakeEvent.type]   ?? '📢';
    const fmt    = (d: Date) => new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
    const fmtDay = (d: Date) => new Intl.DateTimeFormat('es-CO', { weekday: 'short', day: 'numeric', month: 'short' }).format(d);

    // ── OPCIÓN A: Alerta compacta ─────────────────────────────────
    const payloadA = {
        text: `${mention} ${icon} Nuevo evento: *${fakeEvent.title}*`,
        attachments: [{
            color,
            blocks: [
                {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: `*${icon} ${fakeEvent.title}*\n${label}  ·  ${fmtDay(fakeEvent.startDate)}  ·  ${fmt(fakeEvent.startDate)} – ${fmt(fakeEvent.endDate)}`,
                    },
                },
                ...(fakeEvent.description ? [{
                    type: 'context',
                    elements: [{ type: 'mrkdwn', text: `📝 ${fakeEvent.description}` }],
                }] : []),
                {
                    type: 'context',
                    elements: [{ type: 'mrkdwn', text: `_Opción A · Alerta compacta_` }],
                },
            ],
        }],
    };

    // ── OPCIÓN B: Tarjeta operacional ─────────────────────────────
    const payloadB = {
        text: `${mention}`,
        attachments: [{
            color,
            blocks: [
                {
                    type: 'header',
                    text: { type: 'plain_text', text: `${icon}  ${fakeEvent.title}`, emoji: true },
                },
                {
                    type: 'section',
                    fields: [
                        { type: 'mrkdwn', text: `*Tipo*\n${label}` },
                        { type: 'mrkdwn', text: `*Fecha*\n${fmtDay(fakeEvent.startDate)}` },
                        { type: 'mrkdwn', text: `*Inicio*\n${fmt(fakeEvent.startDate)}` },
                        { type: 'mrkdwn', text: `*Fin*\n${fmt(fakeEvent.endDate)}` },
                    ],
                },
                ...(fakeEvent.description ? [{
                    type: 'section',
                    text: { type: 'mrkdwn', text: `> ${fakeEvent.description}` },
                }] : []),
                {
                    type: 'context',
                    elements: [{ type: 'mrkdwn', text: `_Opción B · Tarjeta operacional_` }],
                },
            ],
        }],
    };

    // ── OPCIÓN C: Alerta con botón al dashboard ───────────────────
    const payloadC = {
        text: `${mention}`,
        attachments: [{
            color,
            blocks: [
                {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: `${icon} *${label.toUpperCase()}* — ${fmtDay(fakeEvent.startDate)}\n\n*${fakeEvent.title}*\n${fakeEvent.description ? `_${fakeEvent.description}_` : ''}`,
                    },
                    accessory: {
                        type: 'button',
                        text: { type: 'plain_text', text: '🔗 Ver Eventos', emoji: true },
                        url: `${appUrl}/events`,
                        action_id: 'view_events',
                    },
                },
                {
                    type: 'context',
                    elements: [
                        { type: 'mrkdwn', text: `🕐 ${fmt(fakeEvent.startDate)} – ${fmt(fakeEvent.endDate)}` },
                        { type: 'mrkdwn', text: `_Opción C · Con botón al dashboard_` },
                    ],
                },
            ],
        }],
    };

    const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
    await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payloadA) });
    await delay(600);
    await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payloadB) });
    await delay(600);
    await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payloadC) });
}
