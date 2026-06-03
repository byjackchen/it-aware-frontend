/**
 * Returns the WebSocket URL the browser should connect to for backend events.
 *
 * Computed server-side from BACKEND_DOMAIN so the client never has to learn
 * the backend host through a NEXT_PUBLIC_* env var. Next.js rewrites do not
 * support WebSocket upgrades, so the browser must dial the backend directly.
 */
import { NextResponse } from 'next/server';
import { RUNTIME_CONFIG } from '@/lib/config/runtime';

export async function GET() {
    const domain = RUNTIME_CONFIG.backend.publicDomain;
    const wsUrl = domain
        .replace(/^https:\/\//, 'wss://')
        .replace(/^http:\/\//, 'ws://')
        .replace(/\/+$/, '') + '/ws';
    return NextResponse.json({ ws_url: wsUrl });
}
