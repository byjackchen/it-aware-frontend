'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AgentStatusIndicator } from './AgentStatusIndicator';
import type { Ticket } from '@/lib/types/objects';

interface KanbanCardProps {
    ticket: Ticket;
    onStatusChange: (oid: string, status: string) => void;
    onClick: (oid: string) => void;
    isOverlay?: boolean;
}

export function KanbanCard({ ticket, onStatusChange, onClick, isOverlay }: KanbanCardProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: ticket.oid, data: { ticket } });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition: transition || 'transform 200ms cubic-bezier(0.25, 1, 0.5, 1)',
        opacity: isDragging ? 0 : 1,
        zIndex: isDragging ? 0 : 'auto' as const,
    };

    const overlayStyle = isOverlay ? {
        boxShadow: '0 20px 60px rgba(0,0,0,0.35), 0 8px 20px rgba(0,0,0,0.2)',
        transform: 'scale(1.04) rotate(1.5deg)',
        cursor: 'grabbing',
    } : {};

    return (
        <div
            ref={isOverlay ? undefined : setNodeRef}
            style={isOverlay ? overlayStyle : style}
            {...(isOverlay ? {} : { ...attributes, ...listeners })}
            className={`group relative p-3 rounded-xl border backdrop-blur-sm cursor-grab active:cursor-grabbing
                ${isOverlay
                    ? 'bg-[var(--card-bg)] border-[var(--accent-color)] ring-2 ring-[var(--accent-color)]/30'
                    : 'bg-[var(--card-bg)] border-[var(--card-border)] hover:border-[var(--accent-color)]/50 hover:shadow-lg hover:shadow-black/10'
                }
                transition-all duration-200 ease-out
                ${ticket.has_active_run ? 'ring-2 ring-blue-400/60 animate-pulse' : ''}
            `}
        >
            <div className="flex items-start justify-between gap-2">
                <button
                    onClick={(e) => { e.stopPropagation(); onClick(ticket.oid); }}
                    className="text-sm font-medium text-left hover:text-[var(--accent-color)] hover:underline transition-colors flex-1 line-clamp-2"
                >
                    {ticket.title}
                </button>
                <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                    <AgentStatusIndicator agentStatus={ticket.has_active_run ? 'running' : 'idle'} />
                </div>
            </div>

            {ticket.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                    {ticket.tags.map(tag => (
                        <span key={tag} className="px-1.5 py-0.5 text-[10px] font-medium rounded-md
                            bg-[var(--accent-color)]/10 text-[var(--accent-color)] border border-[var(--accent-color)]/20">
                            {tag}
                        </span>
                    ))}
                </div>
            )}

            <div className="flex items-center justify-between mt-2.5 text-xs text-[var(--text-secondary)]">
                <span className="flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${ticket.assignee_account_oid ? 'bg-green-400' : 'bg-gray-500'}`} />
                    {ticket.assignee_account_oid ? 'Assigned' : 'Unassigned'}
                </span>
                {!isOverlay && (
                    <select
                        value={ticket.status}
                        onPointerDown={(e) => e.stopPropagation()}
                        onChange={(e) => { e.stopPropagation(); onStatusChange(ticket.oid, e.target.value); }}
                        onClick={(e) => e.stopPropagation()}
                        className="text-[10px] bg-transparent border border-[var(--card-border)] rounded-md px-1.5 py-0.5
                            hover:border-[var(--accent-color)]/50 transition-colors cursor-pointer"
                    >
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="blocked">Blocked</option>
                        <option value="done">Done</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                )}
            </div>
        </div>
    );
}
