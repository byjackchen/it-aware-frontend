'use client';

/**
 * ActorBadge — surfaces the Phase 3 typed actor on incident/request detail
 * pages. Renders a colored type pill, the actor_stable_id (canonical
 * identifier across all actor types), and links to the worker profile
 * when type='worker' and we have a stable_id to resolve.
 *
 * If actor_stable_id is null (legacy data), falls back to actor_oid.
 */

import Link from 'next/link';
import { User, Cpu, Bot, Globe } from 'lucide-react';
import type { ActorType } from '@/lib/types/objects';

interface ActorBadgeProps {
    actorType: ActorType | null | undefined;
    actorStableId: string | null | undefined;
    actorOid: string | null | undefined;
    actorRole?: string | null;
    /** Default role label when actor_role is unset (e.g. 'caller', 'requester'). */
    defaultRole?: string;
}

const TYPE_STYLES: Record<ActorType, { label: string; pill: string; Icon: typeof User }> = {
    worker:   { label: 'Worker',   pill: 'bg-blue-500/15 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 ring-1 ring-blue-500/30',         Icon: User  },
    system:   { label: 'System',   pill: 'bg-cyan-500/15 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300 ring-1 ring-cyan-500/30',         Icon: Cpu   },
    agent:    { label: 'Agent',    pill: 'bg-violet-500/15 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300 ring-1 ring-violet-500/30', Icon: Bot   },
    external: { label: 'External', pill: 'bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 ring-1 ring-amber-500/30',     Icon: Globe },
};

const FALLBACK_STYLE = {
    label: 'Unknown',
    pill: 'bg-gray-500/15 text-gray-700 dark:bg-gray-500/20 dark:text-gray-300 ring-1 ring-gray-500/30',
    Icon: User,
};

export function ActorBadge({
    actorType,
    actorStableId,
    actorOid,
    actorRole,
    defaultRole = 'actor',
}: ActorBadgeProps) {
    const style = (actorType && TYPE_STYLES[actorType]) || FALLBACK_STYLE;
    const { Icon } = style;
    const role = actorRole || defaultRole;
    const identifier = actorStableId || actorOid || 'Unknown';
    // Only workers get a profile link — other types don't have a /data/workers/<id> page.
    const isLinkable = actorType === 'worker' && !!actorStableId;

    return (
        <div className="flex flex-wrap items-center gap-2 text-sm">
            <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${style.pill}`}
                aria-label={`Actor type: ${style.label}`}
                data-testid="actor-type-badge"
            >
                <Icon className="w-3 h-3" />
                {style.label}
            </span>
            <span className="text-slate-500 dark:text-slate-400 capitalize">{role}:</span>
            {isLinkable ? (
                <Link
                    href={`/data/workers/${actorStableId}`}
                    className="font-mono text-xs underline underline-offset-4 hover:text-blue-500"
                    data-testid="actor-stable-id"
                >
                    {actorStableId}
                </Link>
            ) : (
                <span className="font-mono text-xs" data-testid="actor-stable-id">
                    {identifier}
                </span>
            )}
        </div>
    );
}
