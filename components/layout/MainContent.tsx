'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { hasPathSidebar } from '@/lib/config/sidebar';

export function MainContent({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    // Dynamically check if current path has a sidebar
    const hasSidebar = hasPathSidebar(pathname);

    return (
        <>
            <Sidebar />
            <main className={`relative pt-[calc(4rem+var(--env-banner-h,0px))] min-h-screen transition-all ${hasSidebar ? 'pl-56' : 'pl-0'}`}>
                {children}
            </main>
        </>
    );
}
