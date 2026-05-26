'use client';

import { useState, useCallback, useMemo } from 'react';
import { useTransitionRouter } from '@/components/navigation/useTransitionRouter';
import { KanbanBoard } from '@/components/agentops/KanbanBoard';
import { useInfiniteResource } from '@/lib/hooks/useInfiniteResource';
import { Calendar } from 'lucide-react';
import type { Ticket, TicketListResponse } from '@/lib/types/objects';

export function TicketKanbanView() {
    const router = useTransitionRouter();
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const { items: tickets, isInitialLoading, reload } = useInfiniteResource<Ticket, TicketListResponse>(
        'tickets',
        {
            pageSize: 500,
            auto: true,
            extractItems: (response) => response.items,
            extractTotal: (response) => response.total,
            inferHasMore: () => false,
        }
    );

    const filteredTickets = useMemo(() => {
        let result = tickets;
        if (dateFrom) result = result.filter(t => new Date(t.created_at) >= new Date(dateFrom));
        if (dateTo) result = result.filter(t => new Date(t.created_at) <= new Date(dateTo + 'T23:59:59'));
        return result;
    }, [tickets, dateFrom, dateTo]);

    const handleStatusChange = useCallback(async (oid: string, newStatus: string) => {
        await fetch(`/api/agentops/tickets/${oid}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus }),
        });
        await reload();
    }, [reload]);

    const handleCardClick = useCallback((oid: string) => {
        window.open(`/data/agentops/tickets/${oid}`, '_blank');
    }, []);

    if (isInitialLoading) {
        return <div className="flex items-center justify-center h-64 text-[var(--text-secondary)]">Loading...</div>;
    }

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">Ticket Kanban</h1>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                        <Calendar className="w-3.5 h-3.5" />
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="px-2 py-1 rounded border border-[var(--card-border)] bg-transparent text-xs"
                        />
                        <span>to</span>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="px-2 py-1 rounded border border-[var(--card-border)] bg-transparent text-xs"
                        />
                        {(dateFrom || dateTo) && (
                            <button
                                onClick={() => { setDateFrom(''); setDateTo(''); }}
                                className="text-[var(--accent-color)] hover:underline"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                    <button
                        onClick={() => router.push('/data/agentops/tickets/new')}
                        className="px-4 py-1.5 rounded text-sm bg-[var(--accent-color)] text-white hover:opacity-90"
                    >
                        New Ticket
                    </button>
                </div>
            </div>
            <KanbanBoard
                tickets={filteredTickets}
                onStatusChange={handleStatusChange}
                onCardClick={handleCardClick}
            />
        </div>
    );
}
