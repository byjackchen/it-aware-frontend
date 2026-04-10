'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

export interface TicketWSEvent {
    type: 'agent_started' | 'agent_thinking' | 'agent_tool_call' | 'agent_content' | 'agent_completed' | 'agent_error' | 'comment_added';
    [key: string]: unknown;
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

        const cookies = document.cookie.split(';');
        const tokenCookie = cookies.find(c => c.trim().startsWith('it_aware_access='));
        const token = tokenCookie ? tokenCookie.split('=')[1] : '';

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/api/ws/agentops/tickets/${ticketOid}?token=${token}`;

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => setIsConnected(true);
        ws.onclose = () => setIsConnected(false);
        ws.onerror = () => setIsConnected(false);

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
