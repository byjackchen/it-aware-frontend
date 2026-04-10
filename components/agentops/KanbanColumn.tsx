'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { KanbanCard } from './KanbanCard';
import type { Ticket } from '@/lib/types/objects';

interface KanbanColumnProps {
    status: string;
    label: string;
    tickets: Ticket[];
    onStatusChange: (oid: string, status: string) => void;
    onCardClick: (oid: string) => void;
}

const COLUMN_COLORS: Record<string, string> = {
    backlog: 'border-t-gray-400',
    in_progress: 'border-t-blue-500',
    blocked: 'border-t-red-500',
    done: 'border-t-green-500',
};

export function KanbanColumn({ status, label, tickets, onStatusChange, onCardClick }: KanbanColumnProps) {
    const { setNodeRef, isOver } = useDroppable({ id: status });

    return (
        <div
            ref={setNodeRef}
            className={`flex flex-col min-w-[280px] w-[280px] rounded-lg border-t-4 ${COLUMN_COLORS[status] || ''}
                bg-[var(--glass-bg)] border border-[var(--card-border)]
                ${isOver ? 'ring-2 ring-[var(--accent-color)]' : ''}
            `}
        >
            <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--card-border)]">
                <h3 className="text-sm font-semibold">{label}</h3>
                <span className="text-xs text-[var(--text-secondary)] bg-[var(--glass-bg)] px-2 py-0.5 rounded-full">
                    {tickets.length}
                </span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[200px]">
                <SortableContext items={tickets.map(t => t.oid)} strategy={verticalListSortingStrategy}>
                    {tickets.map(ticket => (
                        <KanbanCard
                            key={ticket.oid}
                            ticket={ticket}
                            onStatusChange={onStatusChange}
                            onClick={onCardClick}
                        />
                    ))}
                </SortableContext>
            </div>
        </div>
    );
}
