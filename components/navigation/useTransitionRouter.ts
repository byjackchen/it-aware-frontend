'use client';

/**
 * Drop-in replacement for next/navigation's useRouter() at call sites that only
 * need push/replace/back/refresh. Returns the same shape PLUS isPending so the
 * caller can disable buttons or show inline spinners while a transition runs.
 *
 * Migrate gradually: leave useRouter() in place where pathname/searchParams are
 * needed alongside (those live in usePathname/useSearchParams).
 */

import { useNavigation } from './NavigationProvider';

export function useTransitionRouter() {
    const { push, replace, back, refresh, isPending } = useNavigation();
    return { push, replace, back, refresh, isPending };
}
