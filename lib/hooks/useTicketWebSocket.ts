'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

export interface TicketWSEvent {
    type: 'agent_started' | 'agent_thinking' | 'agent_tool_call' | 'agent_content' | 'agent_completed' | 'agent_error' | 'comment_added';
    [key: string]: unknown;
}

/**
 * Backend WebSocket URL resolution.
 *
 * The WS endpoint lives on the backend (not proxied through Next.js).
 * - Local dev: frontend on :3007, backend on :8007 — connect directly to :8007
 * - Production: use same host, backend is reachable at ws[s]://host/ws/...
 */
function getBackendWsUrl(ticketOid: string, token: string): string {
    const { protocol, hostname, port } = window.location;
    const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';

    // If frontend is on :3007, backend is on :8007. Otherwise assume same host.
    const backendPort = port === '3007' ? '8007' : port;
    const backendHost = backendPort ? `${hostname}:${backendPort}` : hostname;

    return `${wsProtocol}//${backendHost}/ws/agentops/tickets/${ticketOid}?token=${encodeURIComponent(token)}`;
}

export function useTicketWebSocket(ticketOid: string | null) {
    const wsRef = useRef<WebSocket | null>(null);
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

        // Read access token from cookie (set during login)
        const cookies = document.cookie.split(';');
        const tokenCookie = cookies.find(c => c.trim().startsWith('it_aware_access='));
        const token = tokenCookie ? tokenCookie.split('=')[1].trim() : '';

        if (!token) {
            console.warn('[useTicketWebSocket] no access token found in cookies');
            return;
        }

        const wsUrl = getBackendWsUrl(ticketOid, token);
        console.log('[useTicketWebSocket] connecting to', wsUrl.replace(/token=[^&]+/, 'token=***'));

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log('[useTicketWebSocket] connected');
            setIsConnected(true);
        };
        ws.onclose = (evt) => {
            console.log('[useTicketWebSocket] closed', evt.code, evt.reason);
            setIsConnected(false);
        };
        ws.onerror = (evt) => {
            console.error('[useTicketWebSocket] error', evt);
            setIsConnected(false);
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data) as TicketWSEvent;
                setLastEvent(data);
                listenersRef.current.forEach(l => l(data));
            } catch {
                // ignore
            }
        };

        const pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send('ping');
            }
        }, 30000);

        return () => {
            clearInterval(pingInterval);
            ws.close();
            wsRef.current = null;
            setIsConnected(false);
        };
    }, [ticketOid]);

    return { lastEvent, isConnected, subscribe };
}
