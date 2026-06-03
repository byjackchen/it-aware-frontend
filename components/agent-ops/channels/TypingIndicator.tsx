'use client';

import type { ChannelMember } from '@/lib/api/channels';

interface Props {
    runOids: string[];
    members: ChannelMember[];
}

export function TypingIndicator({ runOids, members }: Props) {
    if (runOids.length === 0) return null;
    // We don't know which agent each run belongs to without an extra fetch.
    // For lean MVP just show generic indicator with count.
    return (
        <div className="text-xs text-muted-foreground px-3 py-1 italic bg-muted/50 border-t">
            {runOids.length === 1
                ? 'An agent is replying…'
                : `${runOids.length} agents are replying…`}
        </div>
    );
}
