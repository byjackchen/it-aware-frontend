'use client';

import { useState } from 'react';
import { cancelRun } from '@/lib/api/channels';

export interface RunActivity {
    run_oid: string;
    thinking: string;          // concatenated thinking deltas
    last_tool: string | null;  // most recent tool name
    tool_phase: string | null; // start/args/end/result
    started_at: number;
}

interface Props {
    activeRuns: Map<string, RunActivity>;
    onClose?: () => void;
}

export function ThinkingPanel({ activeRuns, onClose }: Props) {
    const runs = Array.from(activeRuns.values());
    if (runs.length === 0) return null;

    return (
        <aside className="w-72 border-l p-3 overflow-y-auto bg-card hidden xl:block">
            <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm">
                    Live agent activity ({runs.length})
                </h3>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="text-xs text-muted-foreground hover:text-foreground"
                    >
                        ✕
                    </button>
                )}
            </div>
            <div className="space-y-3">
                {runs.map((r) => (
                    <RunCard key={r.run_oid} run={r} />
                ))}
            </div>
        </aside>
    );
}

function RunCard({ run }: { run: RunActivity }) {
    const [cancelling, setCancelling] = useState(false);

    async function onCancel() {
        setCancelling(true);
        try {
            await cancelRun(run.run_oid);
        } catch {
            // ignore — UI will reflect the cancelled state when the WS event arrives
        } finally {
            setCancelling(false);
        }
    }

    return (
        <div className="border rounded p-2 bg-background">
            <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-mono text-muted-foreground truncate">
                    {run.run_oid.slice(0, 12)}…
                </span>
                <button
                    onClick={onCancel}
                    disabled={cancelling}
                    className="text-xs text-red-600 dark:text-red-300 hover:underline disabled:opacity-50"
                >
                    {cancelling ? 'Cancelling…' : 'Stop'}
                </button>
            </div>
            {run.last_tool && (
                <div className="text-xs text-blue-700 dark:text-blue-300 mb-1">
                    🛠 {run.last_tool} ({run.tool_phase ?? 'running'})
                </div>
            )}
            {run.thinking && (
                <div className="text-xs italic text-muted-foreground line-clamp-6 whitespace-pre-wrap break-words">
                    {run.thinking.slice(-400)}
                </div>
            )}
        </div>
    );
}
