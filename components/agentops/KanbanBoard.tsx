'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
    DndContext,
    DragEndEvent,
    DragStartEvent,
    DragOverlay,
    closestCorners,
    PointerSensor,
    KeyboardSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import { KanbanColumn } from './KanbanColumn';
import { KanbanCard } from './KanbanCard';
import type { Ticket } from '@/lib/types/objects';

const COLUMNS = [
    { status: 'open', label: 'Open' },
    { status: 'in_progress', label: 'In Progress' },
    { status: 'blocked', label: 'Blocked' },
    { status: 'done', label: 'Done' },
];

interface KanbanBoardProps {
    tickets: Ticket[];
    onStatusChange: (oid: string, newStatus: string) => Promise<void>;
    onCardClick: (oid: string) => void;
}

export function KanbanBoard({ tickets, onStatusChange, onCardClick }: KanbanBoardProps) {
    const [optimisticTickets, setOptimisticTickets] = useState<Ticket[]>(tickets);
    const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
    const isDraggingRef = useRef(false);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor),
    );

    // Sync from props only when not actively dragging
    useEffect(() => {
        if (!isDraggingRef.current) {
            setOptimisticTickets(tickets);
        }
    }, [tickets]);

    const ticketsByStatus = useMemo(() => {
        const grouped: Record<string, Ticket[]> = { open: [], in_progress: [], blocked: [], done: [] };
        for (const ticket of optimisticTickets) {
            if (grouped[ticket.status]) {
                grouped[ticket.status].push(ticket);
            }
        }
        return grouped;
    }, [optimisticTickets]);

    const handleDragStart = useCallback((event: DragStartEvent) => {
        isDraggingRef.current = true;
        const ticket = optimisticTickets.find(t => t.oid === event.active.id);
        setActiveTicket(ticket || null);
    }, [optimisticTickets]);

    const handleDragEnd = useCallback(async (event: DragEndEvent) => {
        setActiveTicket(null);

        const { active, over } = event;
        if (!over) {
            isDraggingRef.current = false;
            return;
        }

        const ticketOid = active.id as string;
        // Drop target can be a column id or another card — resolve the status
        let newStatus = over.id as string;
        if (!COLUMNS.some(c => c.status === newStatus)) {
            // Dropped on another card — find that card's status
            const targetTicket = optimisticTickets.find(t => t.oid === newStatus);
            if (targetTicket) {
                newStatus = targetTicket.status;
            } else {
                isDraggingRef.current = false;
                return;
            }
        }

        const ticket = optimisticTickets.find(t => t.oid === ticketOid);
        if (!ticket || ticket.status === newStatus) {
            isDraggingRef.current = false;
            return;
        }

        // Optimistic update
        setOptimisticTickets(prev =>
            prev.map(t => t.oid === ticketOid ? { ...t, status: newStatus as Ticket['status'] } : t)
        );

        try {
            await onStatusChange(ticketOid, newStatus);
        } catch {
            setOptimisticTickets(prev =>
                prev.map(t => t.oid === ticketOid ? { ...t, status: ticket.status } : t)
            );
        } finally {
            isDraggingRef.current = false;
        }
    }, [optimisticTickets, onStatusChange]);

    const handleDragCancel = useCallback(() => {
        isDraggingRef.current = false;
        setActiveTicket(null);
    }, []);

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
        >
            <div className="flex gap-5 overflow-x-auto pb-4 min-h-[calc(100vh-200px)]">
                {COLUMNS.map(col => (
                    <KanbanColumn
                        key={col.status}
                        status={col.status}
                        label={col.label}
                        tickets={ticketsByStatus[col.status] || []}
                        onStatusChange={(oid, status) => onStatusChange(oid, status)}
                        onCardClick={onCardClick}
                    />
                ))}
            </div>

            {/* Floating drag overlay */}
            <DragOverlay dropAnimation={{
                duration: 250,
                easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
            }}>
                {activeTicket ? (
                    <KanbanCard
                        ticket={activeTicket}
                        onStatusChange={() => {}}
                        onClick={() => {}}
                        isOverlay
                    />
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}
