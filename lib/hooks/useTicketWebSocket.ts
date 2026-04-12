'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

export interface TicketWSEvent {
    type: 'agent_started' | 'agent_completed' | 'agent_error' | 'comment_added';
    [key: string]: unknown;
}

/**
 * Ticket live update subscription.
 *
 * Uses Server-Sent Events (EventSource) against a Next.js API route that
 * proxies to the backend WebSocket server-side. This keeps the browser on
 * the same origin — no CORS, no direct backend exposure, works in k8s where
 * the backend is not reachable from the internet.
 *
 * If the browser disconnects, the Next.js route closes the upstream WS.
 * The backend agent task (asyncio.Task) continues independently — the final
 * comment is persisted regardless of whether anyone is listening.
 */
export function useTicketWebSocket(ticketOid: string | null) {
    const [lastEvent, setLastEvent] = useState<TicketWSEvent | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const listenersRef = useRef<Array<(event: TicketWSEvent) => void>>([]);

    const subscribe = useCallback((listener: (event: TicketWSEvent) => void) => {
        listenersRef.current.push(listener);
        return () => {
            listenersRef.current = listenersRef.current.filter(l => l !== listener);
        };
    }, []);

    useEffect(() => {
        if (!ticketOid) return;

        const streamUrl = `/api/agentops/tickets/${ticketOid}/stream`;
        console.log('[ticket-stream] connecting to', streamUrl);

        const source = new EventSource(streamUrl, { withCredentials: true });

        source.addEventListener('ready', () => {
            console.log('[ticket-stream] ready');
        });

        source.addEventListener('connected', () => {
            console.log('[ticket-stream] upstream connected');
            setIsConnected(true);
        });

        source.addEventListener('closed', (ev) => {
            console.log('[ticket-stream] upstream closed', (ev as MessageEvent).data);
            setIsConnected(false);
        });

        source.addEventListener('error', (ev) => {
            console.error('[ticket-stream] error', ev);
            setIsConnected(false);
        });

        source.addEventListener('message', (ev: MessageEvent) => {
            try {
                const data = JSON.parse(ev.data) as TicketWSEvent;
                setLastEvent(data);
                listenersRef.current.forEach(l => l(data));
            } catch (err) {
                console.warn('[ticket-stream] unparseable message', err);
            }
        });

        return () => {
            source.close();
            setIsConnected(false);
        };
    }, [ticketOid]);

    return { lastEvent, isConnected, subscribe };
}
