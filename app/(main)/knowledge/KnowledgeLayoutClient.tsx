'use client';

/**
 * Client component for Knowledge layout with Catalog Sidebar.
 */

import { CatalogSidebar } from '@/components/knowledge';
import { useTheme } from '@/lib/contexts/theme-context';
import type { ServiceCatalog } from '@/lib/types/objects';

interface KnowledgeLayoutClientProps {
    children: React.ReactNode;
    catalogs: ServiceCatalog[];
    error: string | null;
}

export function KnowledgeLayoutClient({ children, catalogs, error }: KnowledgeLayoutClientProps) {
    const { theme } = useTheme();
    const isLight = theme === 'light';

    return (
        <div className="flex h-[calc(100vh-4rem)]">
            <CatalogSidebar catalogs={catalogs} error={error} />
            <main className={`
                flex-1 overflow-y-auto p-6
                ${isLight ? 'bg-slate-50' : 'bg-gray-950'}
            `}>
                {children}
            </main>
        </div>
    );
}
