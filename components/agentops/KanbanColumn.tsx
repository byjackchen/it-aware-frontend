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

const COLUMN_STYLES: Record<string, { border: string; badge: string; glow: string }> = {
    backlog: {
        border: 'border-t-gray-400',
        badge: 'bg-gray-500/20 text-gray-400',
        glow: 'shadow-gray-500/20',
    },
    in_progress: {
        border: 'border-t-blue-500',
        badge: 'bg-blue-500/20 text-blue-400',
        glow: 'shadow-blue-500/20',
    },
    blocked: {
        border: 'border-t-red-500',
        badge: 'bg-red-500/20 text-red-400',
        glow: 'shadow-red-500/20',
    },
    done: {
        border: 'border-t-green-500',
        badge: 'bg-green-500/20 text-green-400',
        glow: 'shadow-green-500/20',
    },
};

export function KanbanColumn({ status, label, tickets, onStatusChange, onCardClick }: KanbanColumnProps) {
    const { setNodeRef, isOver } = useDroppable({ id: status });
    const styles = COLUMN_STYLES[status] || COLUMN_STYLES.backlog;

    return (
        <div
            ref={setNodeRef}
            className={`flex flex-col min-w-[300px] w-[300px] rounded-xl border-t-[3px] ${styles.border}
                bg-[var(--glass-bg)]/80 backdrop-blur-md border border-[var(--card-border)]
                transition-all duration-300 ease-out
                ${isOver
                    ? `ring-2 ring-[var(--accent-color)]/50 shadow-xl ${styles.glow} scale-[1.01] bg-[var(--accent-color)]/5`
                    : 'shadow-sm'
                }
            `}
        >
            {/* Column header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--card-border)]">
                <h3 className="text-sm font-semibold tracking-wide">{label}</h3>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${styles.badge}`}>
                    {tickets.length}
                </span>
            </div>

            {/* Cards container */}
            <div className={`flex-1 overflow-y-auto p-2.5 space-y-2.5 min-h-[200px] transition-colors duration-300
                ${isOver ? 'bg-[var(--accent-color)]/[0.03]' : ''}
            `}>
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

                {/* Empty state */}
                {tickets.length === 0 && (
                    <div className={`flex items-center justify-center h-24 rounded-lg border-2 border-dashed
                        transition-colors duration-300
                        ${isOver
                            ? 'border-[var(--accent-color)]/40 bg-[var(--accent-color)]/5'
                            : 'border-[var(--card-border)]/50'
                        }
                    `}>
                        <span className="text-xs text-[var(--text-secondary)]/60">
                            {isOver ? 'Drop here' : 'No tickets'}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
