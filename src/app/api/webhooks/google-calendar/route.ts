import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { sseSubscribers } from "@/lib/sseRegistry";

/**
 * POST /api/webhooks/google-calendar
 *
 * Google sends a notification (ping) to this URL when a watched calendar changes.
 * We read the changes via the Calendar API and broadcast new events via SSE.
 *
 * Setup steps (one-time):
 * 1. Call GET /api/webhooks/google-calendar/watch to register the watch channel.
 * 2. Google will POST to this endpoint on every calendar change.
 *
 * Required env vars:
 * - GOOGLE_CLIENT_ID
 * - GOOGLE_CLIENT_SECRET
 * - GOOGLE_REFRESH_TOKEN  (from OAuth2 playground for the service account)
 * - GOOGLE_CALENDAR_ID    (e.g. "your@email.com" or a specific calendar ID)
 */

function getCalendarClient() {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return google.calendar({ version: "v3", auth });
}

// Store the last sync token in memory (use DB in production for multi-instance)
let syncToken: string | null = null;

export async function POST(req: NextRequest) {
  // Google sends X-Goog-Resource-State: "sync" for the initial watch confirmation
  const resourceState = req.headers.get("x-goog-resource-state");
  if (resourceState === "sync") {
    return new NextResponse(null, { status: 200 });
  }

  try {
    const calendar = getCalendarClient();
    const calendarId = process.env.GOOGLE_CALENDAR_ID || "primary";

    const params: any = { calendarId, singleEvents: true };
    if (syncToken) params.syncToken = syncToken;
    else params.timeMin = new Date().toISOString();

    const response = await calendar.events.list(params);
    const events = response.data.items || [];
    syncToken = response.data.nextSyncToken || null;

    // Filter for newly created high-demand events
    const newEvents = events.filter(
      (e) => e.status !== "cancelled" && e.created && e.summary
    );

    for (const event of newEvents) {
      const payload = `event: new_calendar_event\ndata: ${JSON.stringify({
        id: event.id,
        title: event.summary,
        start: event.start?.dateTime || event.start?.date,
        end: event.end?.dateTime || event.end?.date,
        description: event.description,
        timestamp: new Date().toISOString(),
      })}\n\n`;

      for (const ctrl of sseSubscribers) {
        try {
          ctrl.enqueue(new TextEncoder().encode(payload));
        } catch {
          sseSubscribers.delete(ctrl);
        }
      }
    }

    return new NextResponse(null, { status: 200 });
  } catch (error) {
    console.error("[Google Calendar Webhook] Error:", error);
    return new NextResponse(null, { status: 500 });
  }
}

/**
 * GET /api/webhooks/google-calendar/watch
 * Call this endpoint once to register the Google Calendar push watch.
 * The watch expires after ~7 days and must be renewed.
 */
export async function GET(req: NextRequest) {
  try {
    const calendar = getCalendarClient();
    const calendarId = process.env.GOOGLE_CALENDAR_ID || "primary";
    const webhookUrl = `${process.env.NEXTAUTH_URL}/api/webhooks/google-calendar`;

    const response = await calendar.events.watch({
      calendarId,
      requestBody: {
        id: `soporte360-watch-${Date.now()}`,
        type: "web_hook",
        address: webhookUrl,
        expiration: String(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    return NextResponse.json({
      success: true,
      channelId: response.data.id,
      expiration: response.data.expiration,
      message: `Watch registered. Expires at ${new Date(Number(response.data.expiration)).toLocaleString()}`,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error?.message || "Failed to register watch",
      note: "Make sure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, and GOOGLE_CALENDAR_ID are set in .env",
    }, { status: 500 });
  }
}
