'use client';

/**
 * Searchable dialog for selecting agents to link to accounts.
 * Filters out agents already linked to accounts. Mirrors WorkerSearchDialog.
 */

import { useState, useMemo } from 'react';
import { Search, X, Bot } from 'lucide-react';
import type { Agent } from '@/lib/types/objects';

interface AgentSearchDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (agent: Agent) => void;
    agents: Agent[];
    linkedAgentOids: string[];
}

export function AgentSearchDialog({
    isOpen,
    onClose,
    onSelect,
    agents,
    linkedAgentOids,
}: AgentSearchDialogProps) {
    const [searchTerm, setSearchTerm] = useState('');

    const availableAgents = useMemo(() => {
        const linkedSet = new Set(linkedAgentOids);
        return agents.filter((agent) => {
            if (linkedSet.has(agent.oid)) return false;
            if (!searchTerm) return true;
            const search = searchTerm.toLowerCase();
            return (
                agent.name.toLowerCase().includes(search) ||
                agent.agent_id.toLowerCase().includes(search) ||
                agent.agent_platform.toLowerCase().includes(search)
            );
        });
    }, [agents, linkedAgentOids, searchTerm]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-lg mx-4 glass-dark rounded-xl shadow-2xl border border-white/10 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                    <h3 className="text-lg font-semibold text-white">Select Agent</h3>
                    <button
                        onClick={onClose}
                        className="p-1 rounded text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-4 border-b border-white/10">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by name, agent_id, or platform..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-lg theme-input text-sm"
                            autoFocus
                        />
                    </div>
                </div>
                <div className="max-h-80 overflow-y-auto">
                    {availableAgents.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            {searchTerm ? 'No agents match your search' : 'No available agents'}
                        </div>
                    ) : (
                        <ul className="divide-y divide-white/5">
                            {availableAgents.map((agent) => (
                                <li key={agent.oid}>
                                    <button
                                        onClick={() => {
                                            onSelect(agent);
                                            onClose();
                                        }}
                                        className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors text-left ${!agent.is_active ? 'opacity-60' : ''
                                            }`}
                                    >
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${agent.is_active ? 'bg-purple-500/20' : 'bg-gray-500/20'
                                            }`}>
                                            <Bot className={`w-5 h-5 ${agent.is_active ? 'text-purple-400' : 'text-gray-400'
                                                }`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className={`font-medium truncate ${agent.is_active ? 'text-white' : 'text-gray-400'
                                                    }`}>
                                                    {agent.name}
                                                </span>
                                                {!agent.is_active && (
                                                    <span className="px-1.5 py-0.5 text-xs rounded bg-gray-600/50 text-gray-400">
                                                        Inactive
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-sm text-gray-400 truncate">
                                                {agent.agent_id} · {agent.agent_platform}
                                            </div>
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}
