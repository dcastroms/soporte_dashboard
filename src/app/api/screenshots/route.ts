import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { imageBase64, weekLabel } = await req.json();

        // base64 → buffer
        const base64Data = imageBase64.replace(/^data:image\/png;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        // Save to public/screenshots/
        const filename = `shifts-${randomUUID()}.png`;
        const filePath = join(process.cwd(), 'public', 'screenshots', filename);
        await writeFile(filePath, buffer);

        // Public URL
        const appUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
        const imageUrl = `${appUrl}/screenshots/${filename}`;

        // Post to Slack webhook
        const webhookUrl = process.env.SLACK_WEBHOOK_URL;
        if (webhookUrl) {
            const payload = {
                blocks: [
                    {
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: `📅 *Turnos ${weekLabel || ''}*\nScreenshot del calendario de turnos`,
                        },
                    },
                    {
                        type: 'image',
                        image_url: imageUrl,
                        alt_text: `Turnos ${weekLabel || ''}`,
                    },
                    {
                        type: 'context',
                        elements: [
                            {
                                type: 'mrkdwn',
                                text: `Enviado por *${session.user?.name || 'Dashboard'}*`,
                            },
                        ],
                    },
                ],
            };

            const res = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                console.error('[screenshot] Slack webhook error:', res.status);
            }
        }

        return NextResponse.json({ ok: true, imageUrl });
    } catch (err) {
        console.error('[screenshot] error:', err);
        return NextResponse.json({ error: 'Error saving screenshot' }, { status: 500 });
    }
}
