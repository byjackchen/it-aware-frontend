'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ChannelMember } from '@/lib/api/channels';

interface Suggestion {
    agent_oid: string;
    agent_name: string;
    username: string;
    is_active: boolean;
}

interface Props {
    query: string;
    members: ChannelMember[];
    onPick: (username: string) => void;
}

/**
 * Autocomplete for @-mentions.
 *
 * Shows existing channel members first, then any agents from the fleet
 * matching the query prefix (so mentioning a new agent auto-adds them on
 * send). Fetches /api/agentops/channels/mention-suggestions, which joins
 * auth.accounts so the username we display is the same string the backend
 * MentionParser resolves against.
 */
export function MentionAutocomplete({ query, members, onPick }: Props) {
    const [fleet, setFleet] = useState<Suggestion[]>([]);
    const q = query.toLowerCase();

    useEffect(() => {
        let cancelled = false;
        fetch('/api/agentops/channels/mention-suggestions?limit=100', {
            credentials: 'include',
            cache: 'no-store',
        })
            .then((r) => (r.ok ? r.json() : { items: [] }))
            .then((d: { items?: Suggestion[] }) => {
                if (!cancelled) setFleet(d.items ?? []);
            })
            .catch(() => {
                // Fail silently — composer still works without autocomplete.
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const memberAgentOids = useMemo(
        () => new Set(members.map((m) => m.agent_oid)),
        [members],
    );

    const matches = useMemo(() => {
        const sortByMembership = (rows: Suggestion[]) =>
            rows.slice().sort((a, b) => {
                const aIn = memberAgentOids.has(a.agent_oid) ? 0 : 1;
                const bIn = memberAgentOids.has(b.agent_oid) ? 0 : 1;
                if (aIn !== bIn) return aIn - bIn;
                return a.username.localeCompare(b.username);
            });
        if (!q) return sortByMembership(fleet).slice(0, 8);
        return sortByMembership(
            fleet.filter(
                (a) =>
                    a.username.toLowerCase().includes(q) ||
                    a.agent_name.toLowerCase().includes(q),
            ),
        ).slice(0, 8);
    }, [fleet, q, memberAgentOids]);

    const broadcastMatches = useMemo(() => {
        const candidates: Array<{ keyword: 'channel' | 'here'; label: string }> = [
            { keyword: 'channel', label: 'Notify everyone in this channel' },
            { keyword: 'here', label: 'Notify active members only' },
        ];
        if (!q) return candidates;
        return candidates.filter((c) => c.keyword.startsWith(q));
    }, [q]);

    if (matches.length === 0 && broadcastMatches.length === 0) return null;

    return (
        <ul className="bg-card border rounded shadow max-h-48 overflow-y-auto">
            {broadcastMatches.map((b) => (
                <li
                    key={b.keyword}
                    onMouseDown={(e) => {
                        e.preventDefault();
                        onPick(b.keyword);
                    }}
                    className="px-3 py-2 hover:bg-muted cursor-pointer flex items-center justify-between"
                >
                    <div>
                        <div className="text-sm font-medium">@{b.keyword}</div>
                        <div className="text-xs text-muted-foreground">
                            {b.label}
                        </div>
                    </div>
                    <span className="text-xs text-amber-600 dark:text-amber-300">
                        broadcast
                    </span>
                </li>
            ))}
            {matches.map((a) => {
                const inChannel = memberAgentOids.has(a.agent_oid);
                return (
                    <li
                        key={a.agent_oid}
                        onMouseDown={(e) => {
                            // Use onMouseDown to fire before the textarea blur
                            // resets the suggestion list.
                            e.preventDefault();
                            onPick(a.username);
                        }}
                        className="px-3 py-2 hover:bg-muted cursor-pointer flex items-center justify-between"
                    >
                        <div>
                            <div className="text-sm font-medium">
                                {a.agent_name}
                            </div>
                            <div className="text-xs text-muted-foreground font-mono">
                                @{a.username}
                            </div>
                        </div>
                        <span
                            className={`text-xs ${inChannel ? 'text-green-600 dark:text-green-300' : 'text-amber-600 dark:text-amber-300'}`}
                            title={
                                inChannel
                                    ? 'Already in channel'
                                    : 'Will be auto-added on send'
                            }
                        >
                            {inChannel ? '✓ in' : '+ add'}
                        </span>
                    </li>
                );
            })}
        </ul>
    );
}
