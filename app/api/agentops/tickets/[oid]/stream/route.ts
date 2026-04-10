/**
 * Server-side WebSocket → SSE proxy for ticket live updates.
 *
 * Flow:
 *   Browser (EventSource) ──→ Next.js /api/agentops/tickets/{oid}/stream (SSE)
 *                                     │
 *                                     └──→ ws (server-side) ──→ Backend /ws/agentops/tickets/{oid}
 *
 * Why: k8s ingresses typically only expose the frontend, not the backend. This
 * keeps the browser on a single origin and lets the Next.js pod reach the
 * backend via internal service DNS (BACKEND_DOMAIN env var).
 *
 * Disconnect semantics: when the browser closes the SSE, we close the
 * upstream WebSocket. The BACKEND'S agent task is a fire-and-forget
 * asyncio.Task that continues regardless — the final comment is persisted
 * to the DB even if nobody is watching. The stream is purely for live UI
 * progress.
 */
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import WebSocket from 'ws';
import { RUNTIME_CONFIG } from '@/lib/config/runtime';

export const dynamic = 'force-dynamic';

function resolveBackendWsUrl(ticketOid: string, token: string): string {
    // RUNTIME_CONFIG.backend.domain comes from BACKEND_DOMAIN env var,
    // e.g. "http://it-aware-backend:8000" in Docker/k8s or "http://localhost:8000" locally.
    const httpUrl = RUNTIME_CONFIG.backend.domain;
    const wsUrl = httpUrl.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
    return `${wsUrl}/ws/agentops/tickets/${ticketOid}?token=${encodeURIComponent(token)}`;
}

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ oid: string }> }
) {
    const { oid } = await context.params;

    // Get access token from cookies (Next.js pod forwards it to the backend)
    const cookieStore = await cookies();
    const accessCookie = cookieStore.get('it_aware_access');
    const token = accessCookie?.value || '';

    if (!token) {
        return new Response('Unauthorized', { status: 401 });
    }

    const backendUrl = resolveBackendWsUrl(oid, token);

    // Create the upstream WebSocket connection to the backend
    let upstreamWs: WebSocket | null = null;
    let pingInterval: NodeJS.Timeout | null = null;

    const stream = new ReadableStream({
        start(controller) {
            const encoder = new TextEncoder();

            const send = (event: string, data: string) => {
                try {
                    controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
                } catch {
                    // controller may be closed
                }
            };

            const close = () => {
                if (pingInterval) {
                    clearInterval(pingInterval);
                    pingInterval = null;
                }
                if (upstreamWs && upstreamWs.readyState <= WebSocket.OPEN) {
                    try { upstreamWs.close(); } catch { /* noop */ }
                }
                try { controller.close(); } catch { /* noop */ }
            };

            // Abort handler — browser closed the SSE
            request.signal.addEventListener('abort', close);

            // Initial ready ping so the browser EventSource opens
            send('ready', JSON.stringify({ ticket_oid: oid }));

            // Open upstream WebSocket
            try {
                upstreamWs = new WebSocket(backendUrl);
            } catch (err) {
                console.error('[stream] failed to create upstream WS', err);
                send('error', JSON.stringify({ message: 'failed to open backend connection' }));
                close();
                return;
            }

            upstreamWs.on('open', () => {
                send('connected', JSON.stringify({ backend: 'ok' }));
                // Keep the upstream alive with periodic pings
                pingInterval = setInterval(() => {
                    if (upstreamWs?.readyState === WebSocket.OPEN) {
                        try { upstreamWs.send('ping'); } catch { /* noop */ }
                    }
                }, 30000);
            });

            upstreamWs.on('message', (data) => {
                // Forward every backend message as an SSE 'message' event
                try {
                    const text = typeof data === 'string' ? data : data.toString('utf-8');
                    send('message', text);
                } catch (err) {
                    console.error('[stream] forward error', err);
                }
            });

            upstreamWs.on('close', (code, reason) => {
                send('closed', JSON.stringify({ code, reason: reason.toString('utf-8') }));
                close();
            });

            upstreamWs.on('error', (err) => {
                console.error('[stream] upstream WS error', err);
                send('error', JSON.stringify({ message: String(err) }));
            });
        },
        cancel() {
            if (pingInterval) clearInterval(pingInterval);
            if (upstreamWs && upstreamWs.readyState <= WebSocket.OPEN) {
                try { upstreamWs.close(); } catch { /* noop */ }
            }
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no', // nginx: disable buffering
        },
    });
}
