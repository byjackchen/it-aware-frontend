import { Suspense } from 'react';
import { ChannelListSidebar } from '@/components/agent-ops/channels/ChannelListSidebar';

export const dynamic = 'force-dynamic';

export default function ChannelsPage() {
    return (
        <div className="flex h-full">
            <aside className="w-80 border-r overflow-y-auto bg-card">
                <Suspense fallback={<div className="text-sm text-muted-foreground p-3">Loading…</div>}>
                    <ChannelListSidebar />
                </Suspense>
            </aside>
            <main className="flex-1 flex items-center justify-center text-muted-foreground">
                <p>Pick a channel from the sidebar or create a new one.</p>
            </main>
        </div>
    );
}
