'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Flag } from 'lucide-react';
import { AgentStatusIndicator } from './AgentStatusIndicator';
import type { Ticket } from '@/lib/types/objects';

interface KanbanCardProps {
    ticket: Ticket;
    onStatusChange: (oid: string, status: string) => void;
    onClick: (oid: string) => void;
}

export function KanbanCard({ ticket, onStatusChange, onClick }: KanbanCardProps) {
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
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={`p-3 rounded-lg border cursor-grab active:cursor-grabbing
                bg-[var(--card-bg)] border-[var(--card-border)]
                hover:border-[var(--accent-color)] transition-all
                ${ticket.agent_status === 'running' ? 'ring-2 ring-blue-400 animate-pulse' : ''}
                ${ticket.agent_status === 'error' ? 'ring-2 ring-red-400' : ''}
            `}
        >
            <div className="flex items-start justify-between gap-2">
                <button
                    onClick={(e) => { e.stopPropagation(); onClick(ticket.oid); }}
                    className="text-sm font-medium text-left hover:underline flex-1"
                >
                    {ticket.title}
                </button>
                <div className="flex items-center gap-1 shrink-0">
                    {ticket.flagged && <Flag className="w-3 h-3 text-orange-500 fill-orange-500" />}
                    <AgentStatusIndicator agentStatus={ticket.agent_status} />
                </div>
            </div>

            {ticket.tags && ticket.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                    {ticket.tags.map(tag => (
                        <span key={tag} className="px-1.5 py-0.5 text-xs rounded bg-[var(--glass-bg)] text-[var(--text-secondary)]">
                            {tag}
                        </span>
                    ))}
                </div>
            )}

            <div className="flex items-center justify-between mt-2 text-xs text-[var(--text-secondary)]">
                <span>{ticket.assignee_account_oid ? 'Assigned' : 'Unassigned'}</span>
                <select
                    value={ticket.status}
                    onChange={(e) => { e.stopPropagation(); onStatusChange(ticket.oid, e.target.value); }}
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs bg-transparent border rounded px-1 py-0.5"
                >
                    <option value="backlog">Backlog</option>
                    <option value="in_progress">In Progress</option>
                    <option value="blocked">Blocked</option>
                    <option value="done">Done</option>
                </select>
            </div>
        </div>
    );
}
