'use client';

import type { ChannelMember } from '@/lib/api/channels';

export function MemberPanel({ members }: { members: ChannelMember[] }) {
    return (
        <div>
            <h3 className="text-sm font-semibold mb-2">Members ({members.length})</h3>
            <ul className="space-y-2">
                {members.map((m) => (
                    <li key={m.agent_oid} className="text-sm">
                        <div className="font-medium truncate">
                            {m.agent_name ?? m.agent_oid}
                        </div>
                        <div className="text-xs text-muted-foreground">
                            joined {new Date(m.joined_at).toLocaleString()}
                        </div>
                    </li>
                ))}
                {members.length === 0 && (
                    <li className="text-xs text-muted-foreground">
                        No agents yet. @-mention one to invite.
                    </li>
                )}
            </ul>
        </div>
    );
}
