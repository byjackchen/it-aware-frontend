'use client';

interface AgentStatusIndicatorProps {
    agentStatus: 'idle' | 'running' | 'error';
    size?: 'sm' | 'md';
}

export function AgentStatusIndicator({ agentStatus, size = 'sm' }: AgentStatusIndicatorProps) {
    if (agentStatus === 'idle') return null;

    const sizeClass = size === 'sm' ? 'w-2 h-2' : 'w-3 h-3';

    if (agentStatus === 'running') {
        return (
            <span className={`inline-block ${sizeClass} rounded-full bg-blue-500 animate-pulse`}
                  title="Agent is working..." />
        );
    }

    return (
        <span className={`inline-block ${sizeClass} rounded-full bg-red-500`}
              title="Agent error" />
    );
}
