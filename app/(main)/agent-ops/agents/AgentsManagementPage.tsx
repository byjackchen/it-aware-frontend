'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, ChevronDown, ChevronRight, MessageSquare } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { useTimezone } from '@/lib/contexts/timezone-context';
import { formatDateTime } from '@/lib/utils/datetime';
import { useInfiniteResource } from '@/lib/hooks/useInfiniteResource';
import { getOrCreateDm } from '@/lib/api/channels';
import type { Agent, AgentListResponse } from '@/lib/types/objects';

interface AgentHistoryState {
    chatHistory: unknown[];
    chatLoading: boolean;
    showHistory: boolean;
    filters: {
        conversation_id: string;
        user: string;
        start_time: string;
        end_time: string;
        page: number;
        per_page: number;
    };
}

const defaultHistoryState = (): AgentHistoryState => ({
    chatHistory: [],
    chatLoading: false,
    showHistory: false,
    filters: { conversation_id: '', user: '', start_time: '', end_time: '', page: 1, per_page: 20 },
});

export function AgentsManagementPage() {
    const { theme } = useTheme();
    const { timezone } = useTimezone();
    const isLight = theme === 'light';
    const router = useRouter();
    const [dmBusy, setDmBusy] = useState<string | null>(null);

    async function openDm(agentOid: string) {
        if (dmBusy) return;
        setDmBusy(agentOid);
        try {
            const ch = await getOrCreateDm(agentOid);
            router.push(`/agent-ops/channels/${ch.oid}`);
        } catch (e: unknown) {
            alert(`Failed to open DM: ${(e as Error).message}`);
        } finally {
            setDmBusy(null);
        }
    }

    const { items: agents, isInitialLoading } = useInfiniteResource<Agent, AgentListResponse>(
        'agents',
        {
            pageSize: 500,
            auto: true,
            extractItems: (r) => r.items,
            extractTotal: (r) => r.total,
            inferHasMore: () => false,
        }
    );

    const [historyStates, setHistoryStates] = useState<Record<string, AgentHistoryState>>({});

    const getState = (oid: string) => historyStates[oid] || defaultHistoryState();

    const updateState = (oid: string, updater: (prev: AgentHistoryState) => AgentHistoryState) => {
        setHistoryStates(prev => ({
            ...prev,
            [oid]: updater(prev[oid] || defaultHistoryState()),
        }));
    };

    const toggleHistory = (oid: string) => {
        updateState(oid, s => ({ ...s, showHistory: !s.showHistory }));
    };

    const fetchChatHistory = useCallback(async (agent: Agent) => {
        updateState(agent.oid, s => ({ ...s, chatLoading: true }));
        const state = getState(agent.oid);
        try {
            const body: Record<string, unknown> = {
                page: state.filters.page,
                per_page: state.filters.per_page,
            };
            if (state.filters.conversation_id) body.conversation_id = state.filters.conversation_id;
            if (state.filters.user) body.user = state.filters.user;
            if (state.filters.start_time) body.start_time = state.filters.start_time + ' 00:00:00';
            if (state.filters.end_time) body.end_time = state.filters.end_time + ' 23:59:59';

            const res = await fetch(`/api/agents/${agent.oid}/chat-history`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            // Knot API response shape: { code, data: { messages: [...], total }, msg }
            const items = Array.isArray(data)
                ? data
                : data?.data?.messages || data?.messages || data?.items || [];
            updateState(agent.oid, s => ({ ...s, chatHistory: items, chatLoading: false }));
        } catch (err) {
            console.error(err);
            updateState(agent.oid, s => ({ ...s, chatHistory: [], chatLoading: false }));
        }
    }, [historyStates]);

    const inputClass = `w-full px-2 py-1 rounded-lg text-xs ${isLight ? 'bg-slate-100 text-slate-800' : 'bg-white/10 text-white'}`;

    if (isInitialLoading) {
        return <div className="flex items-center justify-center h-64 text-[var(--text-secondary)]">Loading agents...</div>;
    }

    return (
        <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight ? 'bg-purple-100 text-purple-600' : 'bg-purple-500/20 text-purple-400'}`}>
                    <Bot className="w-5 h-5" />
                </div>
                <h1 className="text-2xl font-bold">Agent Fleet</h1>
                <span className="text-sm text-[var(--text-secondary)]">{agents.length} agents</span>
            </div>

            <div className="space-y-4">
                {agents.map(agent => {
                    const state = getState(agent.oid);
                    return (
                        <div key={agent.oid} className={`rounded-xl border overflow-hidden ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                            {/* Agent header row */}
                            <div
                                role="button"
                                tabIndex={0}
                                onClick={() => toggleHistory(agent.oid)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        toggleHistory(agent.oid);
                                    }
                                }}
                                className={`w-full flex items-center gap-4 px-4 py-3 text-left transition-colors cursor-pointer ${isLight ? 'hover:bg-slate-50' : 'hover:bg-white/5'}`}
                            >
                                {state.showHistory ? <ChevronDown className="w-4 h-4 shrink-0 text-[var(--text-secondary)]" /> : <ChevronRight className="w-4 h-4 shrink-0 text-[var(--text-secondary)]" />}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-sm">{agent.name}</span>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${isLight ? 'bg-slate-100 text-slate-500' : 'bg-white/10 text-gray-400'}`}>{agent.agent_platform}</span>
                                        <span className={`w-2 h-2 rounded-full ${agent.is_active ? 'bg-green-400' : 'bg-red-400'}`} />
                                    </div>
                                    <div className="text-xs text-[var(--text-secondary)] mt-0.5 truncate">
                                        ID: {agent.agent_id} &middot; Workspace: {agent.agent_workspace_id || '—'}
                                    </div>
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        openDm(agent.oid);
                                    }}
                                    disabled={dmBusy === agent.oid || !agent.is_active}
                                    className={`text-xs px-2 py-1 rounded border flex items-center gap-1 disabled:opacity-50 ${isLight ? 'border-slate-300 hover:bg-slate-100' : 'border-white/20 hover:bg-white/10'}`}
                                    title="Open DM with this agent"
                                >
                                    <MessageSquare className="w-3 h-3" />
                                    {dmBusy === agent.oid ? 'Opening…' : 'DM'}
                                </button>
                                <span className="text-xs text-[var(--text-secondary)]">Conversation Histories</span>
                            </div>

                            {/* Expandable conversation history section */}
                            {state.showHistory && (
                                <div className="px-4 pb-4 space-y-3 border-t border-[var(--card-border)]">
                                    {/* Filters */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-3">
                                        <input type="text" placeholder="Conversation ID"
                                            value={state.filters.conversation_id}
                                            onChange={(e) => updateState(agent.oid, s => ({ ...s, filters: { ...s.filters, conversation_id: e.target.value } }))}
                                            className={inputClass} />
                                        <input type="text" placeholder="User"
                                            value={state.filters.user}
                                            onChange={(e) => updateState(agent.oid, s => ({ ...s, filters: { ...s.filters, user: e.target.value } }))}
                                            className={inputClass} />
                                        <input type="date" value={state.filters.start_time}
                                            onChange={(e) => updateState(agent.oid, s => ({ ...s, filters: { ...s.filters, start_time: e.target.value } }))}
                                            className={inputClass} />
                                        <input type="date" value={state.filters.end_time}
                                            onChange={(e) => updateState(agent.oid, s => ({ ...s, filters: { ...s.filters, end_time: e.target.value } }))}
                                            className={inputClass} />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => void fetchChatHistory(agent)} disabled={state.chatLoading}
                                            className="px-3 py-1.5 rounded text-xs bg-purple-500 text-white hover:bg-purple-600 disabled:opacity-50 transition-colors">
                                            {state.chatLoading ? 'Loading...' : 'Fetch'}
                                        </button>
                                        <div className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
                                            <button onClick={() => updateState(agent.oid, s => ({ ...s, filters: { ...s.filters, page: Math.max(1, s.filters.page - 1) } }))}
                                                disabled={state.filters.page <= 1} className="px-2 py-1 rounded border border-[var(--card-border)] disabled:opacity-30">Prev</button>
                                            <span>Page {state.filters.page}</span>
                                            <button onClick={() => updateState(agent.oid, s => ({ ...s, filters: { ...s.filters, page: s.filters.page + 1 } }))}
                                                className="px-2 py-1 rounded border border-[var(--card-border)]">Next</button>
                                        </div>
                                    </div>

                                    {/* Results */}
                                    {state.chatHistory.length > 0 ? (
                                        <div className="space-y-3 max-h-[600px] overflow-y-auto">
                                            {state.chatHistory.map((item: any, idx: number) => {
                                                const conversationId = item.session_id || item.conversation_id || '';
                                                const username = item.username || item.user || '';
                                                const timestamp = item.user_request_at || item.created_at || '';
                                                const userMessage = item.user_sent_request || '';
                                                const agentResponse = item.user_received_response || item.content || item.message || '';
                                                const model = item.specified_model_name || '';
                                                return (
                                                    <div key={item.id || idx} className={`p-3 rounded-lg border text-sm ${isLight ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-white/5'}`}>
                                                        <div className="flex items-center flex-wrap gap-2 mb-2 text-xs text-[var(--text-secondary)]">
                                                            {conversationId && <span className="font-mono bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded" title={conversationId}>{conversationId.slice(0, 16)}...</span>}
                                                            {username && <span className="font-medium">{username}</span>}
                                                            {model && <span className={`px-1.5 py-0.5 rounded text-[10px] ${isLight ? 'bg-slate-200 text-slate-600' : 'bg-white/10 text-gray-400'}`}>{model}</span>}
                                                            {timestamp && <span>{formatDateTime(timestamp, timezone)}</span>}
                                                        </div>
                                                        {userMessage && (
                                                            <div className="mb-2">
                                                                <div className="text-[10px] uppercase font-semibold text-[var(--text-secondary)] mb-1">User</div>
                                                                <div className={`whitespace-pre-wrap text-sm p-2 rounded ${isLight ? 'bg-white' : 'bg-black/20'}`}>{userMessage}</div>
                                                            </div>
                                                        )}
                                                        {agentResponse && (
                                                            <div>
                                                                <div className="text-[10px] uppercase font-semibold text-[var(--text-secondary)] mb-1">Agent</div>
                                                                <div className={`whitespace-pre-wrap text-sm p-2 rounded ${isLight ? 'bg-white' : 'bg-black/20'}`}>{agentResponse}</div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : !state.chatLoading && (
                                        <div className="text-xs text-[var(--text-secondary)] text-center py-4">No results. Click Fetch to load conversation histories.</div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}

                {agents.length === 0 && (
                    <div className="text-center py-12 text-[var(--text-secondary)]">No agents found.</div>
                )}
            </div>
        </div>
    );
}
