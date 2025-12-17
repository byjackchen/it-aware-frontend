'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';

// Define which paths have sub-menus
const pathsWithSubMenu = ['/auth', '/persona', '/data'];

export function MainContent({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    // Check if current path has a sub-menu
    const hasSubMenu = pathsWithSubMenu.some(path => pathname.startsWith(path));

    return (
        <>
            <Sidebar />
            <main className={`pt-16 min-h-screen transition-all ${hasSubMenu ? 'pl-56' : 'pl-0'}`}>
                {children}
            </main>
        </>
    );
}
