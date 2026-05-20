'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getOrCreateDm } from '@/lib/api/channels';

interface Suggestion {
    agent_oid: string;
    agent_name: string;
    username: string;
    is_active: boolean;
}

export function NewDmDialog({ onClose }: { onClose: () => void }) {
    const router = useRouter();
    const [agents, setAgents] = useState<Suggestion[]>([]);
    const [q, setQ] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        fetch('/api/agentops/channels/mention-suggestions?limit=200', {
            credentials: 'include',
            cache: 'no-store',
        })
            .then((r) => (r.ok ? r.json() : { items: [] }))
            .then((d: { items?: Suggestion[] }) => {
                if (!cancelled) setAgents(d.items ?? []);
            })
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, []);

    const ql = q.trim().toLowerCase();
    const matches = ql
        ? agents.filter(
              (a) =>
                  a.username.toLowerCase().includes(ql) ||
                  a.agent_name.toLowerCase().includes(ql),
          )
        : agents;

    async function openWith(agentOid: string) {
        if (busy) return;
        setBusy(true);
        setError(null);
        try {
            const ch = await getOrCreateDm(agentOid);
            router.push(`/agent-ops/channels/${ch.oid}`);
            onClose();
        } catch (e: unknown) {
            setError(String((e as Error).message ?? e));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card border rounded shadow-lg w-full max-w-md max-h-[80vh] flex flex-col">
                <header className="border-b p-3 flex justify-between items-center">
                    <h2 className="font-semibold">New direct message</h2>
                    <button
                        onClick={onClose}
                        className="text-sm text-muted-foreground hover:text-foreground"
                    >
                        ✕
                    </button>
                </header>
                <div className="p-3 border-b">
                    <input
                        autoFocus
                        placeholder="Find an agent…"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        className="w-full border rounded p-2 bg-background"
                    />
                </div>
                <ul className="flex-1 overflow-y-auto divide-y">
                    {matches.length === 0 && (
                        <li className="p-3 text-sm text-muted-foreground">
                            No agents match.
                        </li>
                    )}
                    {matches.map((a) => (
                        <li key={a.agent_oid}>
                            <button
                                onClick={() => openWith(a.agent_oid)}
                                disabled={busy}
                                className="w-full text-left px-3 py-2 hover:bg-muted disabled:opacity-50 flex items-center justify-between"
                            >
                                <div>
                                    <div className="font-medium text-sm">
                                        {a.agent_name}
                                    </div>
                                    <div className="text-xs text-muted-foreground font-mono">
                                        @{a.username}
                                    </div>
                                </div>
                                <span className="text-xs text-blue-600 dark:text-blue-300">
                                    Open DM →
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
                {error && (
                    <p className="text-red-600 dark:text-red-300 text-sm p-3 border-t">
                        {error}
                    </p>
                )}
            </div>
        </div>
    );
}
