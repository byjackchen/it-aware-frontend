'use client';

/**
 * Wraps next/navigation's router with React 19's useTransition so every
 * programmatic navigation becomes a transition with an isPending flag.
 * RouteProgressBar and NavLink read this context.
 */

import { createContext, useContext, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

type NavigationContextValue = {
    isPending: boolean;
    push: (href: string) => void;
    replace: (href: string) => void;
    back: () => void;
    refresh: () => void;
};

const NavigationContext = createContext<NavigationContextValue | null>(null);

export function NavigationProvider({ children }: { children: ReactNode }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const value: NavigationContextValue = {
        isPending,
        push: (href) => startTransition(() => router.push(href)),
        replace: (href) => startTransition(() => router.replace(href)),
        back: () => startTransition(() => router.back()),
        refresh: () => startTransition(() => router.refresh()),
    };

    return (
        <NavigationContext.Provider value={value}>
            {children}
        </NavigationContext.Provider>
    );
}

export function useNavigation(): NavigationContextValue {
    const ctx = useContext(NavigationContext);
    if (!ctx) {
        throw new Error('useNavigation must be used inside <NavigationProvider>');
    }
    return ctx;
}
