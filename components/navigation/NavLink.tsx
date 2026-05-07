'use client';

/**
 * Drop-in <Link>-shaped component that routes through NavigationProvider so
 * the click triggers a React transition. Falls back to plain anchor behavior
 * for modifier-clicks / non-left-clicks (open in new tab still works).
 *
 * We deliberately render a plain <a> rather than next/link's <Link> because
 * we want startTransition to run on the click, and intercepting next/link's
 * onClick would race with its built-in prefetch/navigate logic.
 */

import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from 'react';
import { useNavigation } from './NavigationProvider';

type NavLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string;
    replace?: boolean;
    children: ReactNode;
};

export function NavLink({
    href,
    replace = false,
    children,
    onClick,
    target,
    ...rest
}: NavLinkProps) {
    const { push, replace: replaceFn } = useNavigation();

    const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        if (target && target !== '_self') return;
        if (e.button !== 0) return; // only left-click
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // new tab / save / etc.

        e.preventDefault();
        if (replace) replaceFn(href);
        else push(href);
    };

    return (
        <a href={href} target={target} onClick={handleClick} {...rest}>
            {children}
        </a>
    );
}
