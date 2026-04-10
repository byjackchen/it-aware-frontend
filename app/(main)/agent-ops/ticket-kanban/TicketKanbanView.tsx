'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { KanbanBoard } from '@/components/agentops/KanbanBoard';
import { useInfiniteResource } from '@/lib/hooks/useInfiniteResource';
import { Flag } from 'lucide-react';
import type { Ticket, TicketListResponse } from '@/lib/types/objects';

export function TicketKanbanView() {
    const router = useRouter();
    const [flaggedOnly, setFlaggedOnly] = useState(false);

    const { items: tickets, isInitialLoading, reload } = useInfiniteResource<Ticket, TicketListResponse>(
        'agentops/tickets',
        {
            pageSize: 500,
            auto: true,
            extractItems: (response) => response.items,
            extractTotal: (response) => response.total,
            inferHasMore: () => false,
        }
    );

    const filteredTickets = flaggedOnly ? tickets.filter(t => t.flagged) : tickets;

    const handleStatusChange = useCallback(async (oid: string, newStatus: string) => {
        await fetch(`/api/objects/tickets/${oid}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus }),
        });
        await reload();
    }, [reload]);

    const handleCardClick = useCallback((oid: string) => {
        router.push(`/data/agentops/tickets/${oid}`);
    }, [router]);

    if (isInitialLoading) {
        return <div className="flex items-center justify-center h-64 text-[var(--text-secondary)]">Loading...</div>;
    }

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">Ticket Kanban</h1>
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setFlaggedOnly(!flaggedOnly)}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm border transition-colors
                            ${flaggedOnly ? 'bg-orange-100 border-orange-300 text-orange-700 dark:bg-orange-900/30 dark:border-orange-700 dark:text-orange-300' : 'border-[var(--card-border)]'}
                        `}
                    >
                        <Flag className="w-3.5 h-3.5" />
                        Flagged
                    </button>
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
